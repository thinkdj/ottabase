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
.ring { position: relative; width: 92px; height: 92px; margin: 0 auto 20px; }
.ring svg { width: 92px; height: 92px; transform: rotate(-90deg); }
.ring-track { fill: none; stroke: var(--border); stroke-width: 6; }
.ring-progress {
  fill: none;
  stroke: var(--accent);
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}
.count {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 600;
  color: var(--text);
}
.dest { word-break: break-all; }
.dest a { display: inline-block; margin-top: 4px; }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
  height: 38px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 500;
  color: var(--on-accent);
  background: var(--accent);
  border: 0;
  border-radius: 8px;
  text-decoration: none;
  cursor: pointer;
}
.btn:hover { opacity: 0.9; }
@media (prefers-reduced-motion: reduce) {
  .ring-progress { transition: none; }
}
`;

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting…</title>
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
        <div class="ring">
          <svg viewBox="0 0 96 96" aria-hidden="true">
            <circle class="ring-track" cx="48" cy="48" r="42" />
            <circle class="ring-progress" id="ring" cx="48" cy="48" r="42" />
          </svg>
          <div class="count" id="countdown">${seconds}</div>
        </div>
        <h1>Redirecting…</h1>
        <p class="dest">
          Taking you to
          <a href="${targetUrl}" rel="noopener noreferrer">${displayUrl}</a>
        </p>
        <a class="btn" href="${targetUrl}" rel="noopener noreferrer">Continue now</a>
      </div>
    </div>
    <script>
      (function () {
        var remaining = ${seconds};
        var total = ${seconds};
        var el = document.getElementById("countdown");
        var ring = document.getElementById("ring");
        var url = ${JSON.stringify(targetUrl)};
        var C = 2 * Math.PI * 42;
        if (ring) {
          ring.style.strokeDasharray = String(C);
          ring.style.strokeDashoffset = "0";
        }
        var tick = function () {
          remaining -= 1;
          var shown = remaining < 0 ? 0 : remaining;
          if (el) el.textContent = String(shown);
          if (ring) ring.style.strokeDashoffset = String(C * (1 - shown / total));
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
