# Ottabase Homepage (`homepage.ob`)

A standalone static landing page for the Ottabase open-source launch. **No framework, no build step, no dependencies.**
Pure HTML, CSS, and vanilla JS. Open any `.html` file in a browser or serve with any static file server.

## Pages

| File              | URL           | Purpose                                       |
| ----------------- | ------------- | --------------------------------------------- |
| `index.html`      | `/`           | Main landing page                             |
| `packages.html`   | `/packages`   | All 47 packages with category filter          |
| `philosophy.html` | `/philosophy` | Fat models manifesto + architecture decisions |
| `docs.html`       | `/docs`       | Get started guide with code examples          |

## Design

- **Light + dark** — default light (warm paper `#fafaf9`); dark mode (`#09090b`) via sun/moon toggle in the nav; choice
  stored in `localStorage` as `hp-ob-theme`
- **Typography** — Inter (body), JetBrains Mono (code/labels)
- **No dependencies** — Google Fonts CDN is the only external resource
- **Scroll animations** — Intersection Observer API, no library
- **Terminal animation** — vanilla JS typing effect on the quick start terminal
- **Code syntax highlighting** — CSS token classes, no Prism or highlight.js
- **Package filter** — instant client-side filter with `data-cat` attributes
- **Copy-to-clipboard** — click any install command to copy it
- **Accessible** — semantic HTML, ARIA labels, keyboard navigation, skip links

## Serving locally

```bash
# With Python
python3 -m http.server 8080 --directory apps/homepage.ob

# With Node.js (npx)
npx serve apps/homepage.ob

# With any static host — no build required
```

## Deploying

This site deploys to any static host as-is.

### Cloudflare Pages (recommended)

```bash
# From the repo root
npx wrangler pages deploy apps/homepage.ob --project-name ottabase-homepage
```

### Netlify / Vercel

Drag and drop the `apps/homepage.ob/` folder into the Netlify or Vercel dashboard.

### GitHub Pages

Push the contents of `apps/homepage.ob/` to a `gh-pages` branch.

## Updating content

All content is hardcoded in the HTML files. The package list lives in `packages.html`. To update:

- **Tagline / hero copy** → `index.html` hero section
- **Package details** → `packages.html` individual `.pkg-card` elements
- **Philosophy text** → `philosophy.html` prose sections
- **Get started code** → `docs.html` code blocks
- **Colors / design tokens** → `css/main.css` `:root` block
- **Animations** → `js/main.js`

## File structure

```
apps/homepage.ob/
├── index.html        ← Main landing page
├── packages.html     ← Package ecosystem
├── philosophy.html   ← Architecture manifesto
├── docs.html         ← Get started guide
├── css/
│   └── main.css      ← Design system (tokens, components, animations)
├── js/
│   └── main.js       ← Interactions (tabs, scroll, terminal, filter, copy)
└── README.md
```
