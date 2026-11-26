// One password field: the pill of Paper p-5-0 "Lock the chip backup" (56 high, #00000052, radius 24,
// blue outline when focused, red on an error), with a show/hide eye.
import React, {forwardRef, useState} from 'react';
import {Platform, Pressable, StyleSheet, TextInput, View} from 'react-native';
import Icon from './Icon';
import {useRevealOnFocus} from './Layout';
import {colors, type} from '../theme/tokens';

const PASSWORD_PROPS = Platform.select({
  ios: {textContentType: 'oneTimeCode', spellCheck: false, autoCorrect: false},
  default: {autoComplete: 'off', importantForAutofill: 'no', textContentType: 'none', autoCorrect: false},
});

const PasswordPill = forwardRef(function PasswordPill(
  {value, onChangeText, label, error, editable = true, onSubmitEditing, returnKeyType = 'done', placeholder, testID},
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const reveal = useRevealOnFocus();
  const border = error ? colors.error : focused ? colors.accent : 'transparent';
  return (
    <View style={[styles.field, {borderColor: border}]}>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        secureTextEntry={!visible}
        placeholder={placeholder}
        placeholderTextColor={colors.textPlaceholder}
        onFocus={() => {
          setFocused(true);
          reveal();
        }}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmitEditing}
        submitBehavior={returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
        returnKeyType={returnKeyType}
        autoCapitalize="none"
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        accessibilityLabel={label}
        style={[type.label, styles.input, !visible && value.length > 0 && styles.bullets]}
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
  );
});

export default PasswordPill;

const styles = StyleSheet.create({
  field: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 20,
    paddingRight: 16,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: colors.fillSubtle,
  },
  input: {flex: 1, color: colors.text, padding: 0, lineHeight: 22, height: 22},
  bullets: {letterSpacing: 2.4},
});
