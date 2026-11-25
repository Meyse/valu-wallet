// Android and other platforms: no glass (Android Brand take, Paper p-3-0). An opaque surface.
import React from 'react';
import {View} from 'react-native';

export const GLASS_SUPPORTED = false;

export default function GlassSurface({style, children}) {
  return <View style={style}>{children}</View>;
}
