import store from "../../../../store"
import { deleteAttestationDataForUser, loadAttestationDataForUser, storeAttestationDataForUser, storeAttestationFieldForUser, clearCorruptedAttestationDataForUser } from "../../../../utils/nativeStore/attestationDataStorage"
import { requestVaultKey } from "../../../../utils/auth/authBox"
import { vaultEncrypt, vaultDecrypt } from "../../../../utils/seedCrypt"
import { RECORD_AREA } from "../../../../utils/crypto/envelope"
import { setAttestationData } from "../creators/attestations"

export const saveEncryptedAttestationDataForUser = async (encryptedData = {}, accountHash) => {  
  const attestationData = await storeAttestationDataForUser(encryptedData, accountHash)
  store.dispatch(setAttestationData(encryptedData))
  return attestationData
}

// Writes only `field`: the rest of the record can change while the caller
// waits (for example a password change converts a legacy record).
const saveEncryptedAttestationFieldForUser = async (accountHash, field, value) => {
  const attestationData = await storeAttestationFieldForUser(accountHash, field, value)
  store.dispatch(setAttestationData(attestationData))
  return attestationData
}

export const clearEncryptedAttestationDataForUser = async (accountHash) => {  
  const attestationData = await deleteAttestationDataForUser(accountHash)
  store.dispatch(setAttestationData({}))
  return attestationData
}

export const modifyAttestationDataForUser = async (data = {}, dataType, accountHash) => {
  try {
    if (!accountHash) {
      throw new Error('Account hash is required');
    }
    
    if (!dataType) {
      throw new Error('Data type is required');
    }
    
    let attestationData = {...(await loadAttestationDataForUser(accountHash))}
    
    // Validate data before stringifying
    if (data === null || data === undefined) {
      throw new Error('Data cannot be null or undefined');
    }
    
    // Get password once and reuse it
    const vaultKey = await requestVaultKey();
    
    // Get existing data for this dataType and merge with new data
    let existingTypeData = {};
    if (attestationData[dataType]) {
      try {
        const decryptedExisting = vaultDecrypt(vaultKey, attestationData[dataType], {
          accountHash,
          area: RECORD_AREA.ATTESTATION,
          field: dataType,
        });
        if (decryptedExisting !== false) {
          existingTypeData = JSON.parse(decryptedExisting);
        }
      } catch (decryptError) {
        console.warn(`Failed to decrypt/parse existing ${dataType} data, starting fresh:`, decryptError.message);
        existingTypeData = {};
      }
    }
    
    // Merge new data with existing data (new data takes precedence for duplicate keys)
    const mergedData = { ...existingTypeData, ...data };
    
    const jsonString = JSON.stringify(mergedData);
    if (!jsonString || jsonString === 'undefined' || jsonString === 'null') {
      throw new Error('Failed to stringify attestation data or resulted in invalid JSON');
    }
    
    // Verify we can parse it back
    try {
      JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error(`Data produces invalid JSON: ${parseError.message}`);
    }
    
    const encrypted = await vaultEncrypt(vaultKey, jsonString, {
      accountHash,
      area: RECORD_AREA.ATTESTATION,
      field: dataType,
    })
    await saveEncryptedAttestationFieldForUser(accountHash, dataType, encrypted)

    return mergedData
  } catch (error) {
    console.error('Error in modifyAttestationDataForUser:', error.message);
    throw new Error(`Failed to modify attestation data: ${error.message}`);
  }
}

export const replaceAttestationDataForUser = async (data = {}, dataType, accountHash) => {
  try {
    if (!accountHash) {
      throw new Error('Account hash is required');
    }
    
    if (!dataType) {
      throw new Error('Data type is required');
    }
    
    let attestationData = {...(await loadAttestationDataForUser(accountHash))}
    
    // Validate data before stringifying
    if (data === null || data === undefined) {
      throw new Error('Data cannot be null or undefined');
    }
    
    // Get password once and reuse it
    const vaultKey = await requestVaultKey();
    
    // Add timestamps to attestations that don't have them
    const dataWithTimestamps = {};
    Object.keys(data).forEach(key => {
      const attestation = data[key];
      if (attestation && typeof attestation === 'object') {
        // Check if attestation already has any timestamp field
        const hasTimestamp = attestation.date || 
                            attestation.timestamp || 
                            attestation.created_at || 
                            attestation.createdAt ||
                            attestation.dateReceived;
        
        if (!hasTimestamp) {
          // Add a timestamp with current date
          dataWithTimestamps[key] = {
            ...attestation,
            dateReceived: new Date().toISOString(),
            timestamp: Math.floor(Date.now() / 1000) // Unix timestamp
          };
        } else {
          dataWithTimestamps[key] = attestation;
        }
      } else {
        dataWithTimestamps[key] = attestation;
      }
    });
    
    // Replace the entire data for this dataType (no merging)
    const jsonString = JSON.stringify(dataWithTimestamps);
    if (!jsonString || jsonString === 'undefined' || jsonString === 'null') {
      throw new Error('Failed to stringify attestation data or resulted in invalid JSON');
    }
    
    // Verify we can parse it back
    try {
      JSON.parse(jsonString);
    } catch (parseError) {
      throw new Error(`Data produces invalid JSON: ${parseError.message}`);
    }
    
    const encrypted = await vaultEncrypt(vaultKey, jsonString, {
      accountHash,
      area: RECORD_AREA.ATTESTATION,
      field: dataType,
    })
    await saveEncryptedAttestationFieldForUser(accountHash, dataType, encrypted)

    return dataWithTimestamps
  } catch (error) {
    console.error('Error in replaceAttestationDataForUser:', error.message);
    throw new Error(`Failed to replace attestation data: ${error.message}`);
  }
}

export const initAttestationDataForUser = async (accountHash) => {
  try {
    const attestationData = await loadAttestationDataForUser(accountHash)
    store.dispatch(setAttestationData(attestationData))
    return attestationData
  } catch (error) {
    console.error('Failed to initialize attestation data, attempting to clear corrupted data:', error.message);
    const cleared = await clearCorruptedAttestationDataForUser(accountHash);
    if (cleared) {
      const defaultData = { attestations_provisioned: null };
      store.dispatch(setAttestationData(defaultData))
      return defaultData;
    } else {
      throw error;
    }
  }
}

export const clearCorruptedAttestationData = async (accountHash) => {
  const result = await clearCorruptedAttestationDataForUser(accountHash);
  if (result) {
    store.dispatch(setAttestationData({}));
  }
  return result;
}