// Buttons of the design language (DESIGN.md, Primary button, Text button, Sheet buttons).
import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, radius, type} from '../theme/tokens';

// variant: 'primary' (white, screen level), 'accent' (blue, sheet confirm), 'secondary' (white in a sheet, no border)
export default function ValuButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  testID,
  accessibilityHint,
}) {
  const isAccent = variant === 'accent';
  const textColor = isAccent ? colors.text : colors.textOnPrimary;
  const off = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{disabled: off, busy: loading}}
      accessibilityHint={accessibilityHint}
      style={({pressed}) => [
        styles.base,
        isAccent ? styles.accent : styles.primary,
        variant === 'primary' && styles.primaryBorder,
        pressed && !off && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <Text style={[type.label, {color: textColor}]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function TextLink({label, onPress, style, testID, align = 'center'}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={4}
      style={({pressed}) => [styles.link, {alignItems: align === 'center' ? 'center' : 'flex-start'}, pressed && styles.pressed, style]}>
      <Text style={[type.body, styles.linkText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  inner: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  primary: {backgroundColor: colors.primary},
  primaryBorder: {borderWidth: 1, borderColor: colors.borderOnLight},
  accent: {backgroundColor: colors.accent},
  pressed: {opacity: 0.85},
  // The designs define no disabled style (DESIGN.md, Open points). The flow note keeps
  // Continue "off" on error screens; this build dims it to 40 %.
  disabled: {opacity: 0.4},
  link: {minHeight: 44, justifyContent: 'center', paddingHorizontal: 8},
  linkText: {color: colors.primary, textDecorationLine: 'underline'},
});
