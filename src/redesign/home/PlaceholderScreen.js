// Plain placeholder for the Credentials, Money and Agents tabs (not designed in this build).
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, type} from '../theme/tokens';
import {PLACEHOLDERS} from './tabs';

export default function PlaceholderScreen({route}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, {paddingTop: insets.top + 60}]} testID={`placeholder-${route.name}`}>
      <Text style={[type.title, styles.text]} accessibilityRole="header">
        {route.name}
      </Text>
      <Text style={[type.body, {color: colors.textSecondary}]}>{PLACEHOLDERS[route.name]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.surface, paddingHorizontal: 16, gap: 8},
  text: {color: colors.text},
});
