/**
 * Nodemailer Email Provider
 *
 * For use in Node.js environments (not edge runtimes like Cloudflare Workers).
 * Perfect for local development with email catchers like HELO, MailHog, Mailpit, etc.
 */
import type {
  EmailProvider,
  EmailMessage,
  SendEmailResult,
  EmailAddress,
} from "../types";

/**
 * SMTP configuration for Nodemailer
 */
export interface SmtpConfig {
  /** SMTP host (e.g., "localhost", "smtp.example.com") */
  host: string;
  /** SMTP port (e.g., 25, 465, 587, 2525) */
  port: number;
  /** Use TLS/SSL */
  secure?: boolean;
  /** Authentication credentials (optional for local dev) */
  auth?: {
    user: string;
    pass: string;
  };
  /** Ignore self-signed certificates (useful for local dev) */
  ignoreTLS?: boolean;
  /** Require TLS */
  requireTLS?: boolean;
}

/**
 * Configuration for Nodemailer provider
 */
export interface NodemailerProviderConfig {
  /** SMTP configuration */
  smtp: SmtpConfig;
  /** Default from address */
  defaultFrom?: string | EmailAddress;
}

/**
 * Normalize email address to string format
 */
function normalizeAddress(addr: string | EmailAddress): string {
  if (typeof addr === "string") {
    return addr;
  }
  return addr.name ? `"${addr.name}" <${addr.email}>` : addr.email;
}

/**
 * Normalize array of addresses
 */
function normalizeAddresses(
  addrs: string | EmailAddress | (string | EmailAddress)[] | undefined
): string | string[] | undefined {
  if (!addrs) return undefined;
  const arr = Array.isArray(addrs) ? addrs : [addrs];
  const normalized = arr.map(normalizeAddress);
  return normalized.length === 1 ? normalized[0] : normalized;
}

/**
 * Create a Nodemailer email provider
 *
 * For use with local SMTP servers like:
 * - HELO (macOS): port 2525
 * - MailHog: port 1025
 * - Mailpit: port 1025
 *
 * @example
 * ```ts
 * // For HELO on macOS
 * const provider = createNodemailerProvider({
 *   smtp: {
 *     host: "localhost",
 *     port: 2525,
 *     secure: false,
 *   },
 * });
 *
 * // For MailHog/Mailpit
 * const provider = createNodemailerProvider({
 *   smtp: {
 *     host: "localhost",
 *     port: 1025,
 *     secure: false,
 *   },
 * });
 * ```
 */
export function createNodemailerProvider(
  config: NodemailerProviderConfig
): EmailProvider {
  const { smtp, defaultFrom } = config;

  // Lazy load nodemailer to avoid issues in edge runtimes
  let transporter: any = null;

  async function getTransporter() {
    if (transporter) return transporter;

    // Dynamic import to avoid bundling issues
    const nodemailer = await import("nodemailer");
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure ?? false,
      auth: smtp.auth,
      ignoreTLS: smtp.ignoreTLS,
      requireTLS: smtp.requireTLS,
      // For local dev, don't verify certificates
      tls: {
        rejectUnauthorized: false,
      },
    });

    return transporter;
  }

  return {
    name: "nodemailer",

    async send(message: EmailMessage): Promise<SendEmailResult> {
      const { to, from, subject, html, text, replyTo, cc, bcc } = message;

      const fromAddress = from || defaultFrom;
      if (!fromAddress) {
        return {
          success: false,
          error: "No from address provided",
        };
      }

      try {
        const transport = await getTransporter();

        const mailOptions = {
          from: normalizeAddress(fromAddress),
          to: normalizeAddresses(to),
          subject,
          html,
          text,
          replyTo: replyTo ? normalizeAddress(replyTo) : undefined,
          cc: normalizeAddresses(cc),
          bcc: normalizeAddresses(bcc),
        };

        const info = await transport.sendMail(mailOptions);

        return {
          success: true,
          messageId: info.messageId,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  };
}

/**
 * Pre-configured provider for HELO (macOS email catcher)
 * Default port: 2525
 */
export function createHeloProvider(options?: {
  host?: string;
  port?: number;
}): EmailProvider {
  return createNodemailerProvider({
    smtp: {
      host: options?.host ?? "localhost",
      port: options?.port ?? 2525,
      secure: false,
    },
  });
}

/**
 * Pre-configured provider for MailHog/Mailpit
 * Default port: 1025
 */
export function createMailhogProvider(options?: {
  host?: string;
  port?: number;
}): EmailProvider {
  return createNodemailerProvider({
    smtp: {
      host: options?.host ?? "localhost",
      port: options?.port ?? 1025,
      secure: false,
    },
  });
}
