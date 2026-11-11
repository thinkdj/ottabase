import { getShortlinkPageCss } from './styles';
import { DEFAULT_THEME_STORAGE_KEY } from './interstitial';

export type ExpiredPageOptions = {
    /** localStorage key for theme detection (default: ottabase.theme) */
    themeStorageKey?: string;
};

/** The one page both dead ends share: an expired link (410) and a code that was never a link (404). */
function renderUnavailablePage(
    page: { status: 404 | 410; title: string; heading: string; message: string },
    options?: ExpiredPageOptions,
): Response {
    const css = getShortlinkPageCss();
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${page.title}</title>
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
        <h1>${page.heading}</h1>
        <p>${page.message}</p>
      </div>
    </div>
  </body>
</html>`;

    return new Response(html, {
        status: page.status,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        },
    });
}

export function renderExpiredShortlinkPage(options?: ExpiredPageOptions): Response {
    return renderUnavailablePage(
        {
            status: 410,
            title: 'Link Expired',
            heading: 'Link expired',
            message: 'This shortlink is no longer available. Please request a new link from the sender.',
        },
        options,
    );
}

/** For a code no shortlink has: the same page as an expired link, as a 404. */
export function renderShortlinkNotFoundPage(options?: ExpiredPageOptions): Response {
    return renderUnavailablePage(
        {
            status: 404,
            title: 'Link Not Found',
            heading: 'Link not found',
            message: 'There is no shortlink at this address. Check the link, or ask the sender for a new one.',
        },
        options,
    );
}
