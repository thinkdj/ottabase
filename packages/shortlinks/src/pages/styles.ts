/**
 * Self-contained CSS for the standalone shortlink pages (interstitial + expired).
 *
 * Intentionally decoupled from the app's design system — this is a lightweight
 * redirect page, so it carries its own small neutral palette rather than pulling
 * in the ShadCN/Mantine tokens. Dark mode uses an explicit `data-theme` on <html>
 * (set by the inline theme script) with a `prefers-color-scheme` fallback.
 */
export function getShortlinkPageCss(options?: { maxWidth?: number }) {
    const maxWidth = options?.maxWidth ?? 400;
    const dark = `--bg: #020617;
  --card: #0b1120;
  --text: #e5e7eb;
  --muted: #94a3b8;
  --border: #1f2937;
  --accent: #e5e7eb;
  --on-accent: #0b1120;
  --danger: #f87171;
  --danger-soft: rgba(248, 113, 113, 0.14);`;
    return `:root {
  color-scheme: light dark;
  --bg: #f8fafc;
  --card: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --border: #e5e7eb;
  --accent: #0f172a;
  --on-accent: #ffffff;
  --danger: #dc2626;
  --danger-soft: #fef2f2;
  --radius: 12px;
}
[data-theme="dark"] {
  color-scheme: dark;
  ${dark}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    ${dark}
  }
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  min-height: 100vh;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
.wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.content {
  width: 100%;
  max-width: ${maxWidth}px;
  text-align: center;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 1px 2px rgba(2, 6, 23, 0.04), 0 12px 32px -16px rgba(2, 6, 23, 0.16);
  padding: 40px 32px;
}
.icon {
  width: 60px;
  height: 60px;
  margin: 0 auto 16px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--danger-soft);
  color: var(--danger);
}
.icon svg { width: 28px; height: 28px; }
h1 { font-size: 20px; font-weight: 600; margin: 0 0 6px; color: var(--text); }
p { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.6; }
a { color: var(--text); font-weight: 500; text-decoration: none; border-bottom: 1px solid var(--border); }
a:hover { border-bottom-color: var(--muted); }
`;
}
