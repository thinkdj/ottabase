import type { EmailAddress, Mailer, SendEmailInput, SendEmailResult } from '../types';

export interface CloudflareMailerOptions {
    send: (input: SendEmailInput) => Promise<{ id?: string } | void>;
    providerName?: string;
}

export function createCloudflareMailer(options: CloudflareMailerOptions): Mailer {
    const provider = options.providerName ?? 'cloudflare';

    return {
        provider,
        async send(input: SendEmailInput): Promise<SendEmailResult> {
            try {
                const result = await options.send(input);
                return {
                    provider,
                    success: true,
                    id: result?.id,
                    raw: result,
                };
            } catch (error) {
                return {
                    provider,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        },
    };
}

// ── MailChannels (Cloudflare-native email) ─────────────────────────

export interface MailChannelsOptions {
    /** DKIM domain for email signing (recommended for deliverability) */
    dkimDomain?: string;
    /** DKIM selector (defaults to 'mailchannels') */
    dkimSelector?: string;
    /** DKIM private key (PEM format) */
    dkimPrivateKey?: string;
}

function formatAddr(addr: EmailAddress): { email: string; name?: string } {
    if (typeof addr === 'string') return { email: addr };
    return { email: addr.email, ...(addr.name && { name: addr.name }) };
}

function formatAddrList(addr?: EmailAddress | EmailAddress[]): Array<{ email: string; name?: string }> | undefined {
    if (!addr) return undefined;
    if (Array.isArray(addr)) return addr.map(formatAddr);
    return [formatAddr(addr)];
}

/**
 * MailChannels mailer for Cloudflare Workers.
 * Uses the MailChannels transactional API (https://api.mailchannels.net/tx/v1/send).
 *
 * @example
 * ```ts
 * const mailer = createMailChannelsMailer({
 *     dkimDomain: 'example.com',
 *     dkimSelector: 'mailchannels',
 *     dkimPrivateKey: env.DKIM_PRIVATE_KEY,
 * });
 * await mailer.send({ from: 'hi@example.com', to: 'user@test.com', subject: 'Hello', html: '<p>Hi</p>' });
 * ```
 */
export function createMailChannelsMailer(options: MailChannelsOptions = {}): Mailer {
    const provider = 'mailchannels';

    return {
        provider,
        async send(input: SendEmailInput): Promise<SendEmailResult> {
            try {
                const to = formatAddrList(input.to) || [];
                const personalizations: Record<string, unknown> = { to };

                const cc = formatAddrList(input.cc);
                if (cc) personalizations.cc = cc;
                const bcc = formatAddrList(input.bcc);
                if (bcc) personalizations.bcc = bcc;

                if (options.dkimDomain) {
                    personalizations.dkim_domain = options.dkimDomain;
                    personalizations.dkim_selector = options.dkimSelector || 'mailchannels';
                    personalizations.dkim_private_key = options.dkimPrivateKey;
                }

                const content: Array<{ type: string; value: string }> = [];
                if (input.text) content.push({ type: 'text/plain', value: input.text });
                content.push({ type: 'text/html', value: input.html });

                const payload: Record<string, unknown> = {
                    personalizations: [personalizations],
                    from: formatAddr(input.from),
                    subject: input.subject,
                    content,
                };

                if (input.replyTo) payload.reply_to = formatAddr(input.replyTo);

                const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const text = await response.text();
                    return { provider, success: false, error: `MailChannels error (${response.status}): ${text}` };
                }

                return { provider, success: true, id: `mc-${Date.now()}` };
            } catch (error) {
                return {
                    provider,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        },
    };
}
