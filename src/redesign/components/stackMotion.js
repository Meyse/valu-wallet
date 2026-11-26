// Screen-to-screen motion of the redesigned stacks over the shared gradient (onboarding, backup).
// Cards are transparent over the shared background, so screens cross-fade with a short slide
// instead of sliding over each other. The fade is on the screen content (FadeView in Layout.js),
// not on the card: a faded card stops Liquid Glass on it.
// The card moves on the glow box spring (critically damped, W_BOX rad/s), so the content and the
// glow travel over the same time with the same curve. The stack animates in screen points.
import {W_BOX} from './gradientMorph';

export const CARD_SPRING = {
  animation: 'spring',
  config: {
    stiffness: W_BOX * W_BOX,
    damping: 2 * W_BOX,
    mass: 1,
    overshootClamping: true,
    restDisplacementThreshold: 8,
    restSpeedThreshold: 40,
  },
};

export const fadeSlide = ({current, next, layouts}) => ({
  cardStyle: {
    transform: [
      {
        translateX: next
          ? next.progress.interpolate({inputRange: [0, 1], outputRange: [0, -layouts.screen.width * 0.08]})
          : current.progress.interpolate({inputRange: [0, 1], outputRange: [layouts.screen.width * 0.08, 0]}),
      },
    ],
  },
});

export const glassStackOptions = {
  headerShown: false,
  cardStyle: {backgroundColor: 'transparent'},
  cardStyleInterpolator: fadeSlide,
  transitionSpec: {open: CARD_SPRING, close: CARD_SPRING},
  gestureEnabled: true,
};
