import { getShortlinkPageCss } from './styles';

/** Default localStorage key for theme (must match app's theme provider) */
export const DEFAULT_THEME_STORAGE_KEY = 'ottabase.theme';

type InterstitialOptions = {
    url: string;
    seconds?: number;
    /** localStorage key for theme detection (default: ottabase.theme) */
    themeStorageKey?: string;
};

function truncateUrl(url: string, maxLength: number = 60) {
    if (url.length <= maxLength) return url;
    return `${url.slice(0, maxLength - 1)}…`;
}

export function renderShortlinkInterstitialPage(options: InterstitialOptions): Response {
    const seconds = Math.max(1, Math.min(60, options.seconds ?? 10));
    const targetUrl = options.url;
    const displayUrl = truncateUrl(targetUrl);
    const themeKey = options.themeStorageKey ?? DEFAULT_THEME_STORAGE_KEY;
    const css = `${getShortlinkPageCss({ maxWidth: 420 })}
.wrap {
  padding: 32px 20px;
}
.content {
  text-align: left;
  max-width: 520px;
  padding: 36px 28px 32px;
  border-radius: 16px;
  box-shadow: none;
  border: none;
}
.label {
  margin: 0 0 14px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
h1 {
  margin: 0 0 10px;
  font-size: 32px;
  line-height: 1.1;
  letter-spacing: -0.03em;
}
.lead {
  margin: 0;
  font-size: 15px;
  max-width: 34ch;
}
.panel {
  margin-top: 28px;
  padding: 0;
}
.panel-label {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.dest {
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
}
.dest a {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.timer {
  margin-top: 8px;
  font-size: 14px;
  color: var(--muted);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 28px;
  min-height: 34px;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-decoration: none;
}
.btn:hover {
  background: var(--bg);
}
.meta {
  margin-top: 8px;
  font-size: 11px;
  opacity: 0.72;
  color: var(--muted);
}
.hidden { display: none; }
[data-theme="dark"] .btn:hover {
  background: #111827;
}
@media (max-width: 620px) {
  .wrap { padding: 18px; }
  .content { padding: 28px 20px 24px; }
  h1 { font-size: 28px; }
}
`;

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Opening link…</title>
    <script>
      (function () {
        try {
          var theme = localStorage.getItem("${themeKey}");
          if (theme === "dark" || theme === "light") {
            document.documentElement.setAttribute("data-theme", theme);
          } else if (theme === "system") {
            document.documentElement.setAttribute(
              "data-theme",
              window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light",
            );
          }
        } catch (e) {
          // ignore
        }
      })();
    </script>
    <style>
      ${css}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="content">
        <p class="label">Please wait</p>
        <h1>Opening your link…</h1>
        <p class="lead">You will be there in a moment.</p>
        <div class="panel">
          <p class="panel-label">Destination</p>
          <p class="dest"><a href="${targetUrl}" rel="noopener noreferrer">${displayUrl}</a></p>
        </div>
        <p class="timer">Opens in <span id="countdown">${seconds}</span>s.</p>
        <a class="btn" href="${targetUrl}" rel="noopener noreferrer">Open now</a>
        <p class="meta hidden">Powered by Ottabase</p>
      </div>
    </div>
    <script>
      (function () {
        var remaining = ${seconds};
        var el = document.getElementById("countdown");
        var url = ${JSON.stringify(targetUrl)};
        var tick = function () {
          remaining -= 1;
          var shown = remaining < 0 ? 0 : remaining;
          if (el) el.textContent = String(shown);
          if (remaining <= 0) {
            window.location.href = url;
            return;
          }
          setTimeout(tick, 1000);
        };
        setTimeout(tick, 1000);
      })();
    </script>
  </body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}
