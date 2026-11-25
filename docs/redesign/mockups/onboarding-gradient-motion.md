# Onboarding gradient: one living background (proposal)

Mockup: `onboarding-first-screen.html`. Screens 02, 06 and 09 are content only. The panel steps between them.

## Model
- ONE background sits behind all onboarding screens. Its state is a function of time, not of the route.
- Colour sets come from the Paper artboards: 02/03 (teal, blue, green), 06/07 (yellow, green), 09 (light green), 04/05 (green, cyan, blue).
- Order: 02 -> 06 -> 09 -> 04 -> 02. Cycle = 180 s (45 s per set, 15 % dwell on each set), seamless wrap.
- Speed control: 1x (22 s per cycle at 8x, 7.5 s at 24x). Reduced motion: still image, screen 02 colours.
- Artboard 08 (camera) and 10 (dimmed modal over home) have no glow. Hide the background there with an opacity fade.
- Rebuilt from the 4 Paper PNG fills: 11 shared radial fields fitted per set (RMS error 2.4 to 2.9 of 255).
- Colour, glow position and field motion share one clock. Fields keep one layout; only colour changes, so no crossfade of two pictures.
- Colours mix in OKLCH (blue to yellow passes through cyan and green, never grey).
- Motion styles (all on the same clock): Slow drift, Breathing, Flowing, Colour only.

## Findings
- Paper puts the 02 glow 67 px lower than 04/09. With one background, steps text on 06/09 (y 370 to 424) hit contrast 1.6 at the 02 phase.
- I moved the 02 glow centre to y 79 (the 04/09 value). Worst case now: step labels 3.78 (Paper's own 09 still: 4.30); all body and heading text 12.2 or more.
- Cost: the 02 phase differs from the Paper 02 still by a 67 px upward shift (mean error 13.6 against 2.9 at Paper's position). Needs a design decision.
- Status bar white on pale mint is 1.45 to 1.8 in Paper too. It is a design issue, not a phase issue.

## React Native (0.77, Reanimated 3.17.5, react-native-svg 15.12.1, no new dependency)
- Mount `<OnboardingBackground/>` once, as a sibling BEFORE the stack navigator inside one `View` that holds the onboarding navigator.
  Set `cardStyle: {backgroundColor: 'transparent'}` on the screens. It does not remount on navigation, so its clock never resets.
- Clock: `phase = useSharedValue(0)`; `withRepeat(withTiming(4, {duration: 180000, easing: Easing.linear}), -1)`. Speed x8 only in a debug build.
- Shape: one white radial-alpha PNG (256 px) drawn 11 times as `Animated.Image`, each at its field x, y, rx, ry. Base colour on the parent `View`.
- Colour per field: `useAnimatedStyle` -> `tintColor: interpolateColor(ease(phase), [0,1,2,3,4], [A,C,D,B,A], 'LAB')`.
  The `ease` worklet adds the 15 % dwell. Reanimated has no OKLCH; LAB is close. Check `tintColor` updates on Android on a device.
- Field motion: `translateX/Y`, `scale`, `rotate` in the same style. Use whole-number harmonics of the 180 s cycle so the wrap has no jump.
- Edge mask: static `Svg` overlay `RadialGradient` (transparent centre to opaque `#292929`). No `MaskedView`.
- Glow centre: interpolate `top/left` (or `translate`) from the same phase. Hex overlay: optional, tiny, can be dropped.
- Cost: transforms and tint only, no per-frame bitmap. Measure on a low-end Android phone. If tint animation is slow, set colours at 10 Hz.
- Reduced motion: `useReducedMotion()` -> `cancelAnimation`, phase 0. Pause on `AppState` change and when the navigator unmounts.
- Skia is not needed. It would add about 4 to 6 MB per ABI; RN 0.77 needs Skia 1.x.

## Open point: does a screen keep "its" colour?
Built: colour is a function of time only. The alternative adds a per-route target phase (02=0, 06=1, 09=2, 04=3) and eases a phase offset toward it on focus.
Cost: about 25 lines and a coupling from navigation to background. Quick taps make the colour speed up and back-navigation runs it backwards.
It also pulls the glow toward the design geometry per screen, which fixes the 67 px conflict above. I do not recommend it unless Max wants it.
