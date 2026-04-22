// Shared helpers for email content builders.
// Kept small and local — avoids adding weight to @ottabase/utils for a single internal use.

export function escapeHtml(value: string): string {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
