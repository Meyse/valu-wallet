// R03d Scan QR code: camera view, dim overlay with a 218 x 218 window, corner marks, close mark
// and one hint line. A valid phrase or key goes on to the password step.
import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {Camera, useCameraDevice, useCodeScanner} from 'react-native-vision-camera';
import Svg, {Path} from 'react-native-svg';
import {BackButton, FadeView, useTopBarTop} from '../../components/Layout';
import {classifyScannedText} from '../../logic/importValidation';
import {ROUTES, nextRoute} from '../../logic/steps';
import {colors, type} from '../../theme/tokens';
import {useOnboarding} from '../OnboardingContext';

const WINDOW = 218;

function Corner({style, rotate}) {
  return (
    <Svg width={18} height={18} style={[styles.corner, style, {transform: [{rotate}]}]}>
      <Path d="M1.5 18V5.5A4 4 0 0 1 5.5 1.5H18" stroke="#FFFFFF" strokeWidth={3} fill="none" />
    </Svg>
  );
}

export default function ScanQr({navigation}) {
  const ob = useOnboarding();
  const focused = useIsFocused();
  const device = useCameraDevice('back');
  const top = useTopBarTop();
  const {width, height} = useWindowDimensions();
  const [error, setError] = useState(null);
  const handled = useRef(false);
  // Back from the password step returns here: scan again.
  useEffect(() => {
    if (focused) handled.current = false;
  }, [focused]);

  const scanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (handled.current) return;
      // Only one code at a time: with two codes in view, the wallet read could be the wrong one.
      if (codes?.length > 1) {
        setError('More than one QR code is in view. Show one code only.');
        return;
      }
      const value = codes?.[0]?.value;
      if (!value) return;
      const found = classifyScannedText(value);
      if (found.kind === 'invalid') {
        setError('This QR code has no recovery phrase or key.');
        return;
      }
      handled.current = true;
      ob.setSecret(found.secret);
      navigation.navigate(nextRoute('import', ROUTES.scanQr));
    },
  });

  // Window position: centred, as in Paper (x 92, y 328 on 402 x 874).
  const left = (width - WINDOW) / 2;
  const winTop = Math.round(height * (328 / 874));

  return (
    <View style={styles.flex} testID="scan-qr">
      <FadeView style={styles.root}>
      {device && focused ? (
        <Camera style={StyleSheet.absoluteFill} device={device} isActive={focused} codeScanner={scanner} />
      ) : null}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path
          fillRule="evenodd"
          fill="#000000"
          opacity={0.5}
          d={`M0 0H${width}V${height}H0Z M${left} ${winTop}V${winTop + WINDOW}H${left + WINDOW}V${winTop}Z`}
        />
      </Svg>
      <Corner style={{left, top: winTop}} rotate="0deg" />
      <Corner style={{left: left + WINDOW - 18, top: winTop}} rotate="90deg" />
      <Corner style={{left: left + WINDOW - 18, top: winTop + WINDOW - 18}} rotate="180deg" />
      <Corner style={{left, top: winTop + WINDOW - 18}} rotate="270deg" />
      <Text
        style={[type.bodyLarge, styles.hint, {top: winTop + WINDOW + 54}, error && {color: colors.error}]}
        accessibilityLiveRegion="polite">
        {error ?? (device ? 'Hold the QR code inside the frame.' : 'No camera found on this device.')}
      </Text>
      </FadeView>
      <View style={[styles.close, {top}]}>
        <BackButton onPress={() => navigation.goBack()} icon="close" label="Close" testID="scan-close" ownGlass />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  root: {...StyleSheet.absoluteFillObject, backgroundColor: colors.surfaceRaised},
  corner: {position: 'absolute'},
  hint: {position: 'absolute', left: 36, right: 36, textAlign: 'center', color: colors.textSecondary},
  close: {position: 'absolute', left: 20},
});
