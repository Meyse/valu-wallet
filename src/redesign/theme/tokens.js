// Valu Wallet redesign tokens. Values come from DESIGN.md (Paper file "Valu Wallet").
// Components import these names, never hex literals.
import {Platform} from 'react-native';

export const colors = {
  surface: '#292929',
  surfaceCard: '#1F1F1F',
  surfaceRaised: '#3D3D3D',
  fillSubtle: '#00000052',
  fillField: '#00000052', // p-2-0 fields use the activity-row fill (flow note R03e)
  fillIconButton: '#FFFFFF1A',
  tabbar: '#3C3C3CB3',
  tabActive: '#3F3F3F',
  text: '#FFFFFF',
  textSecondary: '#EBEBEB',
  textMuted: '#737373',
  textOnPrimary: '#3D3D3D',
  textPlaceholder: '#FFFFFF66',
  border: '#FFFFFF1A',
  borderOnLight: '#0000001A',
  borderSubtle: '#FFFFFF14',
  primary: '#FAFAFA',
  accent: '#1F89FA',
  success: '#42DF5E',
  successSoft: '#90F993',
  highlight: '#FFD56F',
  error: '#FF6B6B',
  sheetBackdrop: '#1C1C1FF0',
  progressTrack: '#FFFFFF26',
  actionReceive: '#1F89FA',
  actionTransfer: '#F153AB',
  actionBuy: '#899BFF',
  actionSell: '#5DB9BA',
  assetVrsc: '#3165D4',
  // Android Brand take (Paper p-3-0, A02-A09)
  androidActive: '#6DB4FF',
};

export const fonts = {
  regular: 'Inter18pt-Regular',
  semibold: 'Inter18pt-SemiBold',
};

const t = (family, size, lineHeight) => ({
  fontFamily: family,
  fontSize: size,
  lineHeight,
  letterSpacing: 0,
  // Android picks the file by family name; a fontWeight would make it synthesise.
  ...(Platform.OS === 'ios' ? {} : {includeFontPadding: false}),
});

export const type = {
  display: t(fonts.semibold, 48, 58),
  title: t(fonts.semibold, 28, 36),
  titleCard: t(fonts.semibold, 28, 34),
  titleSmall: t(fonts.semibold, 20, 24),
  label: t(fonts.semibold, 16, 19),
  bodyLarge: t(fonts.regular, 16, 19),
  body: t(fonts.regular, 14, 18),
  bodyStrong: t(fonts.semibold, 14, 18),
  labelSmall: t(fonts.semibold, 13, 16),
  caption: t(fonts.regular, 12, 15),
  tab: t(fonts.semibold, 10, 12),
};

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
};

export const radius = {
  xs: 4,
  sm: 12,
  md: 20,
  lg: 24,
  field: 24,
  tile: 32,
  full: 9999,
};

// Paper artboards for onboarding are 402 x 874.
export const ARTBOARD = {width: 402, height: 874};
