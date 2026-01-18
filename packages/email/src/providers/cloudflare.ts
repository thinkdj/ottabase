import type { EmailProvider, EmailMessage, SendEmailResult, EmailAddress } from "../types";

/**
 * Cloudflare Email Workers binding type
 * This matches the SendEmail binding from Cloudflare Workers
 */
export interface CloudflareEmailBinding {
  send(message: CloudflareEmailMessage): Promise<void>;
}

/**
 * Cloudflare Email message format
 */
export interface CloudflareEmailMessage {
  from: string;
  to: string;
  subject: string;
  content: string;
  contentType?: "text/plain" | "text/html";
}

/**
 * Configuration for Cloudflare Email provider
 */
export interface CloudflareEmailProviderConfig {
  /**
   * The Email binding from your Cloudflare Worker environment
   * Configure in wrangler.toml:
   * ```toml
   * [[send_email]]
   * name = "EMAIL"
   * ```
   */
  binding: CloudflareEmailBinding;
}

/**
 * Format email address
 */
function formatAddress(addr: string | EmailAddress): string {
  if (typeof addr === "string") {
    return addr;
  }
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

/**
 * Create a Cloudflare Email Workers provider
 *
 * This provider uses Cloudflare's native Email Workers to send emails.
 * It requires email routing to be set up in your Cloudflare dashboard.
 *
 * Note: Cloudflare Email Workers have some limitations:
 * - Can only send to addresses on domains you own/control
 * - Primarily designed for email routing, not bulk sending
 * - Consider using this for internal notifications
 *
 * For production transactional emails, Resend is recommended.
 *
 * @example
 * ```ts
 * // In your Cloudflare Worker
 * export default {
 *   async fetch(request, env) {
 *     const emailProvider = createCloudflareEmailProvider({ binding: env.EMAIL });
 *     await emailProvider.send({ ... });
 *   }
 * }
 * ```
 */
export function createCloudflareEmailProvider(
  config: CloudflareEmailProviderConfig
): EmailProvider {
  const { binding } = config;

  return {
    name: "cloudflare",

    async send(message: EmailMessage): Promise<SendEmailResult> {
      const { to, from, subject, html, text } = message;

      // Cloudflare Email Workers only support single recipient per send
      const toAddresses = Array.isArray(to) ? to : [to];

      try {
        // Send to each recipient
        for (const recipient of toAddresses) {
          const cfMessage: CloudflareEmailMessage = {
            from: formatAddress(from),
            to: formatAddress(recipient),
            subject,
            content: html,
            contentType: "text/html",
          };

          await binding.send(cfMessage);
        }

        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown Cloudflare email error",
        };
      }
    },
  };
}

/**
 * Alternative: Cloudflare MailChannels integration
 *
 * MailChannels provides free email sending for Cloudflare Workers.
 * This is a better option for transactional emails from Workers.
 *
 * Note: Requires SPF record setup for your domain.
 */
export interface MailChannelsConfig {
  /** Your domain (must have SPF record configured) */
  domain: string;
  /** DKIM private key (optional but recommended) */
  dkimPrivateKey?: string;
  /** DKIM selector (optional) */
  dkimSelector?: string;
}

/**
 * Create a MailChannels provider (via Cloudflare Workers)
 *
 * Free email sending through Cloudflare Workers using MailChannels.
 * Requires SPF record: v=spf1 a mx include:relay.mailchannels.net ~all
 *
 * @example
 * ```ts
 * const mailChannels = createMailChannelsProvider({ domain: "myapp.com" });
 * await mailChannels.send({ ... });
 * ```
 */
export function createMailChannelsProvider(config: MailChannelsConfig): EmailProvider {
  const { domain, dkimPrivateKey, dkimSelector } = config;

  return {
    name: "mailchannels",

    async send(message: EmailMessage): Promise<SendEmailResult> {
      const { to, from, subject, html, text, replyTo } = message;

      const toAddresses = Array.isArray(to) ? to : [to];
      const personalizations = toAddresses.map((addr) => ({
        to: [
          typeof addr === "string"
            ? { email: addr }
            : { email: addr.email, name: addr.name },
        ],
      }));

      const fromAddr = typeof from === "string"
        ? { email: from }
        : { email: from.email, name: from.name };

      const body: Record<string, unknown> = {
        personalizations,
        from: fromAddr,
        subject,
        content: [
          ...(text ? [{ type: "text/plain", value: text }] : []),
          { type: "text/html", value: html },
        ],
      };

      if (replyTo) {
        body.reply_to = typeof replyTo === "string"
          ? { email: replyTo }
          : { email: replyTo.email, name: replyTo.name };
      }

      // Add DKIM if configured
      if (dkimPrivateKey && dkimSelector) {
        body.dkim_domain = domain;
        body.dkim_selector = dkimSelector;
        body.dkim_private_key = dkimPrivateKey;
      }

      try {
        const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = await response.text();
          return {
            success: false,
            error: `MailChannels error: ${response.status} - ${error}`,
          };
        }

        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown MailChannels error",
        };
      }
    },
  };
}
