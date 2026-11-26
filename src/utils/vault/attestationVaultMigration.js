// Attestation data lives in its own file (utils/nativeStore/attestationDataStorage),
// outside the three journaled storage roots. After a v2 unlock, this moves any
// legacy attestation record to the vault key. It is best effort: a record that
// does not convert stays in the legacy format, which the password still reads,
// and the next v2 unlock tries again.
import { decryptkey } from '../seedCrypt';
import { decryptRecord, encryptRecord, isV2Record } from '../crypto/envelope';
import {
  loadAttestationData,
  storeAttestationDataForUser,
} from '../nativeStore/attestationDataStorage';

export const convertLegacyAttestationRecords = async (accountHash, password, dek) => {
  try {
    // loadAttestationDataForUser hides read errors behind a default object.
    // Read the file directly so a read error never leads to a write.
    const all = await loadAttestationData();
    const record = all != null ? all[accountHash] : null;
    if (record == null || typeof record !== 'object') return false;

    const next = {...record};
    let changed = false;
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

    if (changed) await storeAttestationDataForUser(next, accountHash);
    return changed;
  } catch (error) {
    console.warn(`Attestation vault conversion skipped: ${error?.code || error?.name || 'unknown'}`);
    return false;
  }
};
