// ============================================================
// @ottabase/ottaai — Pure provisioning layer (L2)
// ============================================================
// Eligibility verdicts, scoring, tie-break, selection and merge — all PURE
// FUNCTIONS OVER PLAIN RECORDS. No ORM, no crypto, no network.
//
// This is what makes the resolution tables a TEST MATRIX rather than an
// integration-test problem.
// ============================================================

export * from './verdict';
export * from './score';
export * from './select';
export * from './merge';
