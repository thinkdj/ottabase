// ============================================================
// @ottabase/ui-datatable - Text Helpers (pure, UI-free)
// ============================================================
// Framework-agnostic string utilities. Lives apart from
// formatters.ts (which emits React) so the headless `.` barrel
// stays free of any rendered UI.
// ============================================================

/**
 * Truncate a string to a max length with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '…';
}
