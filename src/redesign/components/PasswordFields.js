// The password field and the four-level strength meter (Paper "Strength meter", p-6-0). Shared by
// onboarding Create password (Create 03) and the cloud backup password (Backup iCloud 05).
import React, {useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useRevealOnFocus} from './Layout';
import Icon from './Icon';
import {colors, type} from '../theme/tokens';

const PASSWORD_PROPS = Platform.select({
  ios: {textContentType: 'oneTimeCode', spellCheck: false, autoCorrect: false},
  default: {autoComplete: 'off', importantForAutofill: 'no', textContentType: 'none', autoCorrect: false},
});

// Weak 1 of 4 red, Fair 2 of 4 yellow, Good 3 of 4 green, Strong 4 of 4 green.
// Paper draws only Weak and Good; Fair and Strong follow the flow note colours.
const METER = {
  2: {filled: 1, color: colors.error},
  3: {filled: 2, color: colors.highlight},
  4: {filled: 3, color: colors.success},
  5: {filled: 4, color: colors.success},
};

export function Meter({strength}) {
  const m = METER[strength.level];
  if (!m) return null;
  return (
    <View style={styles.meter} accessible accessibilityLabel={`Password strength: ${strength.label}`}>
      <View style={styles.segments}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={[styles.segment, i < m.filled && {backgroundColor: m.color}]} />
        ))}
      </View>
      <Text style={[type.bodyStrong, styles.meterLabel, {color: m.color}]} numberOfLines={1}>
        {strength.label}
      </Text>
    </View>
  );
}

// The meter row under the Password field: 8 above, one 18 line. The hint below it is the one-line
// error that every reveal leaves room for.
export const METER_ROOM = 26;

export function PasswordField({label, value, onChangeText, error, inputRef, onSubmit, onFocus, placeholder, returnKeyType, revealExtra, testID}) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const reveal = useRevealOnFocus(revealExtra);
  const border = error ? colors.error : focused ? colors.accent : colors.text;
  return (
    <View style={styles.group}>
      <Text style={[type.bodyStrong, styles.label]}>{label}</Text>
      <View style={[styles.field, {borderColor: border}]}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholder={placeholder}
          placeholderTextColor={colors.textPlaceholder}
          onFocus={() => {
            setFocused(true);
            reveal();
            onFocus?.();
          }}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          submitBehavior={returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
          returnKeyType={returnKeyType}
          autoCapitalize="none"
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          accessibilityLabel={label}
          style={[type.bodyLarge, styles.input, !visible && value.length > 0 && styles.bullets]}
          testID={testID}
          {...PASSWORD_PROPS}
        />
        <Pressable
          onPress={() => setVisible(v => !v)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
          <Icon name="eye" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {gap: 8},
  label: {color: colors.textSecondary},
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingLeft: 20,
    paddingRight: 16,
    borderRadius: 30,
    borderWidth: 1,
    backgroundColor: '#0000000F',
  },
  input: {flex: 1, color: colors.text, padding: 0, lineHeight: 18, height: 18},
  bullets: {letterSpacing: 1.9},
  meter: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 8},
  segments: {flex: 1, flexDirection: 'row', gap: 4},
  segment: {flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.progressTrack},
  // At a fixed width of 56, Android cut the "g" of "Strong" (round 4 QA). One line, at least 56.
  meterLabel: {minWidth: 56, textAlign: 'right'},
});
