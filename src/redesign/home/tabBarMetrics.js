// Space a tab screen keeps free under its content so the last row clears the tab bar.
import {Platform} from 'react-native';

// Android Brand pill: 64 high, 32 above the bottom (A02). iOS: the system Liquid Glass bar
// floats over the content; 62 high in Paper (R16) plus its gap.
export const TAB_BAR_CLEARANCE = Platform.OS === 'android' ? 64 + 32 + 16 : 62 + 32;
