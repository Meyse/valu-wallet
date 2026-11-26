// The check the app makes today before it shows the recovery phrase (Profile settings, "Recover
// seed": PasswordCheck): Face ID or Touch ID when the wallet uses it, else the wallet password.
// Both end in checkPinForUser, which decrypts the stored seeds with the password. The seeds and the
// password are returned to the caller only; nothing is logged or stored.
import React, {useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useSelector} from 'react-redux';
import Sheet from '../components/Sheet';
import Icon from '../components/Icon';
import PasswordPill from '../components/PasswordPill';
import {ErrorText} from '../components/Layout';
import {checkPinForUser} from '../../utils/asyncStore/authDataStorage';
import {getBiometricPassword} from '../../utils/keychain/biometrics';
import {getSupportedBiometryType} from '../../utils/keychain/keychain';

const PROMPT = 'Show your recovery phrase';

export function useWalletAuth({title = 'Enter your password', body} = {}) {
  const account = useSelector(state => state.authentication.activeAccount);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const pending = useRef(null);

  const settle = result => {
    const resolve = pending.current;
    pending.current = null;
    setOpen(false);
    setPassword('');
    setError(false);
    resolve?.(result);
  };

  const check = async pw => {
    const seeds = await checkPinForUser(pw, account.id, false);
    return {seeds, password: pw};
  };

  // Resolves {seeds, password}, or null when the user cancels.
  const ask = async () => {
    if (!account) return null;
    if (account.biometry) {
      try {
        const supported = await getSupportedBiometryType();
        if (supported?.biometry) {
          const pw = await getBiometricPassword(account.accountHash, PROMPT);
          if (pw != null) return await check(pw);
        }
      } catch (e) {
        // A cancel or a missing biometric store: ask for the password.
      }
    }
    return new Promise(resolve => {
      pending.current = resolve;
      setOpen(true);
    });
  };

  const submit = async () => {
    if (checking || password.length === 0) return;
    setChecking(true);
    try {
      settle(await check(password));
    } catch (e) {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  const element = (
    <Sheet
      visible={open}
      onClose={() => settle(null)}
      icon={<Icon name="shieldAlert" />}
      title={title}
      body={body ?? 'Enter the password of this wallet to continue.'}
      testID="wallet-auth-sheet"
      buttons={[
        {label: 'Continue', variant: 'accent', onPress: submit, loading: checking, disabled: password.length === 0, testID: 'wallet-auth-continue'},
        {label: 'Cancel', onPress: () => settle(null), testID: 'wallet-auth-cancel'},
      ]}>
      <View style={styles.field}>
        <PasswordPill
          value={password}
          onChangeText={t => {
            setPassword(t);
            setError(false);
          }}
          label="Password"
          error={error}
          editable={!checking}
          onSubmitEditing={submit}
          testID="wallet-auth-input"
        />
        <ErrorText>{error ? 'This password is not right. Try again.' : null}</ErrorText>
      </View>
    </Sheet>
  );

  return {ask, element};
}

const styles = StyleSheet.create({field: {gap: 8}});
