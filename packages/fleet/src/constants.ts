// ============================================================
// @ottabase/fleet — shared identifiers
// ============================================================
// The beacon's contract with whatever watches it. A cockpit builds its request from these,
// so renaming one is a breaking change for every app already on a board.
// ============================================================

/** Package key. */
export const FLEET_PACKAGE_KEY = 'fleet';

/** Where the beacon is mounted in the host app: `GET <origin>/api/fleet/report`. */
export const FLEET_BASE_PATH = '/api/fleet';

/** Env var (a secret) the beacon reads its bearer token from. */
export const FLEET_TOKEN_ENV = 'FLEET_TOKEN';
