// Icon-led step (R07 Use Face ID, R09 Back up wallet): logo tile at the top, then the team's
// step list (done steps, the current step block, next steps) and the bottom actions.
import React from 'react';
import {ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {colors, type} from '../theme/tokens';
import {BACK_SIZE, DoneSteps, FadeView, LogoTile, NextSteps, TopBar, useBottomGap, useTopBarTop} from './Layout';

export default function StepScreen({onBack, done, icon, title, body, next, actions}) {
  const top = useTopBarTop();
  const bottomGap = useBottomGap();
  const {width} = useWindowDimensions();
  const column = Math.min(330, width - 72);
  return (
    <View style={styles.root}>
      <FadeView style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.scroll, {paddingTop: top + BACK_SIZE + 13, paddingBottom: bottomGap - 8}]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.tile}>
            <LogoTile />
          </View>
          <View style={styles.spacer} />
          <View style={{width: column, alignSelf: 'center'}}>
            <DoneSteps steps={done} />
            <View style={[styles.current, {width: Math.min(342, width - 60)}]}>
              {icon}
              <Text style={[type.title, {color: colors.text}]} accessibilityRole="header">
                {title}
              </Text>
              <Text style={[type.bodyLarge, {color: colors.textSecondary}]}>{body}</Text>
            </View>
            <NextSteps steps={next} />
            <View style={[styles.actions, !next.length && {marginTop: 40}]}>{actions}</View>
          </View>
        </ScrollView>
      </FadeView>
      <TopBar onBack={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  scroll: {flexGrow: 1},
  tile: {alignItems: 'center'},
  spacer: {flex: 1, minHeight: 24},
  // Paper R07: done steps end 19 above y 408; the current block starts at 448 (gap 40).
  current: {gap: 16, marginTop: 40, marginBottom: 32},
  // R07 has a button and a 48-high link; R09 keeps the same button position without the link.
  actions: {marginTop: 39, gap: 6, minHeight: 50 + 6 + 48},
});
