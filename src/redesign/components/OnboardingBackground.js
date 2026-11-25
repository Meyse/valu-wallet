// The ONE shared onboarding background (DESIGN.md, Onboarding background).
// Mounted once behind the onboarding navigator. Its state is a function of wall-clock time
// (180 s cycle through the 02, 06, 09, 04 colour sets), never of the route.
// Drawn with Skia: one SkPicture per frame, built on the UI thread.
import React, {useEffect} from 'react';
import {StyleSheet, useWindowDimensions} from 'react-native';
import {
  BlendMode,
  BlurStyle,
  Canvas,
  Picture,
  Skia,
  TileMode,
  createPicture,
} from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {ARTBOARD} from '../theme/tokens';
import {CYCLE, FIELDS, frameAt} from './gradientMotion';
import {HEX_PATH} from './gradientData';

const BOX_W = 614;
const BOX_H = 699;
const ROTATE_DEG = -21.57;
const GLOW_OPACITY = 0.91;
// Mask from the mockup: ellipse 263 x 305, flat to 60 %, fading to 0 at 110 %.
const MASK_STOPS = [0, 0.6, 0.66, 0.73, 0.81, 0.88, 0.95, 1.03, 1.1].map(v => v / 1.1);
const MASK_ALPHA = [1, 1, 0.97, 0.87, 0.68, 0.44, 0.22, 0.08, 0];

const col = (rgb, a) => {
  'worklet';
  return Float32Array.of(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, a);
};

export default function OnboardingBackground({lift, opacity, debugSpeed = 1}) {
  const {width} = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scale = width / ARTBOARD.width;

  // Wall-clock seconds, so a remount never restarts the cycle.
  const time = useSharedValue((Date.now() / 1000) % CYCLE);
  const start = useSharedValue(-1);
  const startT = useSharedValue(0);

  useFrameCallback(frame => {
    'worklet';
    if (start.value < 0) {
      start.value = frame.timestamp;
      startT.value = time.value;
    }
    time.value = startT.value + ((frame.timestamp - start.value) / 1000) * debugSpeed;
  }, !reduceMotion);

  const hexPath = Skia.Path.MakeFromSVGString(HEX_PATH);

  const picture = useDerivedValue(() => {
    const f = frameAt(time.value, reduceMotion);
    const liftY = lift ? lift.value : 0;
    const alpha = opacity ? opacity.value : 1;
    return createPicture(canvas => {
      if (alpha <= 0.001) return;
      canvas.save();
      canvas.scale(scale, scale);
      canvas.translate(0, liftY);

      const outer = Skia.Paint();
      outer.setAlphaf(alpha);
      canvas.saveLayer(outer);

      // Glow box, centred on the glow centre and rotated as in Paper.
      canvas.save();
      canvas.translate(f.centre[0], f.centre[1]);
      canvas.rotate(ROTATE_DEG, 0, 0);
      canvas.translate(-BOX_W / 2, -BOX_H / 2);

      const layer = Skia.Paint();
      layer.setAlphaf(GLOW_OPACITY);
      canvas.saveLayer(layer);

      const basePaint = Skia.Paint();
      basePaint.setColor(col(f.base, 1));
      canvas.drawRect(Skia.XYWHRect(0, 0, BOX_W, BOX_H), basePaint);

      for (let k = 0; k < FIELDS.length; k++) {
        const fx = FIELDS[k];
        const c = f.cols[k];
        const p = Skia.Paint();
        p.setShader(
          Skia.Shader.MakeRadialGradient({x: 0, y: 0}, 1, [col(c, 1), col(c, 0)], null, TileMode.Clamp),
        );
        canvas.save();
        canvas.translate(fx[0] + f.offsets[k][0], fx[1] + f.offsets[k][1]);
        canvas.scale(fx[2], fx[3]);
        canvas.drawCircle(0, 0, 1, p);
        canvas.restore();
      }

      // Soft elliptical edge (alpha mask).
      const mask = Skia.Paint();
      mask.setBlendMode(BlendMode.DstIn);
      const maskColors = MASK_ALPHA.map(a => Float32Array.of(0, 0, 0, a));
      mask.setShader(
        Skia.Shader.MakeRadialGradient(
          {x: 0, y: 0},
          1.1,
          maskColors,
          MASK_STOPS,
          TileMode.Clamp,
          Skia.Matrix().translate(BOX_W / 2, BOX_H / 2).scale(263, 305),
        ),
      );
      canvas.drawRect(Skia.XYWHRect(0, 0, BOX_W, BOX_H), mask);
      canvas.restore(); // glow layer
      canvas.restore(); // glow transform

      // Hex overlay: blurred hexagon, overlay blend, part of the background.
      if (hexPath) {
        const hp = Skia.Paint();
        hp.setColor(Float32Array.of(0.98, 0.98, 0.98, 0.5));
        hp.setBlendMode(BlendMode.Overlay);
        hp.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 50, true));
        canvas.save();
        canvas.translate(f.hex[0] - 100, f.hex[1] - 100);
        canvas.drawPath(hexPath, hp);
        canvas.restore();
      }

      canvas.restore(); // outer opacity layer
      canvas.restore();
    });
  });

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}

// Hook for the navigator: a lift value (artboard px, negative = up) and a fade value.
export const useBackgroundControls = () => {
  const lift = useSharedValue(0);
  const opacity = useSharedValue(0);
  const setLift = px => {
    lift.value = withTiming(px, {duration: 700, easing: Easing.bezier(0.65, 0, 0.25, 1)});
  };
  const fadeTo = (value, duration = 2200) => {
    opacity.value = withTiming(value, {duration, easing: Easing.out(Easing.quad)});
  };
  return {lift, opacity, setLift, fadeTo};
};

export const useStaticFade = (controls, visible) => {
  useEffect(() => {
    controls.fadeTo(visible ? 1 : 0, visible ? 2200 : 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
};
