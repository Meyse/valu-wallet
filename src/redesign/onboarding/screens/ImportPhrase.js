// R03 Import phrase (variation C) and R03b invalid word. Word 1 is focused when it opens.
// Side paths: "Scan QR" (R03c sheet, then R03d) and "Use a private key" (R03e).
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Camera} from 'react-native-vision-camera';
// Same clipboard API as the rest of the app (SendWizardRecipient, AddressBook).
import {Clipboard} from 'react-native';
import ValuButton, {TextLink} from '../../components/ValuButton';
import {DenseScreen, ErrorText, Heading, PillButton, TopBar} from '../../components/Layout';
import {Grid, Segmented, WordSlot} from '../../components/PhraseGrid';
import Sheet from '../../components/Sheet';
import Icon from '../../components/Icon';
import {checkPhrase, normalizeWord, parsePastedPhrase, placeWords} from '../../logic/importValidation';
import {ROUTES, nextRoute, progressFor} from '../../logic/steps';
import {useOnboarding} from '../OnboardingContext';

const SWITCH = [
  {value: 12, label: '12 words'},
  {value: 24, label: '24 words'},
];

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
    const status = await Camera.requestCameraPermission();
    if (status === 'granted') navigation.navigate(ROUTES.scanQr);
    else setDenied(true);
  };
  const element = (
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
  );
  return {open, element, denied};
}

export default function ImportPhrase({navigation}) {
  const ob = useOnboarding();
  const [count, setCount] = useState(12);
  const [words, setWords] = useState(() => Array(12).fill(''));
  const [focus, setFocus] = useState(0);
  const [pasteError, setPasteError] = useState(null);
  const refs = useRef([]);
  const camera = useCameraGate(navigation);

  useEffect(() => {
    const t = setTimeout(() => refs.current[0]?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const result = useMemo(() => checkPhrase(words), [words]);
  // A slot shows its error once the user has left it.
  const shownUnknown = result.unknownIndexes.filter(i => i !== focus);
  const allFilled = words.every(w => normalizeWord(w).length > 0);

  let error = null;
  if (pasteError) error = pasteError;
  else if (shownUnknown.length > 0) {
    error = `Word ${shownUnknown[0] + 1} is not a valid word. Check the spelling.`;
  } else if (allFilled && result.status === 'checksum') {
    error = 'These words are not a valid recovery phrase. Check each word and the order.';
  }

  const setLength = n => {
    setCount(n);
    setWords(prev => Array.from({length: n}, (_, i) => prev[i] ?? ''));
    setPasteError(null);
    if (focus >= n) setFocus(n - 1);
  };

  const fill = list => {
    setCount(list.length);
    setWords(list);
    setPasteError(null);
    refs.current[list.length - 1]?.blur();
    setFocus(-1);
  };

  const onChange = (i, text) => {
    setPasteError(null);
    const pasted = parsePastedPhrase(text);
    if (pasted && text.trim().includes(' ')) {
      fill(pasted);
      return;
    }
    // A space or a line break ends the word and moves to the next slot. Words that do not fit are
    // refused, never dropped: a cut phrase can pass the checksum and open a different wallet.
    if (/\s/.test(text) && text.trim().length > 0) {
      const placed = placeWords(words, i, text);
      if (placed.overflow) {
        setPasteError(`The copied text has ${placed.overflow} words. Only ${count - i} fit from word ${i + 1}.`);
        return;
      }
      setWords(placed.words);
      refs.current[placed.focus]?.focus();
      return;
    }
    setWords(prev => prev.map((w, k) => (k === i ? text.replace(/\s/g, '').toLowerCase() : w)));
  };

  const paste = async () => {
    let text = '';
    try {
      text = await Clipboard.getString();
    } catch (e) {
      text = '';
    }
    const list = parsePastedPhrase(text);
    if (list) fill(list);
    else setPasteError('The copied text is not a recovery phrase of 12 to 24 words.');
  };

  const next = () => {
    if (result.status !== 'valid') return;
    ob.setSecret(result.phrase);
    navigation.navigate(nextRoute('import', ROUTES.importPhrase));
  };

  return (
    <>
      <DenseScreen
        topBar={
          <TopBar
            onBack={() => navigation.goBack()}
            progress={progressFor('import', ROUTES.importPhrase)}
            right={<PillButton icon="scanQr" label="Scan QR" onPress={camera.open} testID="import-scan-qr" />}
          />
        }
        footer={
          <ValuButton
            label="Continue"
            onPress={next}
            disabled={result.status !== 'valid'}
            testID="import-continue"
          />
        }>
        <View style={styles.content}>
          <Heading title="Enter your phrase" body="Type each word in order, or paste the phrase." />
          <Segmented options={SWITCH} value={count} onChange={setLength} />
          <View>
            <Grid>
              {words.map((w, i) => (
                <WordSlot
                  key={`${count}-${i}`}
                  ref={el => (refs.current[i] = el)}
                  index={i}
                  value={w}
                  focused={focus === i}
                  error={shownUnknown.includes(i)}
                  onChangeText={text => onChange(i, text)}
                  onFocus={() => setFocus(i)}
                  onBlur={() => setFocus(f => (f === i ? -1 : f))}
                  onSubmit={() => (i < count - 1 ? refs.current[i + 1]?.focus() : next())}
                  last={i === count - 1}
                />
              ))}
            </Grid>
            <ErrorText>{camera.denied ? 'Camera access is off. Turn it on in Settings to scan a QR code.' : error}</ErrorText>
          </View>
          <View style={styles.links}>
            <TextLink label="Paste phrase" onPress={paste} testID="import-paste" />
            <TextLink
              label="Use a private key"
              onPress={() => navigation.navigate(ROUTES.importKey)}
              testID="import-use-key"
            />
          </View>
        </View>
      </DenseScreen>
      {camera.element}
    </>
  );
}

const styles = StyleSheet.create({
  content: {gap: 24},
  links: {flexDirection: 'row', justifyContent: 'center', gap: 24, height: 44},
});
