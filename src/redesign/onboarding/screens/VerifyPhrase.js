// R12 Verify phrase and R13 wrong word. 3 positions, 4 choices each. The result shows after
// "Create wallet"; a wrong pick locks the picks and offers "Show words again".
import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import ValuButton from '../../components/ValuButton';
import {DenseScreen, ErrorText, Heading, TopBar} from '../../components/Layout';
import {createVerifyQuestions, findVerifyMismatches} from '../../logic/verify';
import {ROUTES, nextRoute, progressFor} from '../../logic/steps';
import {colors, type} from '../../theme/tokens';
import {useOnboarding} from '../OnboardingContext';

function Chip({word, selected, wrong, onPress, disabled}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{selected, disabled}}
      testID={`verify-chip-${word}`}
      style={[styles.chip, selected && styles.chipOn, wrong && styles.chipWrong]}>
      <Text style={[selected || wrong ? type.label : type.bodyLarge, {color: colors.text}]}>{word}</Text>
    </Pressable>
  );
}

export default function VerifyPhrase({navigation}) {
  const ob = useOnboarding();
  const words = useMemo(() => (ob.secret ?? '').split(' ').filter(Boolean), [ob.secret]);
  const [round, setRound] = useState(0);
  // New questions each time the user comes back from "Show words again".
  const questions = useMemo(() => createVerifyQuestions(words), [words, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picks, setPicks] = useState(() => questions.map(() => null));
  const [mismatches, setMismatches] = useState(null);
  const failed = mismatches?.some(Boolean);

  const check = () => {
    const result = findVerifyMismatches(words, questions, picks);
    if (result.some(Boolean)) {
      setMismatches(result);
      return;
    }
    navigation.navigate(nextRoute('create', ROUTES.verify));
  };

  const again = () => {
    setMismatches(null);
    setRound(r => r + 1);
    setPicks(questions.map(() => null));
    // Back to the phrase screen already in the stack (React Navigation 7 navigate would push a new one).
    navigation.popTo(ROUTES.phrase, {page: 0, at: Date.now()});
  };

  const firstWrong = failed ? mismatches.findIndex(Boolean) : -1;

  return (
    <DenseScreen
      topBar={<TopBar onBack={() => navigation.goBack()} progress={progressFor('create', ROUTES.verify)} />}
      footer={
        failed ? (
          <ValuButton label="Show words again" onPress={again} testID="verify-again" />
        ) : (
          <ValuButton
            label="Create wallet"
            onPress={check}
            disabled={picks.some(p => p == null)}
            testID="verify-create"
          />
        )
      }>
      <View style={styles.content}>
        <Heading title="Verify your phrase" body="Choose each word from your written phrase." />
        <View style={styles.groups}>
          {questions.map((q, qi) => {
            const wrongHere = failed && mismatches[qi];
            const dim = failed && !wrongHere;
            const rows = [q.options.slice(0, 2), q.options.slice(2, 4)];
            return (
              <View key={`${round}-${qi}`} style={[styles.group, dim && {opacity: 0.4}]} accessibilityRole="radiogroup">
                <Text style={[type.bodyStrong, {color: colors.textSecondary}]}>{`Word ${q.index + 1}`}</Text>
                <View style={styles.rows}>
                  {rows.map((row, ri) => (
                    <View key={ri} style={styles.row}>
                      {row.map(word => (
                        <Chip
                          key={word}
                          word={word}
                          selected={!wrongHere && picks[qi] === word}
                          wrong={wrongHere && picks[qi] === word}
                          disabled={failed}
                          onPress={() => setPicks(p => p.map((v, i) => (i === qi ? word : v)))}
                        />
                      ))}
                    </View>
                  ))}
                </View>
                {qi === firstWrong ? (
                  <ErrorText>{`This is not word ${q.index + 1}. Check your written phrase.`}</ErrorText>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </DenseScreen>
  );
}

const styles = StyleSheet.create({
  content: {gap: 32},
  groups: {gap: 24},
  group: {gap: 12},
  rows: {gap: 8},
  row: {flexDirection: 'row', gap: 8},
  chip: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fillSubtle,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipOn: {backgroundColor: '#FFFFFF1A', borderColor: colors.text},
  chipWrong: {backgroundColor: '#FF6B6B1A', borderColor: colors.error},
});
