import type { Mailer, SendEmailInput, SendEmailResult } from '../types';

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
