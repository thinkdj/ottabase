import type { EmailProvider, EmailMessage, SendEmailResult, EmailAddress } from "../types";

/**
 * Configuration for Resend provider
 */
export interface ResendProviderConfig {
  apiKey: string;
  /** Base URL for Resend API (default: https://api.resend.com) */
  baseUrl?: string;
}

/**
 * Normalize email address to Resend format
 */
function normalizeAddress(addr: string | EmailAddress): string {
  if (typeof addr === "string") {
    return addr;
  }
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

/**
 * Normalize array of addresses
 */
function normalizeAddresses(
  addrs: string | EmailAddress | (string | EmailAddress)[] | undefined
): string[] | undefined {
  if (!addrs) return undefined;
  const arr = Array.isArray(addrs) ? addrs : [addrs];
  return arr.map(normalizeAddress);
}

/**
 * Create a Resend email provider
 *
 * Resend is a modern email API that works well with edge runtimes.
 * https://resend.com
 *
 * @example
 * ```ts
 * const resend = createResendProvider({ apiKey: process.env.RESEND_API_KEY });
 * const result = await resend.send({
 *   to: "user@example.com",
 *   from: "hello@myapp.com",
 *   subject: "Welcome!",
 *   html: "<p>Hello world</p>",
 * });
 * ```
 */
export function createResendProvider(config: ResendProviderConfig): EmailProvider {
  const { apiKey, baseUrl = "https://api.resend.com" } = config;

  return {
    name: "resend",

    async send(message: EmailMessage): Promise<SendEmailResult> {
      const { to, from, subject, html, text, replyTo, cc, bcc } = message;

      const body = {
        to: normalizeAddresses(to),
        from: normalizeAddress(from),
        subject,
        html,
        text,
        reply_to: replyTo ? normalizeAddress(replyTo) : undefined,
        cc: normalizeAddresses(cc),
        bcc: normalizeAddresses(bcc),
      };

      try {
        const response = await fetch(`${baseUrl}/emails`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return {
            success: false,
            error: (error as { message?: string }).message || `Resend API error: ${response.status}`,
          };
        }

        const result = await response.json() as { id: string };

        return {
          success: true,
          messageId: result.id,
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
