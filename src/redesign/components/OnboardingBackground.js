// The ONE shared onboarding background (DESIGN.md, Onboarding background).
// Mounted once behind the onboarding navigator, so it never slides, cuts or restarts with a screen.
// Colour and the slow drift are a function of wall-clock time (180 s cycle through the 02, 06, 09,
// 04 colour sets). Each screen has a scene from Paper (where the glow sits and how strong it is).
// On a screen change the glow morphs from scene A to scene B on the UI thread:
// - every colour field has its own critically damped spring; the fields on the leading side are
//   stiffer, so the glow flows to its new place instead of moving as one block;
// - the hex overlay follows more slowly (parallax);
// - the soft edge stretches with the speed and is back to the Paper shape at rest;
// - a new target during a move keeps the current speed (Back, two fast taps: no jump).
// Reduce Motion: no drift, and a screen change dissolves from the old place to the new one.
// Drawn with Skia: one SkPicture per frame, built on the UI thread.
import React from 'react';
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
import {SCENES, nextMotion, initialMotion} from './gradientMorph';
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

// Turns a screen-space vertical offset into the rotated glow box.
const SIN_R = Math.sin((ROTATE_DEG * Math.PI) / 180);
const COS_R = Math.cos((ROTATE_DEG * Math.PI) / 180);

const col = (rgb, a) => {
  'worklet';
  return Float32Array.of(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, a);
};

export default function OnboardingBackground({scene, opacity, debugSpeed = 1}) {
  const {width} = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scale = width / ARTBOARD.width;

  // Wall-clock seconds, so a remount never restarts the colour cycle.
  const time = useSharedValue((Date.now() / 1000) % CYCLE);
  const motion = useSharedValue(initialMotion(scene ? scene.value : SCENES.hero));

  useFrameCallback(frame => {
    'worklet';
    const dt = Math.min(0.05, Math.max(0, (frame.timeSincePreviousFrame ?? 16) / 1000));
    if (!reduceMotion) time.value = time.value + dt * debugSpeed;
    motion.value = nextMotion(motion.value, scene ? scene.value : SCENES.hero, dt, reduceMotion);
  });

  const hexPath = Skia.Path.MakeFromSVGString(HEX_PATH);

  const picture = useDerivedValue(() => {
    const f = frameAt(time.value, reduceMotion);
    const m = motion.value;
    const alpha = opacity ? opacity.value : 1;

    const drawGlow = (canvas, st, a) => {
      if (a <= 0.001) return;
      const outer = Skia.Paint();
      outer.setAlphaf(a);
      canvas.saveLayer(outer);

      // Glow box, centred on the glow centre and rotated as in Paper.
      canvas.save();
      canvas.translate(f.centre[0], f.centre[1] + st.box);
      canvas.rotate(ROTATE_DEG, 0, 0);
      canvas.translate(-BOX_W / 2, -BOX_H / 2);
      // The box clips its fields, as in the mockup. It grows with the edge stretch, so the
      // stretched edge never meets the clip. No anti-aliasing on the clip (no thin line).
      const grow = st.stretch;
      canvas.clipRect(
        Skia.XYWHRect(-(BOX_W * (grow - 1)) / 2, -(BOX_H * (grow - 1)) / 2, BOX_W * grow, BOX_H * grow),
        1,
        false,
      );

      const layer = Skia.Paint();
      layer.setAlphaf(GLOW_OPACITY);
      canvas.saveLayer(layer);

      const basePaint = Skia.Paint();
      basePaint.setColor(col(f.base, 1));
      canvas.drawPaint(basePaint);

      for (let k = 0; k < FIELDS.length; k++) {
        const fx = FIELDS[k];
        const c = f.cols[k];
        // The field's own lag behind the box, in screen space, turned into box space.
        const d = st.fields[k] - st.box;
        const p = Skia.Paint();
        p.setShader(
          Skia.Shader.MakeRadialGradient({x: 0, y: 0}, 1, [col(c, 1), col(c, 0)], null, TileMode.Clamp),
        );
        canvas.save();
        canvas.translate(fx[0] + f.offsets[k][0] + d * SIN_R, fx[1] + f.offsets[k][1] + d * COS_R);
        canvas.scale(fx[2], fx[3]);
        canvas.drawCircle(0, 0, 1, p);
        canvas.restore();
      }

      // Soft elliptical edge (alpha mask), stretched with the speed of the move.
      const mask = Skia.Paint();
      mask.setBlendMode(BlendMode.DstIn);
      const maskColors = MASK_ALPHA.map(v => Float32Array.of(0, 0, 0, v));
      mask.setShader(
        Skia.Shader.MakeRadialGradient(
          {x: 0, y: 0},
          1.1,
          maskColors,
          MASK_STOPS,
          TileMode.Clamp,
          Skia.Matrix()
            .translate(BOX_W / 2, BOX_H / 2)
            .scale(263 * (1 + (grow - 1) * 0.35), 305 * grow),
        ),
      );
      canvas.drawPaint(mask);
      canvas.restore(); // glow layer
      canvas.restore(); // glow transform

      // Hex overlay: blurred hexagon, overlay blend, part of the background.
      if (hexPath) {
        const hp = Skia.Paint();
        hp.setColor(Float32Array.of(0.98, 0.98, 0.98, 0.5));
        hp.setBlendMode(BlendMode.Overlay);
        hp.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 50, true));
        canvas.save();
        canvas.translate(f.hex[0] - 100, f.hex[1] - 100 + st.hex);
        canvas.drawPath(hexPath, hp);
        canvas.restore();
      }
      canvas.restore(); // outer opacity layer
    };

    return createPicture(canvas => {
      if (alpha <= 0.001) return;
      canvas.save();
      canvas.scale(scale, scale);
      // Reduce Motion: the old place fades out while the new place fades in.
      if (m.from) drawGlow(canvas, m.from, alpha * m.from.strength * (1 - m.mix));
      drawGlow(canvas, m, alpha * m.strength * (m.from ? m.mix : 1));
      canvas.restore();
    });
  });

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}

// Hook for the navigator: the target scene (set on each screen change) and the reveal fade.
export const useBackgroundControls = () => {
  const scene = useSharedValue(SCENES.hero);
  const opacity = useSharedValue(0);
  const setScene = next => {
    scene.value = {...scene.value, ...next};
  };
  const fadeTo = (value, duration = 2200) => {
    opacity.value = withTiming(value, {duration, easing: Easing.out(Easing.quad)});
  };
  return {scene, opacity, setScene, fadeTo};
};
