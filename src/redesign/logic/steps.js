// Step order of the redesigned onboarding (flow note, rounds 5 to 7).
// Create: password, Face ID. No recovery phrase in onboarding: the backup comes later, inside the
// wallet. Import: a way from the sheet (phrase or key, QR, NFC chip), then password and Face ID.
export const ROUTES = {
  welcome: 'Welcome',
  importPhrase: 'ImportPhrase',
  scanQr: 'ScanQr',
  importKey: 'ImportKey',
  password: 'CreatePassword',
  faceId: 'UseFaceId',
  creating: 'Creating',
};

export const CREATE_PATH = [ROUTES.welcome, ROUTES.password, ROUTES.faceId, ROUTES.creating];

export const IMPORT_PATH = [
  ROUTES.welcome,
  ROUTES.importPhrase,
  ROUTES.password,
  ROUTES.faceId,
  ROUTES.creating,
];

// Next route after `current`. The Face ID step is skipped when the device has no biometry.
export const nextRoute = (path, current, {biometry = true} = {}) => {
  const order = path === 'import' ? IMPORT_PATH : CREATE_PATH;
  // The key and QR side paths join the import path where the phrase screen leaves it.
  const from =
    current === ROUTES.importKey || current === ROUTES.scanQr ? ROUTES.importPhrase : current;
  const i = order.indexOf(from);
  if (i < 0 || i === order.length - 1) return null;
  const next = order[i + 1];
  if (next === ROUTES.faceId && !biometry) return order[i + 2] ?? null;
  return next;
};

// Thin progress bar on dense screens: [done, total].
export const progressFor = (path, route) => {
  if (path === 'import') {
    if ([ROUTES.importPhrase, ROUTES.importKey, ROUTES.scanQr].includes(route)) return [1, 3];
    if (route === ROUTES.password) return [2, 3];
    return [3, 3];
  }
  return route === ROUTES.password ? [1, 2] : [2, 2];
};

// Step list on the Face ID step (Create 04, Import next 2): done steps above the icon.
export const stepListFor = path =>
  path === 'import' ? {done: ['Import wallet', 'Create password'], next: []} : {done: ['Create password'], next: []};
