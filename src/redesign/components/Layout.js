// Shared layout parts of the redesigned onboarding (Paper p-2-0; Android Brand p-3-0).
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors, radius, type} from '../theme/tokens';
import GlassSurface from './GlassSurface';
import Icon from './Icon';

const IS_ANDROID = Platform.OS === 'android';
// iOS: 44 pt glass circle (R03 to R13). Android Brand: 48 dp circle (A04, A06, A08).
export const BACK_SIZE = IS_ANDROID ? 48 : 44;
const SIDE = IS_ANDROID ? 16 : 20;

// Top of the back-button row: 8 below the status bar, as in Paper (T62 under a 54 bar, T44 under 36).
export const useTopBarTop = () => {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, IS_ANDROID ? 24 : 20) + 8;
};

// Content column: 330 wide and centred (Paper L36 on 402, L41 on 412), 36 side gutter on small phones.
export const useColumnWidth = () => {
  const {width} = useWindowDimensions();
  return Math.min(330, width - 72);
};

// Space under the bottom button: Paper puts it 32 above the screen edge on iPhones with a home
// indicator (T792 + 50 on 874) and 46 above it on Android (T819 + 50 on 915).
export const useBottomGap = () => {
  const insets = useSafeAreaInsets();
  if (IS_ANDROID) return insets.bottom + 16;
  return insets.bottom > 0 ? 32 : 16;
};

export function BackButton({onPress, icon = 'back', label = 'Back', testID = 'redesign-back'}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      testID={testID}
      style={styles.backHit}>
      <GlassSurface style={[styles.back, IS_ANDROID && styles.backAndroid]}>
        <Icon name={icon} />
      </GlassSurface>
    </Pressable>
  );
}

export function ProgressBar({done, total, style}) {
  const pct = `${Math.round((done / total) * 10000) / 100}%`;
  return (
    <View
      style={[styles.track, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${done} of ${total}`}
      accessibilityValue={{min: 0, max: total, now: done}}>
      <View style={[styles.fill, {width: pct}]} />
    </View>
  );
}

// The "Scan QR" pill (R03, R03e): fill #00000052, 44 high.
export function PillButton({icon, label, onPress, testID}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={({pressed}) => [styles.pill, pressed && {opacity: 0.8}]}>
      {icon ? <Icon name={icon} /> : null}
      <Text style={[type.bodyStrong, {color: colors.text}]}>{label}</Text>
    </Pressable>
  );
}

// Back button + thin progress bar (+ an optional pill at the right).
export function TopBar({onBack, progress, right, backIcon, backLabel}) {
  const top = useTopBarTop();
  const {width} = useWindowDimensions();
  // Paper: bar from x 80; iOS ends 80 from the right edge (W242 on 402), Android 16 (W316 on 412).
  // With the Scan QR pill the bar stops 36 before the pill (W176 on 402).
  const rightGap = right ? SIDE + 110 + 36 : IS_ANDROID ? 16 : 80;
  const barWidth = Math.max(40, width - 80 - rightGap);
  return (
    <View style={[styles.topBar, {top}]} pointerEvents="box-none">
      {onBack ? <BackButton onPress={onBack} icon={backIcon} label={backLabel} /> : <View style={{width: BACK_SIZE}} />}
      {progress ? (
        <ProgressBar
          done={progress[0]}
          total={progress[1]}
          style={{position: 'absolute', left: 80 - SIDE, width: barWidth}}
        />
      ) : null}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

// Dense step (R03, R03e, R04 to R13): top bar, scrolling content column, bottom button.
export function DenseScreen({topBar, children, footer, scrollRef}) {
  const top = useTopBarTop();
  const column = useColumnWidth();
  const bottomGap = useBottomGap();
  return (
    <View style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={{paddingTop: top + BACK_SIZE + 40, paddingBottom: 24, alignItems: 'center'}}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          <View style={{width: column}}>{children}</View>
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, {paddingBottom: bottomGap}]}>
            <View style={{width: column}}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {topBar}
    </View>
  );
}

export function Heading({title, body, gap = 8}) {
  return (
    <View style={{gap}}>
      <Text style={[type.title, {color: colors.text}]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[type.bodyLarge, {color: colors.textSecondary}]}>{body}</Text> : null}
    </View>
  );
}

// App icon tile: 96 x 96, radius 32, #3D3D3D, Valu logo, in a 112 x 112 frame.
export function LogoTile({tileStyle, onPress}) {
  const inner = (
    <View style={styles.logoFrame}>
      <View style={[styles.tile, tileStyle]}>
        <Icon name="valuLogo" />
      </View>
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessible={false}>
      {inner}
    </Pressable>
  );
}

// Step list (R07, R09): done steps with a check, next steps dimmed.
export function DoneSteps({steps}) {
  return (
    <View style={{gap: 16}}>
      {steps.map(name => (
        <View key={name} style={styles.stepRow} accessibilityLabel={`${name}, done`}>
          <Icon name="checkCircle" />
          <Text style={[type.label, styles.stepText]}>{name}</Text>
        </View>
      ))}
    </View>
  );
}

export function NextSteps({steps}) {
  if (!steps.length) return null;
  return (
    <View style={{gap: 24}}>
      {steps.map(name => (
        <Text key={name} style={[type.label, styles.stepText]} accessibilityLabel={`${name}, next`}>
          {name}
        </Text>
      ))}
    </View>
  );
}

export function ErrorText({children, style}) {
  if (!children) return null;
  return (
    <Text style={[type.body, styles.error, style]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  topBar: {
    position: 'absolute',
    left: SIDE,
    right: SIDE,
    height: BACK_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
  },
  right: {marginLeft: 'auto'},
  backHit: {width: BACK_SIZE, height: BACK_SIZE},
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backAndroid: {width: 48, height: 48, borderRadius: 24, backgroundColor: colors.fillIconButton},
  track: {height: 4, borderRadius: 2, backgroundColor: colors.progressTrack, overflow: 'hidden'},
  fill: {height: 4, borderRadius: 2, backgroundColor: colors.primary},
  pill: {
    height: 44,
    minWidth: 110,
    borderRadius: 22,
    paddingLeft: 12,
    paddingRight: 14,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fillSubtle,
  },
  footer: {alignItems: 'center', paddingTop: 12},
  logoFrame: {width: 112, height: 112, alignItems: 'center', justifyContent: 'center'},
  tile: {
    width: 96,
    height: 96,
    borderRadius: radius.tile,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stepRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  stepText: {color: colors.textSecondary, opacity: 0.6},
  error: {color: colors.error, paddingHorizontal: 4, paddingTop: 4},
});
