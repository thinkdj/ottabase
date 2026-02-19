import { getShortlinkPageCss } from './styles';
import { DEFAULT_THEME_STORAGE_KEY } from './interstitial';

export type ExpiredPageOptions = {
    /** localStorage key for theme detection (default: ottabase.theme) */
    themeStorageKey?: string;
};

export function renderExpiredShortlinkPage(options?: ExpiredPageOptions): Response {
    const css = getShortlinkPageCss();
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Link Expired</title>
    <script>
      (function () {
        try {
          var theme = localStorage.getItem("${options?.themeStorageKey ?? DEFAULT_THEME_STORAGE_KEY}");
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
        <div class="icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="70" height="70" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <h1>Link expired</h1>
        <p>This shortlink is no longer available. Please request a new link from the sender.</p>
      </div>
    </div>
  </body>
</html>`;

    return new Response(html, {
        status: 410,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}
