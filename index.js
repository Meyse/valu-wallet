/** @format */
import 'react-native-gesture-handler';
import { AppRegistry, LogBox } from 'react-native';

const IGNORED_LOGS = [
  'Warning: componentWillMount is deprecated',
  'Warning: componentWillReceiveProps is deprecated',
  'Warning: componentWillUpdate is deprecated',
  'RCTRootView cancelTouches',
  'Require cycle',
  'long period',
  'Material Top Tab Navigator:',
  'ViewPropTypes will be removed from React Native.',
  'Non-serializable values were found in the navigation state.'
];

LogBox.ignoreLogs(IGNORED_LOGS);

import 'fast-text-encoding';
import './shims/crypto.js';
import './shims/buffer.js';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

// Debug builds: check the native KDF and AES-GCM against published vectors
// and log one VAULT_KAT result line (src/utils/crypto/kdfSelfTest.js).
if (__DEV__) {
  setTimeout(() => {
    require('./src/utils/crypto/kdfSelfTest').logKdfSelfTest().catch(() => {
      console.log('VAULT_KAT FAILED to run');
    });
  }, 0);
}
