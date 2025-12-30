import {
  createAppConfig,
  createThemeColors,
  DEFAULT_THEME_COLORS,
} from "@ottabase/config";

export const appConfig = createAppConfig({
  appName: "Ottabase Template App (TanStack)",
  defaults: {
    meta: {
      author: "@thinkdj",
      description: "A minimal TanStack + Cloudflare Workers template app in the Ottabase monorepo",
      keywords:
        "Ottabase, TanStack Router, TanStack Query, Vite, Tailwind, Shadcn, Cloudflare Workers, TypeScript, React",
      companyName: "Ottabase",
    },
    uiFramework: "mantine",
    ui: {
      preventFOUC: false,
      preventFOUCInsideIframe: false,
      debounceMs: 500,
      layout: {
        minWidth: 320,
        maxWidth: 1280,
      },
      enforceGoogleFonts: true,
    },
    theme: {
      colorDefault: "tremorBlue",
      colors: createThemeColors({
        ...DEFAULT_THEME_COLORS,
      }),
    },
    storage: {
      prefix: "ottabase",
    },
    api: {
      serverErrorHttpCode: 500,
    },
    features: {
      spotlight: {
        enabled: false,
        shortcuts: [],
      },
      crudHub: {
        apiBaseUrl: "/api/crudhub",
        urlBase: "crudhub",
        urlBaseListing: "browse",
      },
      pagination: {
        defaultPageSize: 10,
        maxPageSize: 100,
        sizeOptions: [5, 10, 20, 50, 100],
      },
    },
    model: {
      defaultRelKey: "defaults",
    },
  },
});

export const APP_META = appConfig.meta;
export default appConfig;
