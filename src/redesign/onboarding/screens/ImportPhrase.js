// Import phrase 03 - Enter phrase, and its invalid-word state. Word 1 is focused when it opens.
// Opened from the import sheet on Welcome. "Use a private key" opens 03b. Scan QR lives on the sheet.
import React, {useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
// Same clipboard API as the rest of the app (SendWizardRecipient, AddressBook).
import {Clipboard} from 'react-native';
import ValuButton, {TextLink} from '../../components/ValuButton';
import {DenseScreen, ErrorText, Heading, TopBar, useFocusOnArrival} from '../../components/Layout';
import {Grid, Segmented, WordSlot} from '../../components/PhraseGrid';
import {checkPhrase, normalizeWord, parsePastedPhrase, placeWords} from '../../logic/importValidation';
import {ROUTES, nextRoute, progressFor} from '../../logic/steps';
import {useOnboarding} from '../OnboardingContext';

const SWITCH = [
  {value: 12, label: '12 words'},
  {value: 24, label: '24 words'},
];

export default function ImportPhrase({navigation}) {
  const ob = useOnboarding();
  const [count, setCount] = useState(12);
  const [words, setWords] = useState(() => Array(12).fill(''));
  const [focus, setFocus] = useState(0);
  const [pasteError, setPasteError] = useState(null);
  const refs = useRef([]);

  useFocusOnArrival(() => refs.current[0]?.focus());

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
    // The selected length again changes nothing: it must not clear a refused-paste error.
    if (n === count) return;
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
    // A full phrase in one slot (any whitespace: spaces, tabs, line breaks) replaces the grid.
    const pasted = parsePastedPhrase(text);
    if (pasted) {
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

  // A refused paste leaves the earlier words in the grid: they must not go on as the phrase.
  const canContinue = result.status === 'valid' && !pasteError;

  const next = () => {
    if (!canContinue) return;
    ob.setSecret(result.phrase);
    navigation.navigate(nextRoute('import', ROUTES.importPhrase));
  };

  return (
    <DenseScreen
        topBar={
          <TopBar
            onBack={() => navigation.goBack()}
            progress={progressFor('import', ROUTES.importPhrase)}
          />
        }
        footer={
          <ValuButton
            label="Continue"
            onPress={next}
            disabled={!canContinue}
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
            <ErrorText>{error}</ErrorText>
          </View>
          <View style={styles.links}>
            <TextLink label="Paste" onPress={paste} testID="import-paste" />
            <TextLink
              label="Use a private key"
              onPress={() => navigation.navigate(ROUTES.importKey)}
              testID="import-use-key"
            />
          </View>
        </View>
    </DenseScreen>
  );
}

const styles = StyleSheet.create({
  content: {gap: 24},
  links: {flexDirection: 'row', justifyContent: 'center', gap: 32, height: 44},
});
