import { createResendMailer, createSESMailer, sendTemplatedEmail } from '@ottabase/email';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { readJson } from '../lib/utils';
import { registerAppEmailTemplates } from '../../src/email/templates';
import type { TemplateContent, TemplateVariables } from '@ottabase/email';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface EmailRouteContext {
    request: Request;
    env: CloudflareEnv;
}

export function handleEmailProviders(context: EmailRouteContext): Response {
    const { env } = context;
    const providers = {
        resend: {
            available: !!env.EMAIL_RESEND_API_KEY,
            required: ['EMAIL_RESEND_API_KEY'],
            optional: ['EMAIL_FROM'],
        },
        ses: {
            available: !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY),
            required: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
            optional: ['AWS_REGION', 'EMAIL_FROM'],
        },
        nodemailer: {
            available: !!env.EMAIL_SERVER,
            required: ['EMAIL_SERVER'],
            optional: ['EMAIL_FROM'],
        },
    };

    return jsonResponse(providers);
}

export async function handleEmailTest(context: EmailRouteContext): Promise<Response> {
    const { request, env } = context;
    const body = await readJson<{
        recipients?: string[];
        template?: string;
        emailType?: string;
        subject?: string;
        content?: TemplateContent;
        variables?: TemplateVariables;
        provider?: 'auto' | 'resend' | 'ses' | 'nodemailer';
    }>(request);

    const from = env.EMAIL_FROM || 'noreply@example.com';
    const recipients = body.recipients || [];

    if (!recipients.length) {
        return errorResponse('Recipients list is required', 400, {
            code: 'VALIDATION_ERROR',
        });
    }

    registerAppEmailTemplates();

    let mailer: any;
    const selectedProvider = body.provider || 'auto';

    if ((selectedProvider === 'nodemailer' || selectedProvider === 'auto') && env.EMAIL_SERVER) {
        const { createNodemailerMailer } = await import('@ottabase/email/providers/nodemailer');
        mailer = createNodemailerMailer({ server: env.EMAIL_SERVER });
    } else if (selectedProvider === 'nodemailer') {
        return errorResponse('EMAIL_SERVER must be configured for Nodemailer provider', 400, {
            code: 'CONFIG_ERROR',
        });
    }

    if (!mailer && (selectedProvider === 'ses' || selectedProvider === 'auto')) {
        if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
            mailer = createSESMailer({
                accessKeyId: env.AWS_ACCESS_KEY_ID,
                secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
                region: env.AWS_REGION || 'us-east-1',
            });
        } else if (selectedProvider === 'ses') {
            return errorResponse(
                'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured for SES provider',
                400,
                {
                    code: 'CONFIG_ERROR',
                },
            );
        }
    }

    if (!mailer && (selectedProvider === 'resend' || selectedProvider === 'auto')) {
        if (env.EMAIL_RESEND_API_KEY) {
            mailer = createResendMailer({ apiKey: env.EMAIL_RESEND_API_KEY });
        } else if (selectedProvider === 'resend') {
            return errorResponse('EMAIL_RESEND_API_KEY must be configured for Resend provider', 400, {
                code: 'CONFIG_ERROR',
            });
        }
    }

    if (!mailer) {
        return errorResponse(
            'No email provider configured. Set EMAIL_SERVER, EMAIL_RESEND_API_KEY, or AWS SES credentials',
            400,
            {
                code: 'CONFIG_ERROR',
            },
        );
    }

    const results = await Promise.all(
        recipients.map(async (email) => {
            const response = await sendTemplatedEmail(mailer, {
                from,
                to: email,
                template: body.template || 'default',
                subject: body.subject || 'Test Email',
                variables: body.variables,
                content: body.content || {
                    header: 'Test Email',
                    body: '<p>Hello from Ottabase.</p>',
                    footer: '<p>Sent from /api/email/test</p>',
                },
            });

            return {
                email,
                ok: response.success,
            };
        }),
    );

    return jsonResponse(
        {
            ok: true,
            emailType: body.emailType,
            results,
        },
        200,
    );
}
