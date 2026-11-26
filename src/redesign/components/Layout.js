// Shared layout parts of the redesigned onboarding (Paper p-2-0; Android Brand p-3-0).
import React, {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {NavigationContext} from '@react-navigation/native';
import {CardAnimationContext} from '@react-navigation/stack';
import {
  Animated,
  Keyboard,
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
import Reanimated, {useAnimatedKeyboard, useAnimatedStyle} from 'react-native-reanimated';
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

// Onboarding screens cross-fade. The fade is on the content, not on the card: once a card has been
// faded, Liquid Glass on it no longer renders (seen on iOS 26.5). The onboarding navigator turns it on.
// The old content is gone in the first 40 % of the move; the new content comes in after 30 %, so
// the two are never readable at the same time.
export const ContentFadeContext = createContext(false);

export function FadeView({style, children, pointerEvents}) {
  const enabled = useContext(ContentFadeContext);
  const card = useContext(CardAnimationContext);
  const current = card?.current?.progress;
  const next = card?.next?.progress;
  const opacity = useMemo(() => {
    if (!enabled || !current) return null;
    const incoming = current.interpolate({inputRange: [0.3, 1], outputRange: [0, 1], extrapolate: 'clamp'});
    if (!next) return incoming;
    return Animated.multiply(
      incoming,
      next.interpolate({inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp'}),
    );
  }, [enabled, current, next]);
  if (!opacity) {
    return (
      <View style={style} pointerEvents={pointerEvents}>
        {children}
      </View>
    );
  }
  return (
    <Animated.View style={[style, {opacity}]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}

// Onboarding draws ONE glass circle for the back button, under the cards (SharedBackGlass in the
// navigator). It never moves or fades between steps; each step draws only the icon above it.
// A glass view on a card cannot do this: a faded card stops its glass, and a removed glass fades
// out slowly over the next screen (iOS 26.5).
export const SharedBackGlassContext = createContext(false);

export function SharedBackGlass({visible}) {
  const top = useTopBarTop();
  if (IS_ANDROID || !visible) return null;
  return (
    <View pointerEvents="none" style={[styles.sharedGlass, {top}]}>
      <GlassSurface interactive={false} style={styles.back} />
    </View>
  );
}

// Outside onboarding (Home settings) and on the camera screen the button has its own glass. It
// shows once the card stops, so two glass buttons never overlap during a transition.
function useAtRest(navigation) {
  // A new card is not at rest yet: its transition starts right after the mount.
  const [rest, setRest] = useState(!navigation);
  useEffect(() => {
    if (!navigation) return undefined;
    // Fallback when the card opens without a transition.
    let timer = navigation.isFocused() ? setTimeout(() => setRest(true), 550) : undefined;
    const settle = () => {
      clearTimeout(timer);
      setRest(true);
    };
    const move = () => {
      clearTimeout(timer);
      setRest(false);
    };
    const offs = [
      navigation.addListener('transitionStart', move),
      navigation.addListener('transitionEnd', e => (e.data?.closing ? move() : settle())),
      navigation.addListener('gestureStart', move),
      navigation.addListener('gestureCancel', settle),
      navigation.addListener('blur', move),
      // A screen uncovered by Back gets no transition event of its own.
      navigation.addListener('focus', () => {
        clearTimeout(timer);
        timer = setTimeout(() => setRest(true), 550);
      }),
    ];
    return () => {
      clearTimeout(timer);
      offs.forEach(off => off());
    };
  }, [navigation]);
  return rest;
}

// Opens the keyboard once the screen has arrived. Focus during the move loads the keyboard while
// the card and the glow animate, and on iOS that blocks the UI thread (measured: 0.4 to 1.1 s on
// the simulator), so the move stops and then jumps.
export function useFocusOnArrival(focus) {
  const navigation = useContext(NavigationContext);
  const latest = useRef(focus);
  latest.current = focus;
  useEffect(() => {
    if (!navigation) return undefined;
    let alive = true;
    const off = navigation.addListener('transitionEnd', e => {
      if (!e.data?.closing) requestAnimationFrame(() => alive && latest.current());
    });
    return () => {
      alive = false;
      off();
    };
  }, [navigation]);
}

export function BackButton({onPress, icon = 'back', label = 'Back', testID = 'redesign-back', ownGlass = false}) {
  const navigation = useContext(NavigationContext);
  const shared = useContext(SharedBackGlassContext) && !ownGlass;
  const rest = useAtRest(navigation);
  const glass = !IS_ANDROID && !shared && rest;
  const fill = IS_ANDROID ? styles.backAndroid : !shared && !glass && styles.backPlain;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        // The keyboard goes while the finger is down: closing it costs the UI thread a few
        // frames, and during the move that shows as a stop.
        Keyboard.dismiss();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      testID={testID}
      style={({pressed}) => [styles.backHit, pressed && {opacity: 0.7}]}>
      {glass ? <GlassSurface interactive={false} style={[styles.back, StyleSheet.absoluteFill]} /> : null}
      <FadeView style={[styles.back, fill]}>
        <Icon name={icon} />
      </FadeView>
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
        <FadeView style={{position: 'absolute', left: 80 - SIDE, width: barWidth}}>
          <ProgressBar done={progress[0]} total={progress[1]} />
        </FadeView>
      ) : null}
      {right ? <FadeView style={styles.right}>{right}</FadeView> : null}
    </View>
  );
}

// Dense step (R03, R03e, R04 to R13): top bar, scrolling content column, bottom button.
// iOS: the button rides on the keyboard by a transform, frame by frame on the UI thread.
// KeyboardAvoidingView does not animate its padding on the New Architecture: the button was covered
// by the rising keyboard and then jumped above it. A height animated per frame was uneven (layout
// each frame). The scroll area ends above the keyboard once it starts to rise (one layout change).
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const subs = [
      Keyboard.addListener('keyboardWillShow', e => setHeight(e.endCoordinates.height)),
      Keyboard.addListener('keyboardWillHide', () => setHeight(0)),
    ];
    return () => subs.forEach(sub => sub.remove());
  }, []);
  return height;
}

function DenseScreenIos({topBar, children, footer, scrollRef}) {
  const top = useTopBarTop();
  const column = useColumnWidth();
  const bottomGap = useBottomGap();
  const keyboard = useAnimatedKeyboard();
  const keyboardHeight = useKeyboardHeight();
  const ride = useAnimatedStyle(() => ({transform: [{translateY: -keyboard.height.value}]}));
  return (
    <View style={styles.flex}>
      <FadeView style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          style={[styles.flex, {marginTop: top + BACK_SIZE + 8, marginBottom: keyboardHeight}]}
          contentContainerStyle={{paddingTop: 32, paddingBottom: 24, alignItems: 'center'}}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          <View style={{width: column}}>{children}</View>
        </ScrollView>
        {footer ? (
          <Reanimated.View style={[styles.footer, {paddingBottom: bottomGap}, ride]}>
            <View style={{width: column}}>{footer}</View>
          </Reanimated.View>
        ) : null}
      </FadeView>
      {topBar}
    </View>
  );
}

export function DenseScreen(props) {
  if (!IS_ANDROID) return <DenseScreenIos {...props} />;
  return <DenseScreenAndroid {...props} />;
}

function DenseScreenAndroid({topBar, children, footer, scrollRef}) {
  const top = useTopBarTop();
  const column = useColumnWidth();
  const bottomGap = useBottomGap();
  return (
    <View style={styles.flex}>
      {/* Android keeps adjustPan for the old UI; the padding lifts the fields and the button above
          the keyboard, and the pan then has nothing left to move. */}
      <FadeView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {/* The scroll area starts under the top bar, so scrolled content never runs into it. */}
          <ScrollView
            ref={scrollRef}
            style={[styles.flex, {marginTop: top + BACK_SIZE + 8}]}
            contentContainerStyle={{paddingTop: 32, paddingBottom: 24, alignItems: 'center'}}
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
      </FadeView>
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
  // Shown on iOS while cards move, in place of the glass.
  backPlain: {backgroundColor: colors.fillIconButton},
  sharedGlass: {position: 'absolute', left: SIDE, width: 44, height: 44},
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
