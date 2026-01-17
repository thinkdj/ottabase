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
      referrals: {
        enabled: true,
        trackClicks: true, // Set to false to disable click tracking (only track conversions)
        expiryDays: 90, // How long stored referral codes are valid
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

// Export specific config parts for convenience (matching main template app structure)
export const APP_META = appConfig.meta;
export const UI_FRAMEWORK_DEFAULT = appConfig.uiFramework;
export const PREVENT_FOUC = appConfig.ui.preventFOUC;
export const PREVENT_FOUC_INSIDE_IFRAME = appConfig.ui.preventFOUCInsideIframe;
export const PREFIX_STORAGE_APP = `${appConfig.storage.prefix}.`;
export const SERVER_ERROR_HTTP_CODE = appConfig.api.serverErrorHttpCode;
export const UI_DEBOUNCE_MS = appConfig.ui.debounceMs;

// CrudHub
export const CRUDHUB_API_BASE_URL = appConfig.features.crudHub.apiBaseUrl;
export const CRUDHUB_URL_BASE = appConfig.features.crudHub.urlBase;
export const CRUDHUB_URL_BASE_LISTING = appConfig.features.crudHub.urlBaseListing;

// Model
export const MODEL_DEFAULT_REL_KEY = appConfig.model.defaultRelKey;

// Pagination
export const PAGE_SIZE_DEFAULT = appConfig.features.pagination.defaultPageSize;
export const PAGE_SIZE_MAX = appConfig.features.pagination.maxPageSize;
export const PAGE_SIZE_OPTIONS = appConfig.features.pagination.sizeOptions;

// Spotlight
export const SPOTLIGHT_CONFIG = appConfig.features.spotlight;

// Referrals
export const REFERRALS_CONFIG = appConfig.features.referrals;

// Layout
export const UI_LAYOUT = appConfig.ui.layout;

// Google Fonts
export const ENFORCE_GOOGLE_FONTS = appConfig.ui.enforceGoogleFonts;

// Theme / Colors
export const THEME_COLOR_DEFAULT = appConfig.theme.colorDefault;
export const THEME_COLORS = appConfig.theme.colors;

// Export the full config for modern usage
export default appConfig;

// Export commonly used values
export const APP_NAME = APP_META.appName;
export const APP_TITLE = APP_META.title;
export const APP_DESCRIPTION = APP_META.description;
export const STORAGE_PREFIX = appConfig.storage.prefix;
