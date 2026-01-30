export function getShortlinkPageCss(options?: { maxWidth?: number }) {
    const maxWidth = options?.maxWidth ?? 420;
    return `:root {
  color-scheme: light dark;
  --bg: #f3f4f6;
  --text: #111827;
  --muted: #6b7280;
}
html[data-theme="dark"] {
  color-scheme: dark;
}
html[data-theme="light"] {
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b0f14;
    --text: #e5e7eb;
    --muted: #9ca3af;
  }
}
html[data-theme="dark"] {
  --bg: #0b0f14;
  --text: #e5e7eb;
  --muted: #9ca3af;
}
html[data-theme="light"] {
  --bg: #f3f4f6;
  --text: #111827;
  --muted: #6b7280;
}
html, body {
  height: 100%;
  margin: 0;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}
.wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}
.content {
  text-align: center;
  max-width: ${maxWidth}px;
  width: 100%;
}
.icon {
  width: 140px;
  height: 140px;
  margin: 0 auto;
  display: grid;
  place-items: center;
  border-radius: 999px;
  color: #ef4444;
}
h1 {
  font-size: 20px;
  margin: 0 0 8px;
}
p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}
a {
  color: inherit;
}
`;
}
