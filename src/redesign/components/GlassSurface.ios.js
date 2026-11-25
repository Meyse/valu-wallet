// iOS: real Liquid Glass (UIGlassEffect, iOS 26+) through @callstack/liquid-glass.
// Below iOS 26 the view is plain, so it gets the team's round-button fill.
import React from 'react';
import {LiquidGlassView, isLiquidGlassSupported} from '@callstack/liquid-glass';
import {colors} from '../theme/tokens';

export const GLASS_SUPPORTED = isLiquidGlassSupported;

export default function GlassSurface({style, children, interactive = true}) {
  return (
    <LiquidGlassView
      interactive={interactive}
      effect="regular"
      colorScheme="dark"
      style={[style, !isLiquidGlassSupported && {backgroundColor: colors.fillIconButton}]}>
      {children}
    </LiquidGlassView>
  );
}
