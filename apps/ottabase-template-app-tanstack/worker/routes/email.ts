import { sendTemplatedEmail } from '@ottabase/email';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { readJson } from '../lib/utils';
import { isDevTrapAvailable, resolveAppMailer } from '../lib/email-provider';
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
        devTrap: {
            available: isDevTrapAvailable(env),
            required: ['DEV_EMAIL_TRAP_ENABLED', 'OBCF_KV'],
            optional: ['DEV_EMAIL_TRAP_MAX_EMAILS'],
        },
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
        provider?: 'auto' | 'dev-trap' | 'resend' | 'ses' | 'nodemailer';
    }>(request);
    const recipients = body.recipients || [];

    if (!recipients.length) {
        return errorResponse('Recipients list is required', 400, {
            code: 'VALIDATION_ERROR',
        });
    }

    registerAppEmailTemplates();

    const selectedProvider = body.provider || 'auto';
    const { mailer, from, provider, error } = await resolveAppMailer(env, selectedProvider);

    if (!mailer) {
        return errorResponse(error || 'No email provider configured', 400, {
            code: 'CONFIG_ERROR',
        });
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
                provider: provider || 'unknown',
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
