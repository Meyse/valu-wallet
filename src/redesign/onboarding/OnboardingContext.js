// In-memory state of one onboarding run. The phrase, key and password live only here,
// in React state, until createProfileFromSeed encrypts them. Nothing is persisted or logged.
import React, {createContext, useContext, useMemo, useRef, useState} from 'react';

const OnboardingContext = createContext(null);

export function OnboardingProvider({children, background}) {
  const [path, setPath] = useState('create'); // 'create' | 'import'
  const [secret, setSecret] = useState(null); // recovery phrase or private key
  const [password, setPassword] = useState('');
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [testProfile, setTestProfile] = useState(false);
  const [biometry, setBiometry] = useState(null); // result of getSupportedBiometryType()
  // NFC import: the encrypted chip record until its password opens it, and whether the phrase
  // from the chip also gives the shielded (Z) seed (as the old NFC import).
  const [nfcBackup, setNfcBackup] = useState(null);
  const [seedHasZ, setSeedHasZ] = useState(false);
  // Cloud import: the backup file found in the cloud until its password opens it, then the id of
  // the opened backup. Creating records that id, so a later backup replaces the same file.
  const [cloudBackup, setCloudBackup] = useState(null);
  const [cloudBackupId, setCloudBackupId] = useState(null);
  const creationStarted = useRef(false);
  // Set when a lane goes back to Welcome: Welcome opens the import sheet again.
  const sheetReturn = useRef(false);

  const value = useMemo(
    () => ({
      path,
      setPath,
      secret,
      setSecret,
      password,
      setPassword,
      useBiometrics,
      setUseBiometrics,
      testProfile,
      setTestProfile,
      biometry,
      setBiometry,
      nfcBackup,
      setNfcBackup,
      seedHasZ,
      setSeedHasZ,
      cloudBackup,
      setCloudBackup,
      cloudBackupId,
      setCloudBackupId,
      creationStarted,
      sheetReturn,
      background,
      reset: () => {
        setSecret(null);
        setPassword('');
        setUseBiometrics(false);
        setNfcBackup(null);
        setSeedHasZ(false);
        setCloudBackup(null);
        setCloudBackupId(null);
        creationStarted.current = false;
      },
    }),
    [
      path,
      secret,
      password,
      useBiometrics,
      testProfile,
      biometry,
      nfcBackup,
      seedHasZ,
      cloudBackup,
      cloudBackupId,
      background,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export const useOnboarding = () => useContext(OnboardingContext);

// The one wallet has one fixed internal profile name. Users never see or set it.
export const WALLET_PROFILE_NAME = 'Valu Wallet';
