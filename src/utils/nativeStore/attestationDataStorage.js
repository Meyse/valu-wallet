var RNFS = require('react-native-fs');
import { ATTESTATION_DATA_STORAGE_INTERNAL_KEY } from '../../../env/index'

// Add a simple mutex to prevent concurrent file operations
let isWriting = false;
const writeQueue = [];

const backupPathFor = finalFilePath => `${finalFilePath}.bak`;

// Replaces the live file with the temp file so that a crash at any step
// leaves a readable copy: the live file, or its backup (old data) until the
// new file is in place. iOS cannot move onto an existing file, so the live
// file moves to the backup first; loadAttestationData reads the backup when
// the live file is missing.
const replaceWithBackup = async (tempFilePath, finalFilePath) => {
  const backupFilePath = backupPathFor(finalFilePath);
  const liveExists = await RNFS.exists(finalFilePath);
  const backupExists = await RNFS.exists(backupFilePath);

  if (!liveExists && backupExists) {
    // A previous replace stopped after the live file moved away: the backup
    // is the only copy. Put it back before anything else.
    await RNFS.moveFile(backupFilePath, finalFilePath);
  } else if (backupExists) {
    await RNFS.unlink(backupFilePath);
  }

  const hasLive = await RNFS.exists(finalFilePath);
  if (hasLive) await RNFS.moveFile(finalFilePath, backupFilePath);

  try {
    await RNFS.moveFile(tempFilePath, finalFilePath);
  } catch (moveError) {
    if (hasLive) {
      try {
        await RNFS.moveFile(backupFilePath, finalFilePath);
      } catch (restoreError) {
        // The backup stays; the reader uses it while the live file is missing.
        console.warn('Failed to restore attestation data backup:', restoreError.message);
      }
    }
    try {
      await RNFS.unlink(tempFilePath);
    } catch (cleanupError) {
      console.warn('Failed to clean up temp file:', cleanupError);
    }
    throw moveError;
  }

  if (hasLive) {
    try {
      await RNFS.unlink(backupFilePath);
    } catch (cleanupError) {
      // A stale backup is harmless: the live file exists and wins.
    }
  }
};

const processWriteQueue = async () => {
  if (isWriting || writeQueue.length === 0) return;
  
  isWriting = true;
  const { data, resolve, reject } = writeQueue.shift();
  
  try {
    const jsonString = JSON.stringify(data);
    
    // Write to a temporary file first, then rename to avoid corruption
    const tempFilePath = RNFS.DocumentDirectoryPath + `/${ATTESTATION_DATA_STORAGE_INTERNAL_KEY}.tmp`;
    const finalFilePath = RNFS.DocumentDirectoryPath + `/${ATTESTATION_DATA_STORAGE_INTERNAL_KEY}.txt`;
    
    await RNFS.writeFile(tempFilePath, jsonString, 'utf8');
    await replaceWithBackup(tempFilePath, finalFilePath);
    
    resolve(data);
  } catch (error) {
    reject(new Error(`Failed to store attestation data: ${error.message}`));
  } finally {
    isWriting = false;
    // Process next item in queue
    setImmediate(processWriteQueue);
  }
};

export const storeAttestationData = (data) => {
  if (typeof data !== 'object') throw new Error(`Attestation data store function expected object, received ${typeof data}`)

  return new Promise((resolve, reject) => {
    // Add to write queue to prevent concurrent writes
    writeQueue.push({ data, resolve, reject });
    processWriteQueue();
  });
};

const readAttestationFile = async () => {
  const finalFilePath = RNFS.DocumentDirectoryPath + `/${ATTESTATION_DATA_STORAGE_INTERNAL_KEY}.txt`;
  try {
    return await RNFS.readFile(finalFilePath, "utf8");
  } catch (err) {
    // A replace stopped after the live file moved to its backup.
    if (err.code === 'ENOENT' && await RNFS.exists(backupPathFor(finalFilePath))) {
      return RNFS.readFile(backupPathFor(finalFilePath), "utf8");
    }
    throw err;
  }
};

export const loadAttestationData = () => {
  return new Promise((resolve, reject) => {
    readAttestationFile()
      .then(res => {
        if (!res || res.trim() === '') {
          resolve({});
        } else {
          try {
            // Try to detect obviously corrupted data
            const trimmedRes = res.trim();
            if (!trimmedRes.startsWith('{') || !trimmedRes.endsWith('}')) {
              throw new Error('Data does not appear to be valid JSON object');
            }
            
            const _res = JSON.parse(trimmedRes);
            
            // Validate that it's an object
            if (typeof _res !== 'object' || _res === null || Array.isArray(_res)) {
              throw new Error('Parsed data is not a valid object');
            }
            
            resolve(_res);
          } catch (parseError) {
            console.error('Failed to parse attestation data JSON:', parseError.message);
            console.error('Corrupted data preview:', res.substring(0, 500) + (res.length > 500 ? '...' : ''));
            reject(new Error(`Failed to parse attestation data: ${parseError.message}`));
          }
        }
      })
      .catch(err => {
        if (err.code === 'ENOENT') {
          resolve({});
        } else {
          reject(err);
        }
      });
  })
};

export const clearAllAttestationData = () => {
  const finalFilePath = RNFS.DocumentDirectoryPath + `/${ATTESTATION_DATA_STORAGE_INTERNAL_KEY}.txt`;
  return new Promise((resolve, reject) => {
    RNFS.unlink(finalFilePath)
      .then(async () => {
        // Remove a backup too, or the reader would bring the old data back.
        if (await RNFS.exists(backupPathFor(finalFilePath))) {
          await RNFS.unlink(backupPathFor(finalFilePath));
        }
        resolve();
      })
      .catch(err => reject(err));
  })
};

export const storeAttestationDataForUser = async (data, accountHash) => {
  let allAttestationData = { ...(await loadAttestationData()) }
  allAttestationData[accountHash] = data
  return (await storeAttestationData(allAttestationData))[accountHash]
}

export const deleteAttestationDataForUser = async (accountHash) => {
  let allAttestationData = { ...(await loadAttestationData()) }
  delete allAttestationData[accountHash]
  await storeAttestationData(allAttestationData)
  return undefined // Return undefined since the data was deleted
}

export const loadAttestationDataForUser = async (accountHash) => {
  try {
    const allAttestationData = await loadAttestationData()

    if (allAttestationData[accountHash] == null)
      return {
        attestations_provisioned: null
      };
    else return allAttestationData[accountHash];
  } catch (error) {
    console.error('Failed to load attestation data for user, returning default:', error.message);
    return {
      attestations_provisioned: null
    };
  }
};

export const clearCorruptedAttestationDataForUser = async (accountHash) => {
  try {
    let allAttestationData = { ...(await loadAttestationData()) }
    delete allAttestationData[accountHash]
    await storeAttestationData(allAttestationData)
    console.log(`Cleared corrupted attestation data for user: ${accountHash}`);
    return true;
  } catch (error) {
    console.error('Failed to clear corrupted attestation data:', error.message);
    
    // If we can't clear just the user's data, try to recreate the entire file
    try {
      console.warn('Attempting to recreate attestation data file...');
      await storeAttestationData({});
      console.log('Successfully recreated empty attestation data file');
      return true;
    } catch (recreateError) {
      console.error('Failed to recreate attestation data file:', recreateError.message);
      return false;
    }
  }
};
