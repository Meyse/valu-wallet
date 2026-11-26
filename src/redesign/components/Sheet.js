// One sheet for every in-app question (DESIGN.md, Sheet and alert; Figma CSS of the team sheet).
// Backdrop: the real screen, blurred, under #1C1C1F at 94 %. Card: #292929 with the rebuilt
// 1 px gradient border, floating 24 above the bottom edge.
import React, {createContext, useContext, useEffect, useState} from 'react';
import {Keyboard, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {Gesture, GestureDetector, GestureHandlerRootView} from 'react-native-gesture-handler';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {Blur, Canvas, Image as SkImage, makeImageFromView} from '@shopify/react-native-skia';
import {colors, radius, type} from '../theme/tokens';
import ValuButton from './ValuButton';

// The onboarding root (or any redesigned root) provides the view to blur.
export const BackdropSourceContext = createContext(null);

const CARD_WIDTH = 343;

function GradientBorder({width, height}) {
  if (!width || !height) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="sheetBorder" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.2" />
          <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.06" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.04" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} rx={radius.lg} fill="url(#sheetBorder)" />
    </Svg>
  );
}

function BlurredBackdrop({image}) {
  const {width, height} = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {image ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <SkImage image={image} x={0} y={0} width={width} height={height} fit="cover">
            <Blur blur={40} mode="clamp" />
          </SkImage>
        </Canvas>
      ) : null}
      <View style={[StyleSheet.absoluteFill, {backgroundColor: colors.sheetBackdrop}]} />
    </View>
  );
}

// The sheet chrome: blurred backdrop (tap closes), the card with its gradient border, the slide.
// grabber: a handle on top, and a swipe down closes the sheet (Paper Import 02 - Choose a way).
// cardStyle: padding and gap of the card content.
export function SheetFrame({visible, onClose, grabber = false, cardStyle, children, testID}) {
  const source = useContext(BackdropSourceContext);
  const insets = useSafeAreaInsets();
  const {width: screenW} = useWindowDimensions();
  const [image, setImage] = useState(null);
  const [cardSize, setCardSize] = useState({width: 0, height: 0});
  const drag = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    if (visible) drag.value = 0;
    if (visible && source?.current) {
      makeImageFromView(source)
        .then(img => alive && setImage(img))
        .catch(() => alive && setImage(null));
    }
    if (!visible) setImage(null);
    return () => {
      alive = false;
    };
  }, [visible, source, drag]);

  const close = () => onClose && onClose();
  // Down follows the finger; up resists. Far enough or fast enough closes, else it springs back.
  const pan = Gesture.Pan()
    .enabled(grabber)
    .activeOffsetY([-10, 10])
    .failOffsetX([-24, 24])
    .onUpdate(e => {
      drag.value = e.translationY > 0 ? e.translationY : e.translationY / 6;
    })
    .onEnd(e => {
      if (e.translationY > 80 || e.velocityY > 800) runOnJS(close)();
      else drag.value = withSpring(0, {damping: 20, stiffness: 260});
    });
  const width = Math.min(CARD_WIDTH, screenW - 32);
  const bottom = Math.max(24, insets.bottom + 8);

  // iOS: a sheet with a text field rises with the keyboard and stays 12 above it. Android pans the
  // window itself (adjustPan).
  const lift = useSharedValue(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const move = to => e => {
      lift.value = withTiming(to(e), {duration: e?.duration || 250});
    };
    const subs = [
      Keyboard.addListener('keyboardWillShow', move(e => Math.max(0, e.endCoordinates.height + 12 - bottom))),
      Keyboard.addListener('keyboardWillHide', move(() => 0)),
    ];
    return () => subs.forEach(sub => sub.remove());
  }, [bottom, lift]);
  const dragStyle = useAnimatedStyle(() => ({transform: [{translateY: drag.value - lift.value}]}));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      {visible ? (
        <GestureHandlerRootView style={StyleSheet.absoluteFill} testID={testID}>
          <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill}>
            <BlurredBackdrop image={image} />
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.duration(320)}
            exiting={SlideOutDown.duration(220)}
            style={[styles.cardWrap, {width, bottom}]}
            accessibilityViewIsModal
            onLayout={e => setCardSize(e.nativeEvent.layout)}>
            <GestureDetector gesture={pan}>
              <Animated.View style={dragStyle}>
                <GradientBorder width={cardSize.width} height={cardSize.height} />
                <View style={[styles.card, cardStyle]}>
                  {grabber ? (
                    <View style={styles.grabberRow}>
                      <View style={styles.grabber} />
                    </View>
                  ) : null}
                  {children}
                </View>
              </Animated.View>
            </GestureDetector>
          </Animated.View>
        </GestureHandlerRootView>
      ) : null}
    </Modal>
  );
}

// One question: icon (48 x 48 outline), title, body, then up to two buttons [{label, onPress, variant}].
export default function Sheet({visible, onClose, icon, title, body, children, buttons = [], testID}) {
  return (
    <SheetFrame visible={visible} onClose={onClose} testID={testID} cardStyle={styles.question}>
      <View style={styles.top}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <View style={styles.texts}>
          <Text style={[type.titleCard, styles.title]} accessibilityRole="header">
            {title}
          </Text>
          {body ? <Text style={[type.body, styles.body]}>{body}</Text> : null}
        </View>
        {children}
      </View>
      {buttons.length > 0 ? (
        <View style={styles.buttons}>
          {buttons.map(b => (
            <ValuButton
              key={b.label}
              label={b.label}
              onPress={b.onPress}
              variant={b.variant ?? 'secondary'}
              testID={b.testID}
              loading={b.loading}
              disabled={b.disabled}
            />
          ))}
        </View>
      ) : null}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    position: 'absolute',
    alignSelf: 'center',
    padding: 1,
    borderRadius: radius.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg - 1,
  },
  question: {padding: 24, gap: 48},
  // Paper: an 11 high row with a 36 x 5 handle at its top.
  grabberRow: {height: 11, alignItems: 'center'},
  grabber: {width: 36, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF52'},
  top: {gap: 16},
  icon: {width: 48, height: 48, alignItems: 'center', justifyContent: 'center'},
  texts: {gap: 16},
  title: {color: colors.text},
  body: {color: colors.text},
  buttons: {gap: 8},
});

export const isAndroid = Platform.OS === 'android';
