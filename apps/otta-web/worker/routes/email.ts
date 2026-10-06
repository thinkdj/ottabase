import { sendTemplatedEmail } from '@ottabase/email';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { readJson } from '../lib/utils';
import { isDevTrapAvailable, resolveAppMailer } from '../lib/email-provider';
import { requireAdminAccess } from '../lib/admin-guard';
import { appEmail, composeAppEmail } from '../../src/email/catalog';
import type { ApiRouteContext } from './router';

export async function handleEmailProviders(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

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

export async function handleEmailTest(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const { request, env } = context;
    const body = await readJson<{
        recipients?: string[];
        /** Which app email to send; its sample values fill it. Default: the test email */
        email?: string;
        provider?: 'auto' | 'dev-trap' | 'resend' | 'ses' | 'nodemailer';
    }>(request);
    const recipients = body.recipients || [];
    if (!recipients.length) {
        return errorResponse('Recipients list is required', 400, { code: 'VALIDATION_ERROR' });
    }
    const email = appEmail(body.email ?? 'test');
    if (!email) return errorResponse('Unknown email', 400, { code: 'VALIDATION_ERROR' });

    const { mailer, from, provider, error } = await resolveAppMailer(env, body.provider || 'auto');
    if (!mailer) {
        return errorResponse(error || 'No email provider configured', 400, { code: 'CONFIG_ERROR' });
    }

    const message = composeAppEmail(email.id, email.sample);
    const results = await Promise.all(
        recipients.map(async (to) => {
            const response = await sendTemplatedEmail(mailer, { from, to, ...message });
            return { email: to, ok: response.success, provider: provider || 'unknown' };
        }),
    );

    return jsonResponse({ ok: true, email: email.id, results });
}
