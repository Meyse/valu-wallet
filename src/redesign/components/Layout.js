// Shared layout parts of the redesigned onboarding (Paper p-2-0; Android Brand p-3-0).
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
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
  TextInput,
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

// Paper: with the keyboard open, the button sits 12 above the keyboard.
const KEYBOARD_GAP = 12;
// Paper: the title sits 8 below the top of the scroll area when the keyboard is open.
const TITLE_TOP = 8;
const CONTENT_TOP = 32;
// Room under the focused text input: the rest of its pill (about 14) and a one-line error (22).
const REVEAL_MARGIN = 40;

// Scrolls the focused field into view above the button (a screen calls it when a field gets focus
// while the keyboard is open). Both DenseScreen versions give it.
const RevealFocusedContext = createContext(null);

// For a field inside a DenseScreen: call the returned function from onFocus. A short wait lets the
// focus settle; a field that gets focus with the keyboard closed is shown by the keyboard move.
export function useRevealOnFocus() {
  const reveal = useContext(RevealFocusedContext);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback(() => {
    clearTimeout(timer.current);
    if (reveal) timer.current = setTimeout(reveal, 100);
  }, [reveal]);
}

function DenseScreenIos({topBar, children, footer, scrollRef}) {
  const top = useTopBarTop();
  const column = useColumnWidth();
  const bottomGap = useBottomGap();
  const keyboard = useAnimatedKeyboard();
  const lift = h => (h > 0 ? Math.max(0, h + KEYBOARD_GAP - bottomGap) : 0);
  const ownScroll = useRef(null);
  const content = useRef(null);
  const title = useRef(null);
  const size = useRef({full: 0, content: 0});
  const marginNow = useRef(0);
  const setScroll = node => {
    ownScroll.current = node;
    if (typeof scrollRef === 'function') scrollRef(node);
    else if (scrollRef) scrollRef.current = node;
  };
  const keyboardHeight = useKeyboardHeight();
  const margin = lift(keyboardHeight);
  marginNow.current = margin;
  const offset = useRef(0); // current scroll position
  const goal = useRef(0); // last position this screen scrolled to while the keyboard is open
  // Scrolls so the focused field shows in full above the button, and never higher than `base`.
  const fit = useCallback(base => {
    const visible = size.current.full - marginNow.current;
    const max = Math.max(0, size.current.content - visible);
    const go = y => {
      const to = Math.min(max, Math.max(0, y));
      goal.current = to;
      if (Math.abs(to - offset.current) > 1) ownScroll.current?.scrollTo({y: to, animated: true});
    };
    const input = TextInput.State.currentlyFocusedInput?.();
    if (!input || !content.current) return go(base);
    input.measureLayout(
      content.current,
      (x, y, w, h) => go(Math.max(base, CONTENT_TOP + y + h + REVEAL_MARGIN - visible)),
      () => go(base),
    );
  }, []);
  // A field gets focus while the keyboard is open: show it, without moving the title back down.
  const reveal = useCallback(() => {
    if (marginNow.current > 0) fit(Math.max(offset.current, goal.current));
  }, [fit]);
  // Keyboard opens: scroll the title to the top, as far as the content can scroll, and further
  // only when the focused field would sit under the button. After the scroll area has its smaller
  // size: a scroll while the content still fits does nothing.
  useEffect(() => {
    if (!margin) {
      goal.current = 0;
      return undefined;
    }
    let alive = true;
    requestAnimationFrame(() => {
      if (!alive || !content.current) return;
      if (!title.current) return fit(offset.current);
      title.current.measureLayout(
        content.current,
        (x, y) => fit(y + CONTENT_TOP - TITLE_TOP),
        () => fit(offset.current),
      );
    });
    return () => {
      alive = false;
    };
  }, [margin, fit]);
  const ride = useAnimatedStyle(() => {
    const h = keyboard.height.value;
    return {transform: [{translateY: -(h > 0 ? Math.max(0, h + KEYBOARD_GAP - bottomGap) : 0)}]};
  });
  return (
    <View style={styles.flex}>
      <FadeView style={styles.flex}>
        <ScrollView
          ref={setScroll}
          style={[styles.flex, {marginTop: top + BACK_SIZE + 8, marginBottom: margin}]}
          contentContainerStyle={{paddingTop: CONTENT_TOP, paddingBottom: 24, alignItems: 'center'}}
          onLayout={e => (size.current.full = e.nativeEvent.layout.height + marginNow.current)}
          onContentSizeChange={(w, h) => (size.current.content = h)}
          scrollEventThrottle={16}
          onScroll={e => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          <View ref={content} style={{width: column}}>
            <TitleAnchorContext.Provider value={title}>
              <RevealFocusedContext.Provider value={reveal}>{children}</RevealFocusedContext.Provider>
            </TitleAnchorContext.Provider>
          </View>
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

function useAndroidKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const subs = [
      Keyboard.addListener('keyboardDidShow', () => setOpen(true)),
      Keyboard.addListener('keyboardDidHide', () => setOpen(false)),
    ];
    return () => subs.forEach(sub => sub.remove());
  }, []);
  return open;
}

function DenseScreenAndroid({topBar, children, footer, scrollRef}) {
  const top = useTopBarTop();
  const column = useColumnWidth();
  const keyboardOpen = useAndroidKeyboardOpen();
  // Paper: with the keyboard open, the button sits 12 above the keyboard.
  const restGap = useBottomGap();
  const bottomGap = keyboardOpen ? KEYBOARD_GAP : restGap;
  const scroll = useRef(null);
  const inner = useRef(null);
  const view = useRef({height: 0, y: 0});
  const setScroll = node => {
    scroll.current = node;
    if (typeof scrollRef === 'function') scrollRef(node);
    else if (scrollRef) scrollRef.current = node;
  };
  // The keyboard shrinks the scroll area: a field low on the screen then sits under the button.
  const reveal = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput?.();
    if (!input || !inner.current || !scroll.current) return;
    input.measureLayout(
      inner.current,
      (x, y, w, h) => {
        const bottom = CONTENT_TOP + y + h + REVEAL_MARGIN;
        const {height, y: offset} = view.current;
        if (height > 0 && bottom > offset + height) scroll.current?.scrollTo({y: bottom - height, animated: true});
      },
      () => {},
    );
  }, []);
  return (
    <View style={styles.flex}>
      {/* Android keeps adjustPan for the old UI; the padding lifts the fields and the button above
          the keyboard, and the pan then has nothing left to move. */}
      <FadeView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {/* The scroll area starts under the top bar, so scrolled content never runs into it. */}
          <ScrollView
            ref={setScroll}
            style={[styles.flex, {marginTop: top + BACK_SIZE + 8}]}
            contentContainerStyle={{paddingTop: CONTENT_TOP, paddingBottom: 24, alignItems: 'center'}}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={e => {
              view.current.y = e.nativeEvent.contentOffset.y;
            }}
            onLayout={e => {
              view.current.height = e.nativeEvent.layout.height;
              reveal();
            }}>
            <View ref={inner} style={{width: column}}>
              <RevealFocusedContext.Provider value={reveal}>{children}</RevealFocusedContext.Provider>
            </View>
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

// Title and body (gap 8). With an icon (the step icon of the step list): icon, then the heading, gap 16.
// DenseScreenIos scrolls the screen title to the top when the keyboard opens (Paper "Create 03
// state - Keyboard open"). The Heading gives it the title view.
const TitleAnchorContext = createContext(null);

export function Heading({title, body, gap = 8, icon}) {
  const anchor = useContext(TitleAnchorContext);
  const heading = (
    <View style={{gap}}>
      <Text ref={anchor} style={[type.title, {color: colors.text}]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[type.bodyLarge, {color: colors.textSecondary}]}>{body}</Text> : null}
    </View>
  );
  if (!icon) return heading;
  return (
    <View style={{gap: 16}}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {icon}
      </View>
      {heading}
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
  if (!steps.length) return null;
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

// The team step list inside a dense screen (Paper round 8): done steps above, the current step
// block (children: step icon, title, body, fields) 40 below them, next steps 40 below the block
// (Paper "Create 03": block ends 587, next steps at 627). It is screen content, so it fades and
// slides with the card.
export function StepList({done = [], next = [], children}) {
  return (
    <View>
      <DoneSteps steps={done} />
      <View style={done.length ? {marginTop: 40} : null}>{children}</View>
      {next.length ? (
        <View style={{marginTop: 40}}>
          <NextSteps steps={next} />
        </View>
      ) : null}
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
