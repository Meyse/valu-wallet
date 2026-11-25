# Onboarding gradient motion (proposal)

Mockup: `onboarding-first-screen.html`. Open it in a browser and pick a variant in the panel beside the phone.
Built: Onboarding 02 "Take control". Artboard 01 "Splash" plays first (1.3 s), then becomes 02.

## How the gradient is rebuilt
- Paper draws one PNG (1228 x 1398, rotated -21.57 deg). A PNG cannot move its colours.
- I fitted 7 radial ellipses over one base colour to the PNG (RMS error 2.8 of 255), plus a soft egg mask measured from the PNG alpha (0.91 opacity).
- Screen 06 (yellow glow) uses the same method with its own 7 fields (panel: Colours).
- Each variant adds small sines to the design values, so every frame stays close to the design.
- Error against the Paper screenshot (gradient area, 0-255): still 4.9, variants 5.4 to 7.8.

## Variants
1. **Slow drift** (recommended). Each field moves up to about 35 px on its own loop (29 to 53 s).
   - RN: 7 `Animated.View` layers. Each layer is a pre-rendered radial blob (PNG, or `react-native-svg` `Ellipse` with `RadialGradient`).
   - One shared value runs 0 to 1: `withRepeat(withTiming(1, {duration: 120000, easing: Easing.linear}), -1)`.
   - Each layer: `translateX/Y = A * sin(2*pi*k*t + phase)`, k a whole number. The 120 s wrap then has no jump.
   - Cost: transforms only, on the UI thread. No new dependency.
2. **Breathing**. Fields swell and shrink in a wave (+/-13 %, 9.5 s). The whole glow scales +/-3.5 %.
   - RN: same layers. One shared value, `withRepeat(withTiming, -1, true)`, scale only.
   - Cost: the lowest of the three. No new dependency.
3. **Flowing**. Fields swing about the glow centre by +/-15 deg in a travelling wave (44 s).
   - RN: same layers. `rotate` with `transformOrigin` at the glow centre (RN 0.73+), and a counter-rotation on the blob.
   - Cost: as drift. Keep the angle small so fields stay inside the mask.

## Mask without a dependency
The onboarding background is flat `#292929`. Replace the alpha mask with one static `Svg` overlay on top:
a `RadialGradient` from 0.09 `#292929` (centre) to opaque `#292929` (edge). The fields move under it. No `MaskedView`.

## When Skia is worth it
`@shopify/react-native-skia` gives one shader (true mesh blend, blur, grain). It is not needed for the three variants.
- Cost: about +4 to 6 MB per ABI (estimate, measure), a native module to maintain, and slower native builds.
- RN 0.77 needs the 1.x line. Skia 2.x asks for RN 0.79 or newer. Check peer dependencies first.

## Check before building
- The brief says New Architecture. This repo has `newArchEnabled=false` (`android/gradle.properties`). The plan works in both.
- Already installed: `react-native-reanimated` 3.17.5 and `react-native-svg` 15.12.1. Nothing else is needed.
- Use `useReducedMotion()`: no loop, show t=0. Pause the loop on blur and in the background.
- Screens 03 to 10 reuse the stack. Only the 7 colours and the glow centre change. Cross-fade them with `withTiming`. Not built yet.
- Measure on a low-end Android device. The mockup ran on a laptop GPU.
