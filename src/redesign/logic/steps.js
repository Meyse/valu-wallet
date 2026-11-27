// Step order of the redesigned onboarding (flow note, rounds 5 to 7).
// Create: password, Face ID. No recovery phrase in onboarding: the backup comes later, inside the
// wallet. Import: a way from the sheet on Welcome (phrase or key, QR, NFC chip, cloud backup), then password and
// Face ID. The first screen of each lane counts as the import step.
export const ROUTES = {
  welcome: 'Welcome',
  importPhrase: 'ImportPhrase',
  scanQr: 'ScanQr',
  importKey: 'ImportKey',
  importNfcPassword: 'ImportNfcPassword',
  importCloud: 'ImportCloud',
  password: 'CreatePassword',
  faceId: 'UseFaceId',
  creating: 'Creating',
};

export const CREATE_PATH = [ROUTES.welcome, ROUTES.password, ROUTES.faceId, ROUTES.creating];

const IMPORT_LANES = [
  ROUTES.importPhrase,
  ROUTES.importKey,
  ROUTES.scanQr,
  ROUTES.importNfcPassword,
  ROUTES.importCloud,
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
  // The key, QR and NFC lanes join the import path where the phrase screen leaves it.
  const from = IMPORT_LANES.includes(current) ? ROUTES.importPhrase : current;
  const i = order.indexOf(from);
  if (i < 0 || i === order.length - 1) return null;
  const next = order[i + 1];
  if (next === ROUTES.faceId && !biometry) return order[i + 2] ?? null;
  return next;
};

// Team step list (Paper round 8) on the step screens: steps done above, the current one, steps next.
// Create: Create password, Use Face ID. Import: Import wallet, Create password, Use Face ID. The
// first screen of each import lane (phrase, key, NFC chip password) is the Import wallet step. The
// Face ID step is left out when the phone has no biometry (as in nextRoute). `bioName` is the name
// of this phone's biometry ("Face ID", "Touch ID").
export const stepListFor = (path, route = ROUTES.faceId, {biometry = true, bioName = 'Face ID'} = {}) => {
  const steps = [
    ...(path === 'import' ? [{route: ROUTES.importPhrase, name: 'Import wallet'}] : []),
    {route: ROUTES.password, name: 'Create password'},
    ...(biometry ? [{route: ROUTES.faceId, name: `Use ${bioName}`}] : []),
  ];
  const at = steps.findIndex(s => s.route === (IMPORT_LANES.includes(route) ? ROUTES.importPhrase : route));
  if (at < 0) return {done: [], current: null, next: []};
  return {
    done: steps.slice(0, at).map(s => s.name),
    current: steps[at].name,
    next: steps.slice(at + 1).map(s => s.name),
  };
};
