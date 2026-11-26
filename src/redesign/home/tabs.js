// The four tabs (Max's decision): Home, Credentials, Money, Agents.
// Android draws the Paper SVG icons. The iOS Liquid Glass bar takes SF Symbols or bitmap images,
// not SVG: it gets the same Paper icons as PNGs (assets/tabs, rendered from the SVGs in Icon.js),
// tinted by the bar.
export const TAB_ICONS = {
  Home: {icon: 'tabHome', activeAndroid: 'tabHomeActiveAndroid', image: require('../assets/tabs/tabHome.png')},
  Credentials: {icon: 'tabCredentials', image: require('../assets/tabs/tabCredentials.png')},
  Money: {icon: 'tabMoney', image: require('../assets/tabs/tabMoney.png')},
  Agents: {icon: 'tabAgents', image: require('../assets/tabs/tabAgents.png')},
};

export const PLACEHOLDERS = {
  Credentials: 'Your credentials will show here.',
  Money: 'Your money accounts will show here.',
  Agents: 'Your agents will show here.',
};
