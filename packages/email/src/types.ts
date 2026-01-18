/**
 * Email address with optional name
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

/**
 * Email message configuration
 */
export interface EmailMessage {
  to: string | EmailAddress | (string | EmailAddress)[];
  from: string | EmailAddress;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | EmailAddress;
  cc?: string | EmailAddress | (string | EmailAddress)[];
  bcc?: string | EmailAddress | (string | EmailAddress)[];
}

/**
 * Result from sending an email
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email provider interface
 */
export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<SendEmailResult>;
}

/**
 * Template data that can be passed to templates
 */
export type TemplateData = Record<string, unknown>;

/**
 * Base template configuration
 */
export interface BaseTemplateConfig {
  /** Company/App name shown in header */
  appName?: string;
  /** Logo URL (optional) */
  logoUrl?: string;
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** Footer text */
  footerText?: string;
  /** Support email */
  supportEmail?: string;
  /** Company address for footer */
  address?: string;
}

/**
 * Email template definition
 */
export interface EmailTemplate<T = TemplateData> {
  /** Template name/identifier */
  name: string;
  /** Subject line (can contain {{variables}}) */
  subject: string;
  /** Render the email HTML */
  render(data: T, config?: BaseTemplateConfig): string;
  /** Render plain text version */
  renderText?(data: T): string;
}

/**
 * Options for creating an email
 */
export interface CreateEmailOptions<T = TemplateData> {
  template: EmailTemplate<T>;
  data: T;
  to: string | EmailAddress | (string | EmailAddress)[];
  from: string | EmailAddress;
  config?: BaseTemplateConfig;
  replyTo?: string | EmailAddress;
}
