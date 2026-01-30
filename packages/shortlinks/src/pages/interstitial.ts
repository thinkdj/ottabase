import { getShortlinkPageCss } from './styles';

type InterstitialOptions = {
    url: string;
    seconds?: number;
};

function truncateUrl(url: string, maxLength: number = 60) {
    if (url.length <= maxLength) return url;
    return `${url.slice(0, maxLength - 1)}…`;
}

export function renderShortlinkInterstitialPage(options: InterstitialOptions): Response {
    const seconds = Math.max(1, Math.min(60, options.seconds ?? 10));
    const targetUrl = options.url;
    const displayUrl = truncateUrl(targetUrl);
    const css = `${getShortlinkPageCss({ maxWidth: 520 })}
.count {
  font-size: 36px;
  font-weight: 600;
  margin-bottom: 12px;
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
          var theme = localStorage.getItem("ottabase-theme");
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
        <div class="count" id="countdown">${seconds}</div>
        <h1>Redirecting ...</h1>
        <p>
          Redirecting to <a href="${targetUrl}" rel="noopener noreferrer">${displayUrl}</a>
        </p>
      </div>
    </div>
    <script>
      (function () {
        var remaining = ${seconds};
        var el = document.getElementById("countdown");
        var url = ${JSON.stringify(targetUrl)};
        var tick = function () {
          remaining -= 1;
          if (el) el.textContent = String(remaining);
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
