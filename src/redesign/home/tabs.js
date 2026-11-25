// The four tabs (Max's decision): Home, Credentials, Money, Agents.
// Android draws the Paper icons. iOS uses SF Symbols, because the system Liquid Glass bar
// takes SF Symbols or bitmap images, not SVG.
export const TAB_ICONS = {
  Home: {icon: 'tabHome', activeAndroid: 'tabHomeActiveAndroid', sfSymbol: 'house', sfSymbolOn: 'house.fill'},
  Credentials: {icon: 'tabCredentials', sfSymbol: 'person.text.rectangle', sfSymbolOn: 'person.text.rectangle.fill'},
  Money: {icon: 'tabMoney', sfSymbol: 'banknote', sfSymbolOn: 'banknote.fill'},
  Agents: {icon: 'tabAgents', sfSymbol: 'sparkles', sfSymbolOn: 'sparkles'},
};

export const PLACEHOLDERS = {
  Credentials: 'Your credentials will show here.',
  Money: 'Your money accounts will show here.',
  Agents: 'Your agents will show here.',
};
