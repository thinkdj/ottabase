import type { EmailAddress, Mailer, SendEmailInput } from '../types';

export interface ResendMailerOptions {
    apiKey: string;
    baseUrl?: string;
}

const DEFAULT_RESEND_BASE_URL = 'https://api.resend.com';

function formatAddress(address: EmailAddress) {
    if (typeof address === 'string') return address;
    if (address.name) return `${address.name} <${address.email}>`;
    return address.email;
}

function normalizeAddressList(address?: EmailAddress | EmailAddress[]): string[] | undefined {
    if (!address) return undefined;
    if (Array.isArray(address)) return address.map(formatAddress);
    return [formatAddress(address)];
}

function removeUndefined<T extends Record<string, unknown>>(payload: T) {
    const cleaned = {} as T;
    for (const key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            const value = payload[key];
            if (value !== undefined) {
                cleaned[key] = value;
            }
        }
    }
    return cleaned;
}

export function createResendMailer(options: ResendMailerOptions): Mailer {
    const provider = 'resend';
    const baseUrl = options.baseUrl ?? DEFAULT_RESEND_BASE_URL;

    return {
        provider,
        async send(input: SendEmailInput) {
            try {
                const payload = removeUndefined({
                    from: formatAddress(input.from),
                    to: normalizeAddressList(input.to),
                    subject: input.subject,
                    html: input.html,
                    text: input.text,
                    cc: normalizeAddressList(input.cc),
                    bcc: normalizeAddressList(input.bcc),
                    reply_to: input.replyTo ? formatAddress(input.replyTo) : undefined,
                    headers: input.headers,
                    tags: input.tags?.map((tag) => ({ name: tag })),
                });

                const response = await fetch(`${baseUrl}/emails`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${options.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });

                const json = await response.json().catch(() => null);

                if (!response.ok) {
                    return {
                        provider,
                        success: false,
                        error: json?.message || `Resend request failed (${response.status})`,
                        raw: json,
                    };
                }

                return {
                    provider,
                    success: true,
                    id: json?.id,
                    raw: json,
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
