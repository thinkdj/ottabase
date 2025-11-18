import { z } from "zod";
import { url, bool, positiveInt, optionalString, optionalNumber, optionalBool } from "../helpers";

/**
 * Environment schema for @ottabase/config package
 * Application configuration with NEXT_PUBLIC_ prefix for client-side access
 */
export const configEnvSchema = z.object({
  // App metadata
  NEXT_PUBLIC_APP_NAME: optionalString("Ottabase").describe("Application name"),

  NEXT_PUBLIC_APP_LOGO_URL: z
    .string()
    .optional()
    .describe("Application logo URL"),

  NEXT_PUBLIC_APP_TITLE: optionalString("Ottabase Application").describe(
    "Application title (for browser tab)",
  ),

  NEXT_PUBLIC_APP_AUTHOR: z.string().optional().describe("Application author"),

  NEXT_PUBLIC_APP_DESCRIPTION: optionalString(
    "A modern application built with Ottabase",
  ).describe("Application description for SEO"),

  NEXT_PUBLIC_APP_KEYWORDS: optionalString("").describe(
    "Application keywords for SEO (comma-separated)",
  ),

  NEXT_PUBLIC_APP_ROBOTS: optionalString("index, follow").describe(
    "Robots meta tag content",
  ),

  NEXT_PUBLIC_APP_COPYRIGHT_TEXT: z
    .string()
    .optional()
    .describe("Copyright text in footer"),

  NEXT_PUBLIC_APP_COMPANY_NAME: z
    .string()
    .optional()
    .describe("Company name"),

  // UI Framework
  NEXT_PUBLIC_UI_FRAMEWORK: z
    .enum(["mantine", "shadcn"])
    .optional()
    .default("mantine")
    .describe("UI framework to use (mantine or shadcn)"),

  // FOUC Prevention
  NEXT_PUBLIC_PREVENT_FOUC: optionalBool(false).describe(
    "Prevent flash of unstyled content",
  ),

  NEXT_PUBLIC_PREVENT_FOUC_TIMEOUT: optionalNumber(100).describe(
    "FOUC prevention timeout in milliseconds",
  ),

  // UI Layout
  NEXT_PUBLIC_UI_LAYOUT_HEADER_HEIGHT: optionalNumber(60).describe(
    "Header height in pixels",
  ),

  NEXT_PUBLIC_UI_LAYOUT_SIDEBAR_WIDTH: optionalNumber(300).describe(
    "Sidebar width in pixels",
  ),

  NEXT_PUBLIC_UI_LAYOUT_SIDEBAR_COLLAPSED_WIDTH: optionalNumber(80).describe(
    "Collapsed sidebar width in pixels",
  ),

  // UI Behavior
  NEXT_PUBLIC_UI_DEBOUNCE_MS: optionalNumber(300).describe(
    "Debounce delay for UI inputs in milliseconds",
  ),

  // Theme
  NEXT_PUBLIC_THEME_COLOR_DEFAULT: optionalString("#3b82f6").describe(
    "Default theme color (hex code)",
  ),

  // Storage
  NEXT_PUBLIC_STORAGE_PREFIX: optionalString("ottabase_").describe(
    "LocalStorage key prefix",
  ),

  // Features
  NEXT_PUBLIC_SPOTLIGHT_ENABLED: optionalBool(true).describe(
    "Enable spotlight search feature",
  ),

  // CRUD Hub
  NEXT_PUBLIC_CRUDHUB_ENABLED: optionalBool(true).describe(
    "Enable CRUD Hub feature",
  ),

  NEXT_PUBLIC_CRUDHUB_BASE_PATH: optionalString("/crud").describe(
    "Base path for CRUD Hub routes",
  ),

  // Authentication
  NEXT_PUBLIC_AUTH_LOGIN_URL: optionalString("/auth/login").describe(
    "Login page URL",
  ),

  NEXT_PUBLIC_AUTH_LOGOUT_URL: optionalString("/auth/logout").describe(
    "Logout endpoint URL",
  ),

  NEXT_PUBLIC_AUTH_REGISTER_URL: optionalString("/auth/register").describe(
    "Registration page URL",
  ),

  NEXT_PUBLIC_AUTH_REDIRECT_URL: optionalString("/dashboard").describe(
    "Post-login redirect URL",
  ),

  // Pagination
  NEXT_PUBLIC_PAGE_SIZE_DEFAULT: optionalNumber(10).describe(
    "Default page size for pagination",
  ),

  NEXT_PUBLIC_PAGE_SIZE_OPTIONS: optionalString("10,20,50,100").describe(
    "Available page size options (comma-separated)",
  ),

  // API Configuration
  NEXT_PUBLIC_API_BASE_URL: z
    .string()
    .url()
    .optional()
    .describe("Base URL for API calls"),

  NEXT_PUBLIC_API_TIMEOUT: optionalNumber(30000).describe(
    "API request timeout in milliseconds",
  ),
});

export type ConfigEnv = z.infer<typeof configEnvSchema>;
