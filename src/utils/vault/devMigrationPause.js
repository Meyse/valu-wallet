// Debug builds only. Device tests set MIGRATION_PAUSE_STAGE to one of
// 'verified', 'prepared', 'applied-1', 'applied-2', 'applied-3', 'committed'
// to hold the vault migration there and kill the app. Keep it null in commits.
export const MIGRATION_PAUSE_STAGE = null;
export const MIGRATION_PAUSE_MS = 60000;
