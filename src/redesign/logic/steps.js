// Step order of the redesigned onboarding (flow note, rounds 1 to 4).
// Create: password, Face ID, back up, verify. Import: phrase (or key / QR), password, Face ID.
export const ROUTES = {
  welcome: 'Welcome',
  importPhrase: 'ImportPhrase',
  scanQr: 'ScanQr',
  importKey: 'ImportKey',
  password: 'CreatePassword',
  faceId: 'UseFaceId',
  backUp: 'BackUp',
  phrase: 'RecoveryPhrase',
  verify: 'VerifyPhrase',
  creating: 'Creating',
};

export const CREATE_PATH = [
  ROUTES.welcome,
  ROUTES.password,
  ROUTES.faceId,
  ROUTES.backUp,
  ROUTES.phrase,
  ROUTES.verify,
  ROUTES.creating,
];

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
  if (route === ROUTES.password) return [1, 4];
  if (route === ROUTES.phrase) return [3, 4];
  if (route === ROUTES.verify) return [4, 4];
  return [2, 4];
};

// Step list on icon-led screens (R07, R09): names of done and next steps.
// The Face ID step is left out when the device has no biometry.
export const stepListFor = (path, route, {biometry = true} = {}) => {
  if (path === 'import') {
    return {done: ['Import phrase', 'Create password'], next: []};
  }
  if (route === ROUTES.faceId) {
    return {done: ['Create password'], next: ['Back up wallet', 'Verify phrase']};
  }
  // ROUTES.backUp
  return {done: biometry ? ['Create password', 'Use Face ID'] : ['Create password'], next: ['Verify phrase']};
};

// Screens where the shared background moves up so the content has room.
export const DENSE_ROUTES = [
  ROUTES.importPhrase,
  ROUTES.importKey,
  ROUTES.password,
  ROUTES.phrase,
  ROUTES.verify,
];
