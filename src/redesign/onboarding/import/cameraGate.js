// Camera permission before the QR scanner (Import QR 03 - Camera access): an in-app sheet first,
// then the system prompt. Used by the import sheet on Welcome.
import React, {useState} from 'react';
import {Linking} from 'react-native';
import {Camera} from 'react-native-vision-camera';
import Sheet from '../../components/Sheet';
import Icon from '../../components/Icon';
import {ROUTES} from '../../logic/steps';

export function useCameraGate(navigation) {
  const [sheet, setSheet] = useState(false);
  const [denied, setDenied] = useState(false);
  const open = async () => {
    setDenied(false);
    if (Camera.getCameraPermissionStatus() === 'granted') {
      navigation.navigate(ROUTES.scanQr);
    } else {
      setSheet(true);
    }
  };
  const allow = async () => {
    setSheet(false);
    // The system prompt shows once; after a refusal it returns at once.
    await new Promise(r => setTimeout(r, 320));
    const status = await Camera.requestCameraPermission();
    if (status === 'granted') navigation.navigate(ROUTES.scanQr);
    else setDenied(true);
  };
  const element = (
    <>
      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        icon={<Icon name="camera" />}
        title="Allow camera access"
        body="Valu Wallet uses the camera only to read the QR code of your phrase or key."
        testID="camera-sheet"
        buttons={[
          {label: 'Allow camera', variant: 'accent', onPress: allow, testID: 'camera-allow'},
          {label: 'Not now', onPress: () => setSheet(false), testID: 'camera-not-now'},
        ]}
      />
      <Sheet
        visible={denied}
        onClose={() => setDenied(false)}
        icon={<Icon name="camera" />}
        title="Camera access is off"
        body="Turn it on in Settings to scan a QR code."
        testID="camera-denied-sheet"
        buttons={[
          {
            label: 'Open Settings',
            variant: 'accent',
            testID: 'camera-settings',
            onPress: () => {
              setDenied(false);
              Linking.openSettings();
            },
          },
          {label: 'Close', onPress: () => setDenied(false), testID: 'camera-denied-close'},
        ]}
      />
    </>
  );
  return {open, element};
}
