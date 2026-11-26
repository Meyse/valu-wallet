// Backup words 07 - Verify words and its Wrong word state (Paper p-5-0). Moved from the v1
// onboarding (R12, R13). 3 positions, 4 choices each. The result shows after "Finish backup"; a
// wrong pick locks the picks and offers "Show words again". A right answer records the backup.
import React, {useMemo, useState} from 'react';
import {markBackedUp} from '../../state/backupState';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import ValuButton from '../../components/ValuButton';
import {DenseScreen, ErrorText, Heading, StepList, TopBar} from '../../components/Layout';
import StepIcon from '../../components/StepIcons';
import {createVerifyQuestions, findVerifyMismatches} from '../../logic/verify';
import {colors, type} from '../../theme/tokens';
import {BACKUP_ROUTES, BACKUP_STEPS, useBackup} from '../BackupContext';
import BackupDone from './BackupDone';
import useSecureScreen from '../../components/useSecureScreen';

// true: the step list with the done steps and the icon; the screen scrolls ("Alternative - Backup
// words 07 - step list, scrolls", the default). false: the title only ("Backup words 07 - Verify
// words"), with no icon and no list.
const SHOW_STEP_LIST = true;

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
  useSecureScreen();
  const {phrase, accountHash, setPhrase, finish} = useBackup();
  const words = useMemo(() => phrase ?? [], [phrase]);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [done, setDone] = useState(false);
  const [round, setRound] = useState(0);
  // New questions each time the user comes back from "Show words again".
  const questions = useMemo(() => createVerifyQuestions(words), [words, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picks, setPicks] = useState(() => questions.map(() => null));
  const [mismatches, setMismatches] = useState(null);
  const failed = mismatches?.some(Boolean);

  const check = async () => {
    const result = findVerifyMismatches(words, questions, picks);
    if (result.some(Boolean)) {
      setMismatches(result);
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    try {
      await markBackedUp(accountHash, 'words');
      // The words are no longer needed in memory.
      setPhrase(null);
      setDone(true);
    } catch (e) {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const again = () => {
    setMismatches(null);
    setRound(r => r + 1);
    setPicks(questions.map(() => null));
    // Back to the phrase screen already in the stack (React Navigation 7 navigate would push a new one).
    navigation.popTo(BACKUP_ROUTES.words, {page: 0, at: Date.now()});
  };

  const firstWrong = failed ? mismatches.findIndex(Boolean) : -1;

  return (
    <DenseScreen
      topBar={<TopBar onBack={() => navigation.goBack()} />}
      footer={
        failed ? (
          <ValuButton label="Show words again" onPress={again} testID="verify-again" />
        ) : (
          <ValuButton
            label="Finish backup"
            onPress={check}
            loading={saving}
            disabled={picks.some(p => p == null) || done}
            testID="verify-finish"
          />
        )
      }>
      <StepList done={SHOW_STEP_LIST ? BACKUP_STEPS.words.slice(0, 2) : []}>
        <View style={styles.content}>
          <Heading
            icon={SHOW_STEP_LIST ? <StepIcon name="verify" /> : undefined}
            title="Verify your phrase"
            body="Choose each word from your written phrase."
          />
          {saveFailed ? <ErrorText>The app could not save the backup. Try again.</ErrorText> : null}
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
      </StepList>
      <BackupDone
        visible={done}
        title="Wallet backed up"
        body="If you lose this phone, use your recovery phrase to restore your wallet."
        onDone={finish}
      />
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
