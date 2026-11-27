// Attestation data lives in its own file (utils/nativeStore/attestationDataStorage),
// outside the three journaled storage roots. After a v2 unlock, this moves any
// legacy attestation record to the vault key. It is best effort: a record that
// does not convert stays in the legacy format, which the password still reads,
// and the next v2 unlock tries again.
import { decryptkey } from '../seedCrypt';
import { decryptRecord, encryptRecord, isV2Record } from '../crypto/envelope';
import { updateAttestationData } from '../nativeStore/attestationDataStorage';

export const convertLegacyAttestationRecords = async (accountHash, password, dek) => {
  try {
    // One queued file operation: the read, the conversion and the write.
    // A write by another operation waits, so the conversion cannot undo it.
    // A read error rejects before anything is written.
    let changed = false;
    await updateAttestationData(async all => {
      const record = all[accountHash];
      if (record == null || typeof record !== 'object') return undefined;

      const next = {...record};
      for (const key of Object.keys(record)) {
        const value = record[key];
        if (typeof value !== 'string' || isV2Record(value)) continue;
        const plaintext = decryptkey(password, value);
        if (plaintext === false) continue;
        const converted = await encryptRecord(dek, plaintext);
        if (decryptRecord(dek, converted) !== plaintext) continue;
        next[key] = converted;
        changed = true;
      }
      // Nothing to write: the file operation still removes a stale backup,
      // which can hold a legacy record.
      return changed ? {...all, [accountHash]: next} : undefined;
    });
    return changed;
  } catch (error) {
    console.warn(`Attestation vault conversion skipped: ${error?.code || error?.name || 'unknown'}`);
    return false;
  }
};
