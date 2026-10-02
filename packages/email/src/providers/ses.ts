import type { EmailAddress, Mailer, SendEmailInput } from '../types';

export interface SESMailerOptions {
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
}

const DEFAULT_REGION = 'us-east-1';

function formatAddress(address: EmailAddress): string {
    if (typeof address === 'string') return address;
    if (address.name) return `${address.name} <${address.email}>`;
    return address.email;
}

function normalizeAddressList(address?: EmailAddress | EmailAddress[]): string[] | undefined {
    if (!address) return undefined;
    if (Array.isArray(address)) return address.map(formatAddress);
    return [formatAddress(address)];
}

/**
 * AWS SES Mailer for Cloudflare Workers
 *
 * Uses AWS SES HTTP API (not SMTP) - works perfectly in Workers.
 * Requires AWS credentials with SES permissions.
 *
 * @example
 * ```typescript
 * import { createSESMailer } from "@ottabase/email/providers/ses";
 *
 * const mailer = createSESMailer({
 *   accessKeyId: env.AWS_ACCESS_KEY_ID,
 *   secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
 *   region: "us-east-1",
 * });
 *
 * await mailer.send({
 *   from: "noreply@example.com",
 *   to: "user@example.com",
 *   subject: "Hello",
 *   html: "<p>Body</p>",
 * });
 * ```
 */
export function createSESMailer(options: SESMailerOptions): Mailer {
    const provider = 'ses';
    const region = options.region ?? DEFAULT_REGION;
    // SES v2 is a REST-JSON API: SendEmail is `POST /v2/email/outbound-emails` (no X-Amz-Target).
    const path = '/v2/email/outbound-emails';
    const endpoint = `https://email.${region}.amazonaws.com${path}`;

    // AWS Signature Version 4 signing
    async function signRequest(method: string, path: string, payload: string): Promise<Headers> {
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const dateStamp = amzDate.slice(0, 8);

        const canonicalUri = path;
        const canonicalQueryString = '';
        const canonicalHeaders = `host:email.${region}.amazonaws.com\nx-amz-date:${amzDate}\n`;
        const signedHeaders = 'host;x-amz-date';
        const payloadHash = await sha256(payload);

        const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${region}/ses/aws4_request`;
        const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

        // The key chain passes RAW bytes between steps; only the final signature is hex.
        const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${options.secretAccessKey}`), dateStamp);
        const kRegion = await hmacSha256(kDate, region);
        const kService = await hmacSha256(kRegion, 'ses');
        const kSigning = await hmacSha256(kService, 'aws4_request');
        const signature = toHex(await hmacSha256(kSigning, stringToSign));

        const authorization = `${algorithm} Credential=${options.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const headers = new Headers();
        headers.set('Authorization', authorization);
        headers.set('x-amz-date', amzDate);
        headers.set('Content-Type', 'application/json');

        return headers;
    }

    return {
        provider,
        async send(input: SendEmailInput) {
            try {
                const toAddresses = normalizeAddressList(input.to) || [];
                const ccAddresses = normalizeAddressList(input.cc);
                const bccAddresses = normalizeAddressList(input.bcc);

                const payload = {
                    FromEmailAddress: formatAddress(input.from),
                    Destination: {
                        ToAddresses: toAddresses,
                        ...(ccAddresses && { CcAddresses: ccAddresses }),
                        ...(bccAddresses && { BccAddresses: bccAddresses }),
                    },
                    Content: {
                        Simple: {
                            Subject: {
                                Data: input.subject,
                                Charset: 'UTF-8',
                            },
                            Body: {
                                Html: input.html
                                    ? {
                                          Data: input.html,
                                          Charset: 'UTF-8',
                                      }
                                    : undefined,
                                Text: input.text
                                    ? {
                                          Data: input.text,
                                          Charset: 'UTF-8',
                                      }
                                    : undefined,
                            },
                            // Custom email headers (not EmailTags, which are SES event-publishing labels).
                            ...(input.headers && {
                                Headers: Object.entries(input.headers).map(([key, value]) => ({
                                    Name: key,
                                    Value: value,
                                })),
                            }),
                        },
                    },
                    ...(input.replyTo && {
                        ReplyToAddresses: [formatAddress(input.replyTo)],
                    }),
                };

                // Remove undefined fields
                if (!payload.Content.Simple.Body.Html) {
                    delete payload.Content.Simple.Body.Html;
                }
                if (!payload.Content.Simple.Body.Text) {
                    delete payload.Content.Simple.Body.Text;
                }

                const payloadString = JSON.stringify(payload);
                const headers = await signRequest('POST', path, payloadString);

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: payloadString,
                });

                const json: unknown = await response.json().catch(() => null);
                const data = json && typeof json === 'object' ? (json as Record<string, unknown>) : null;

                if (!response.ok) {
                    return {
                        provider,
                        success: false,
                        error:
                            (typeof data?.message === 'string' && data.message) ||
                            (typeof data?.__type === 'string' && data.__type) ||
                            `SES request failed (${response.status})`,
                        raw: json,
                    };
                }

                return {
                    provider,
                    success: true,
                    id: typeof data?.MessageId === 'string' ? data.MessageId : undefined,
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

// Crypto helpers for AWS Signature V4
async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    return toHex(await crypto.subtle.digest('SHA-256', msgBuffer));
}

async function hmacSha256(key: BufferSource, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}
