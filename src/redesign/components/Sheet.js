// One sheet for every in-app question (DESIGN.md, Sheet and alert; Figma CSS of the team sheet).
// Backdrop: the real screen, blurred, under #1C1C1F at 94 %. Card: #292929 with the rebuilt
// 1 px gradient border, floating 24 above the bottom edge.
import React, {createContext, useContext, useEffect, useState} from 'react';
import {Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {FadeIn, FadeOut, SlideInDown, SlideOutDown} from 'react-native-reanimated';
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

// icon: element (48 x 48 outline icon). buttons: [{label, onPress, variant}] (max 2).
export default function Sheet({visible, onClose, icon, title, body, children, buttons = [], testID}) {
  const source = useContext(BackdropSourceContext);
  const insets = useSafeAreaInsets();
  const {width: screenW} = useWindowDimensions();
  const [image, setImage] = useState(null);
  const [cardSize, setCardSize] = useState({width: 0, height: 0});

  useEffect(() => {
    let alive = true;
    if (visible && source?.current) {
      makeImageFromView(source)
        .then(img => alive && setImage(img))
        .catch(() => alive && setImage(null));
    }
    if (!visible) setImage(null);
    return () => {
      alive = false;
    };
  }, [visible, source]);

  const width = Math.min(CARD_WIDTH, screenW - 32);
  const bottom = Math.max(24, insets.bottom + 8);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      {visible ? (
        <View style={StyleSheet.absoluteFill} testID={testID}>
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
            <GradientBorder width={cardSize.width} height={cardSize.height} />
            <View style={styles.card}>
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
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Modal>
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
    padding: 24,
    gap: 48,
  },
  top: {gap: 16},
  icon: {width: 48, height: 48, alignItems: 'center', justifyContent: 'center'},
  texts: {gap: 16},
  title: {color: colors.text},
  body: {color: colors.text},
  buttons: {gap: 8},
});

export const isAndroid = Platform.OS === 'android';
