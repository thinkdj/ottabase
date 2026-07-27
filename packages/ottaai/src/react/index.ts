// ====================================================================
// @ottabase/ottaai/react
// --------------------------------------------------------------------
// SETUP CHECKLIST (each of these fails with NO ERROR if missed):
//  1. Add `'../../packages/ottaai/src/**/*.{js,ts,jsx,tsx}'` to the app's
//     Tailwind `content` array, or the components render unstyled.
//  2. Wrap the tree in `<AiProvisioningProvider fetcher={api} basePath="/api/ai">`
//     and pass THE APP'S api client — bare `fetch` omits `X-Org-Id`/`X-App-Id`,
//     so the server resolves in the session's default org instead of the active one.
//  3. `useAiGate` fails CLOSED outside the provider. That is deliberate: a
//     convenience no-op that ALLOWED the action would silently lose the gate.
// ====================================================================

export * from './context';
export * from './hooks';
export * from './AiProviderSettings';
