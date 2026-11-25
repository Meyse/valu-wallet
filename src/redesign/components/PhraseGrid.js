// Recovery phrase grid (R03, R11): 2 columns, gap 8, slot H52, radius 24, fill #00000052.
import React, {forwardRef} from 'react';
import {Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {colors, radius, type} from '../theme/tokens';

const NO_AUTOFILL = Platform.select({
  ios: {textContentType: 'none', spellCheck: false, autoCorrect: false},
  default: {
    autoComplete: 'off',
    importantForAutofill: 'no',
    autoCorrect: false,
    // Keeps the Android keyboard from learning or suggesting the words.
    keyboardType: 'visible-password',
  },
});

const Number = ({n}) => <Text style={[type.body, styles.number]}>{n}</Text>;

export const WordSlot = forwardRef(function WordSlot(
  {index, value, focused, error, onChangeText, onFocus, onBlur, onSubmit, editable = true, last},
  ref,
) {
  return (
    <Pressable
      onPress={() => ref?.current?.focus()}
      style={[styles.slot, focused && styles.focused, error && styles.error]}
      accessible={false}>
      <Number n={index + 1} />
      <TextInput
        ref={ref}
        value={value}
        editable={editable}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmit}
        submitBehavior="submit"
        returnKeyType={last ? 'done' : 'next'}
        autoCapitalize="none"
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        accessibilityLabel={`Word ${index + 1}`}
        style={[type.label, styles.input]}
        testID={`phrase-word-${index + 1}`}
        {...NO_AUTOFILL}
      />
    </Pressable>
  );
});

export function WordCell({index, word}) {
  return (
    <View style={styles.slot} accessible accessibilityLabel={`Word ${index + 1}, ${word}`}>
      <Number n={index + 1} />
      <Text style={[type.label, styles.word]} testID={`phrase-shown-${index + 1}`}>
        {word}
      </Text>
    </View>
  );
}

// Lays out children two per row.
export function Grid({children}) {
  const items = React.Children.toArray(children);
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row}
        </View>
      ))}
    </View>
  );
}

// Pill-outline switch (R03): "12 words" / "24 words".
export function Segmented({options, value, onChange}) {
  return (
    <View style={styles.seg} accessibilityRole="radiogroup">
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{selected: on}}
            testID={`segment-${o.value}`}
            style={[styles.segItem, on && styles.segOn]}>
            <Text style={[on ? type.bodyStrong : type.body, {color: on ? colors.text : colors.textSecondary}]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {gap: 8},
  row: {flexDirection: 'row', gap: 8},
  slot: {
    flex: 1,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.fillSubtle,
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  focused: {borderColor: colors.accent},
  error: {borderColor: colors.error, backgroundColor: '#FF6B6B1A'},
  number: {width: 20, color: colors.textSecondary, opacity: 0.6, fontVariant: ['tabular-nums']},
  input: {flex: 1, color: colors.text, padding: 0, margin: 0, height: 50},
  word: {flex: 1, color: colors.text},
  seg: {
    height: 56,
    padding: 5,
    gap: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
  },
  segItem: {
    flex: 1,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segOn: {backgroundColor: '#FFFFFF1A', borderColor: colors.text},
});
