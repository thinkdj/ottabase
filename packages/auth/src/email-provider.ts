// ============================================================
// @ottabase/auth - Custom Email Provider with @ottabase/email
// ============================================================
//
// This provider uses @ottabase/email for templated magic link emails.
// Supports Resend and custom email providers.
//
// ============================================================

import type { EmailConfig } from "@auth/core/providers/email";
import {
  createMailer,
  createResendProvider,
  loginTemplate,
  type BaseTemplateConfig,
  type EmailProvider,
} from "@ottabase/email";

/**
 * Configuration for the custom email provider
 */
export interface CustomEmailProviderConfig {
  /** From email address */
  from: string;

  /** Email provider to use (defaults to Resend if RESEND_API_KEY is set) */
  provider?: EmailProvider;

  /** Resend API key (alternative to providing a custom provider) */
  resendApiKey?: string;

  /** Base template configuration for branding */
  templateConfig?: BaseTemplateConfig;

  /** Custom subject line */
  subject?: string;

  /** Magic link expiration time in seconds (default: 24 hours) */
  maxAge?: number;
}

/**
 * Create a custom email provider that uses @ottabase/email templates
 *
 * This provider sends beautiful, branded magic link emails using
 * the @ottabase/email templating system.
 *
 * @example
 * ```typescript
 * import { createOttabaseEmailProvider } from "@ottabase/auth";
 *
 * const provider = createOttabaseEmailProvider({
 *   from: "noreply@myapp.com",
 *   resendApiKey: process.env.RESEND_API_KEY,
 *   templateConfig: {
 *     appName: "My App",
 *     primaryColor: "#4F46E5",
 *     footerText: "You're receiving this because you signed up for My App.",
 *   },
 * });
 * ```
 */
export function createOttabaseEmailProvider(
  config: CustomEmailProviderConfig
): EmailConfig {
  const {
    from,
    provider,
    resendApiKey,
    templateConfig,
    subject,
    maxAge = 24 * 60 * 60, // 24 hours
  } = config;

  // Determine email provider
  let emailProvider: EmailProvider;
  if (provider) {
    emailProvider = provider;
  } else if (resendApiKey) {
    emailProvider = createResendProvider({ apiKey: resendApiKey });
  } else {
    throw new Error(
      "createOttabaseEmailProvider requires either a provider or resendApiKey"
    );
  }

  // Create mailer with template config
  const mailer = createMailer({
    provider: emailProvider,
    defaultFrom: from,
    templateConfig: {
      appName: "Ottabase",
      primaryColor: "#000000",
      footerText: "You received this email because you requested to sign in.",
      ...templateConfig,
    },
  });

  return {
    id: "email",
    type: "email",
    name: "Email",
    from,
    maxAge,
    options: {
      from,
      maxAge,
    },
    async sendVerificationRequest(params) {
      const { identifier: email, url, provider: providerConfig } = params;

      // Calculate expiration time
      const expiresIn = formatDuration(providerConfig.maxAge || maxAge);

      // Send email using our templated mailer
      const result = await mailer.send({
        template: loginTemplate,
        data: {
          url,
          email,
          expiresIn,
        },
        to: email,
        templateConfig: {
          ...templateConfig,
        },
      });

      if (!result.success) {
        throw new Error(`Failed to send verification email: ${result.error}`);
      }
    },
  };
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Environment-based email provider creator
 *
 * Automatically configures the email provider based on available env vars.
 *
 * @example
 * ```typescript
 * const provider = createEmailProviderFromEnv({
 *   RESEND_API_KEY: process.env.RESEND_API_KEY,
 *   EMAIL_FROM: "noreply@myapp.com",
 *   APP_NAME: "My App",
 * });
 * ```
 */
export function createEmailProviderFromEnv(env: {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_NAME?: string;
  APP_PRIMARY_COLOR?: string;
  APP_LOGO_URL?: string;
}): EmailConfig | null {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return null;
  }

  return createOttabaseEmailProvider({
    from: env.EMAIL_FROM,
    resendApiKey: env.RESEND_API_KEY,
    templateConfig: {
      appName: env.APP_NAME,
      primaryColor: env.APP_PRIMARY_COLOR,
      logoUrl: env.APP_LOGO_URL,
    },
  });
}
