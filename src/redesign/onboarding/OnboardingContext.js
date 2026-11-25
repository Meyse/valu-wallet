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
  const creationStarted = useRef(false);

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
      creationStarted,
      background,
      reset: () => {
        setSecret(null);
        setPassword('');
        setUseBiometrics(false);
        creationStarted.current = false;
      },
    }),
    [path, secret, password, useBiometrics, testProfile, biometry, background],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export const useOnboarding = () => useContext(OnboardingContext);

// The one wallet has one fixed internal profile name. Users never see or set it.
export const WALLET_PROFILE_NAME = 'Valu Wallet';
