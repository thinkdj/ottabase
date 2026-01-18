import type {
  EmailProvider,
  EmailMessage,
  SendEmailResult,
  EmailTemplate,
  TemplateData,
  BaseTemplateConfig,
  EmailAddress,
} from "./types";
import { renderTemplate } from "./engine";

/**
 * Mailer configuration
 */
export interface MailerConfig {
  /** Default email provider */
  provider: EmailProvider;
  /** Default from address */
  defaultFrom?: string | EmailAddress;
  /** Base template configuration (branding, footer, etc.) */
  templateConfig?: BaseTemplateConfig;
}

/**
 * Options for sending a templated email
 */
export interface SendTemplateOptions<T = TemplateData> {
  /** Email template to use */
  template: EmailTemplate<T>;
  /** Template data/replacements */
  data: T;
  /** Recipient(s) */
  to: string | EmailAddress | (string | EmailAddress)[];
  /** Sender (overrides default) */
  from?: string | EmailAddress;
  /** Reply-to address */
  replyTo?: string | EmailAddress;
  /** Override template config for this email */
  templateConfig?: BaseTemplateConfig;
  /** Override the template's default subject line */
  subject?: string;
}

/**
 * Mailer class for sending templated emails
 *
 * @example
 * ```ts
 * import { Mailer, createResendProvider, loginTemplate } from "@ottabase/email";
 *
 * const mailer = new Mailer({
 *   provider: createResendProvider({ apiKey: process.env.RESEND_API_KEY }),
 *   defaultFrom: "hello@myapp.com",
 *   templateConfig: {
 *     appName: "My App",
 *     primaryColor: "#4F46E5",
 *   },
 * });
 *
 * // Send a login email
 * await mailer.send({
 *   template: loginTemplate,
 *   data: { url: "https://myapp.com/auth?token=xxx" },
 *   to: "user@example.com",
 * });
 * ```
 */
export class Mailer {
  private provider: EmailProvider;
  private defaultFrom?: string | EmailAddress;
  private templateConfig?: BaseTemplateConfig;

  constructor(config: MailerConfig) {
    this.provider = config.provider;
    this.defaultFrom = config.defaultFrom;
    this.templateConfig = config.templateConfig;
  }

  /**
   * Send an email using a template
   */
  async send<T>(
    options: SendTemplateOptions<T>
  ): Promise<SendEmailResult> {
    const { template, data, to, from, replyTo, templateConfig, subject: subjectOverride } = options;

    const fromAddress = from ?? this.defaultFrom;
    if (!fromAddress) {
      return {
        success: false,
        error: "No from address provided",
      };
    }

    const mergedConfig = { ...this.templateConfig, ...templateConfig };

    // Render subject with data (use override if provided)
    const subjectTemplate = subjectOverride ?? template.subject;
    const subject = renderTemplate(subjectTemplate, {
      ...mergedConfig,
      ...data,
    } as TemplateData);

    // Render HTML
    const html = template.render(data, mergedConfig);

    // Render plain text if available
    const text = template.renderText?.(data);

    const message: EmailMessage = {
      to,
      from: fromAddress,
      subject,
      html,
      text,
      replyTo,
    };

    return this.provider.send(message);
  }

  /**
   * Send a raw email message (bypassing templates)
   */
  async sendRaw(message: Omit<EmailMessage, "from"> & { from?: string | EmailAddress }): Promise<SendEmailResult> {
    const fromAddress = message.from ?? this.defaultFrom;
    if (!fromAddress) {
      return {
        success: false,
        error: "No from address provided",
      };
    }

    return this.provider.send({
      ...message,
      from: fromAddress,
    });
  }

  /**
   * Update the email provider
   */
  setProvider(provider: EmailProvider): void {
    this.provider = provider;
  }

  /**
   * Update default from address
   */
  setDefaultFrom(from: string | EmailAddress): void {
    this.defaultFrom = from;
  }

  /**
   * Update template configuration
   */
  setTemplateConfig(config: BaseTemplateConfig): void {
    this.templateConfig = { ...this.templateConfig, ...config };
  }
}

/**
 * Create a mailer instance
 *
 * @example
 * ```ts
 * const mailer = createMailer({
 *   provider: createResendProvider({ apiKey: "re_xxx" }),
 *   defaultFrom: "hello@myapp.com",
 * });
 * ```
 */
export function createMailer(config: MailerConfig): Mailer {
  return new Mailer(config);
}
