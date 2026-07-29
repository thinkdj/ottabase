// ============================================================
// @ottabase/forms/react - Rendered UI entry
// ============================================================
// The ONLY entry that pulls in rendered React components.
// Keeping these behind the /react subpath keeps the root `.`
// barrel headless (zero UI in its import graph), so consumers
// that only need config/schema helpers never pay for the UI deps.
// ============================================================

// Re-exports the 5 rendered components (FormField, ModelForm,
// ModelTable, ModelDetail, ModelCrud) + their prop types.
export * from './components';
