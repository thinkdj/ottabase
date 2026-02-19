// ---------------------------------------------------------------------------
// @ottabase/motion – Public API
// ---------------------------------------------------------------------------

// ── Presets (pure functions, no React dependency) ─────────────────────────
export { buildPresets, parseDuration, parseEasing, parseOffset } from './presets';
export type { PresetName, TransitionPreset } from './presets';

// ── React hooks ───────────────────────────────────────────────────────────
export { readMotionTokens, useBrandMotion, useMotionTokens, useTransitionPreset } from './hooks';
