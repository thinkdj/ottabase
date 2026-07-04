import {
    createSessionCookieForUser,
    getSession,
    handleAuthRequest,
    hashPassword,
    hashToken,
    revokeAllUserSessions,
    verifyPassword,
} from '@ottabase/auth/backend';
import { getLoginConfig } from '@ottabase/auth/components';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { sendTemplatedEmail } from '@ottabase/email';
import { registerConnection } from '@ottabase/ottaorm';
import { OrganizationMember, User, VerificationToken } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { isEmail } from '@ottabase/utils/string';
import { isValidUrl } from '@ottabase/utils/url';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { processReferralAttribution } from '../../ottabase/helpers/referral-attribution';
import { registerAppEmailTemplates } from '../../src/email/templates';
import {
    bumpProfileVersion,
    createVerificationToken,
    getAuthOptions,
    getUserLinkedAccounts,
    resolveMailer,
} from '../lib/auth-utils';
import { enforceRateLimit } from '../lib/rate-limiting';
import { provisionDefaultOrganizationForUser } from '../lib/user-provisioning';
import { getClientIpAddress, isStrongPassword, normalizeEmail, readJson } from '../lib/utils';

export interface AuthRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
    withAuthCors: (response: Response) => Response;
}

export function handleAuthConfig(context: AuthRouteContext): Response {
    const { env, withAuthCors } = context;
    const config = getLoginConfig(env as any);
    const response = jsonResponse(
        {
            ...config,
            authSecretConfigured: !!env.AUTH_SECRET,
        },
        200,
    );
    return withAuthCors(response);
}

export async function handleVerifyEmailResend(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:verify-resend:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    if (!env.OBCF_D1) {
        return withAuthCors(
            errorResponse('D1 database binding not configured', 500, {
                code: 'CONFIG_ERROR',
            }),
        );
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{ email?: string }>(request);
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';

    if (!email || !isEmail(email)) {
        return withAuthCors(
            errorResponse('Valid email is required', 400, {
                code: 'VALIDATION_ERROR',
            }),
        );
    }

    const user = await User.first({ email });
    if (!user) {
        return withAuthCors(jsonResponse({ success: true, sent: true }));
    }

    if (user.get('emailVerified')) {
        return withAuthCors(jsonResponse({ success: true, alreadyVerified: true }));
    }

    const { mailer, from } = await resolveMailer(env);
    if (!mailer) {
        return withAuthCors(
            errorResponse('No email provider configured', 500, {
                code: 'CONFIG_ERROR',
            }),
        );
    }

    registerAppEmailTemplates();
    const identifier = `verify:${email}`;
    const { token } = await createVerificationToken(env, identifier, 24 * 60 * 60);

    const verifyUrl = new URL(env.AUTH_URL || request.url);
    verifyUrl.pathname = '/api/auth/verify-email';
    verifyUrl.searchParams.set('token', token);
    verifyUrl.searchParams.set('email', email);

    await sendTemplatedEmail(mailer, {
        from,
        to: email,
        template: 'minimalist',
        subject: 'Verify your email',
        variables: {
            subject: 'Verify your email',
            header: 'Verify your email',
            body: `<p>Welcome! Please verify your email to activate your account.</p>
<p><a href="${verifyUrl.toString()}">Verify email</a></p>
<p>If you did not create this account, you can ignore this email.</p>`,
            footer: `<p>For security, this link expires in 24 hours.</p>`,
        },
    });

    return withAuthCors(jsonResponse({ success: true, sent: true }));
}

export async function handleVerifyEmail(context: AuthRouteContext): Promise<Response> {
    const { request, env, url, withAuthCors } = context;

    if (!env.OBCF_D1) {
        return withAuthCors(
            errorResponse('D1 database binding not configured', 500, {
                code: 'CONFIG_ERROR',
            }),
        );
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const token = url.searchParams.get('token') || '';
    const email = normalizeEmail(url.searchParams.get('email') || '');

    if (!token || !email) {
        return withAuthCors(
            errorResponse('Invalid verification link', 400, {
                code: 'INVALID_TOKEN',
            }),
        );
    }

    const identifier = `verify:${email}`;
    const tokenHash = await hashToken(token);
    // Atomic single-use consume (tokens are stored hashed).
    const verification = await VerificationToken.consumeByIdentifierAndToken(identifier, tokenHash);
    if (!verification) {
        return withAuthCors(
            errorResponse('Verification token is invalid or expired', 400, {
                code: 'INVALID_TOKEN',
            }),
        );
    }

    const expiresAt = Number(verification.get('expires'));
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        return withAuthCors(
            errorResponse('Verification token is invalid or expired', 400, {
                code: 'TOKEN_EXPIRED',
            }),
        );
    }

    const user = await User.first({ email });
    if (user) {
        user.set('emailVerified', Date.now());
        await user.save();
        // Reflect verification in any session that was already open before verifying.
        await bumpProfileVersion(env, user.get('id') as string);
    }

    const accept = request.headers.get('Accept') || '';
    if (accept.includes('text/html')) {
        const redirectUrl = env.AUTH_URL || new URL(request.url).origin;
        return Response.redirect(`${redirectUrl}/login?verified=1`, 303);
    }

    return withAuthCors(jsonResponse({ success: true }));
}

export async function handlePasswordResetRequest(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:password-reset:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    if (!env.OBCF_D1) {
        return withAuthCors(
            errorResponse('D1 database binding not configured', 500, {
                code: 'CONFIG_ERROR',
            }),
        );
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{ email?: string }>(request);
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';

    if (!email || !isEmail(email)) {
        return withAuthCors(
            errorResponse('Valid email is required', 400, {
                code: 'VALIDATION_ERROR',
            }),
        );
    }

    const user = await User.first({ email });
    if (!user) {
        return withAuthCors(jsonResponse({ success: true, sent: true }));
    }

    const { mailer, from } = await resolveMailer(env);
    if (!mailer) {
        return withAuthCors(
            errorResponse('No email provider configured', 500, {
                code: 'CONFIG_ERROR',
            }),
        );
    }

    registerAppEmailTemplates();
    const identifier = `reset:${email}`;
    const { token } = await createVerificationToken(env, identifier, 60 * 60);

    const resetUrl = new URL(env.AUTH_URL || request.url);
    resetUrl.pathname = '/reset-password';
    resetUrl.searchParams.set('token', token);
    resetUrl.searchParams.set('email', email);

    await sendTemplatedEmail(mailer, {
        from,
        to: email,
        template: 'minimalist',
        subject: 'Reset your password',
        variables: {
            subject: 'Reset your password',
            header: 'Reset your password',
            body: `<p>We received a request to reset your password.</p>
<p><a href="${resetUrl.toString()}">Reset password</a></p>
<p>If you did not request a password reset, you can ignore this email.</p>`,
            footer: `<p>This link expires in 60 minutes.</p>`,
        },
    });

    return withAuthCors(jsonResponse({ success: true, sent: true }));
}

export async function handlePasswordResetConfirm(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:password-reset-confirm:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    if (!env.OBCF_D1) {
        return withAuthCors(
            errorResponse('D1 database binding not configured', 500, {
                code: 'CONFIG_ERROR',
            }),
        );
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{ email?: string; token?: string; password?: string }>(request);
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const token = typeof body.token === 'string' ? body.token : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const fieldErrors: Record<string, string[]> = {};

    if (!email || !isEmail(email)) {
        fieldErrors.email = ['Valid email is required'];
    }
    if (!token) {
        fieldErrors.token = ['Reset token is required'];
    }
    if (!password) {
        fieldErrors.password = ['Password is required'];
    } else if (!isStrongPassword(password)) {
        fieldErrors.password = [
            'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol',
        ];
    }

    if (Object.keys(fieldErrors).length > 0) {
        return withAuthCors(
            errorResponse('Validation failed', 400, {
                code: 'VALIDATION_ERROR',
                fieldErrors,
            }),
        );
    }

    const identifier = `reset:${email}`;
    const tokenHash = await hashToken(token);
    // Atomic single-use consume (tokens are stored hashed).
    const verification = await VerificationToken.consumeByIdentifierAndToken(identifier, tokenHash);
    if (!verification) {
        return withAuthCors(
            errorResponse('Reset token is invalid or expired', 400, {
                code: 'INVALID_TOKEN',
            }),
        );
    }

    const expiresAt = Number(verification.get('expires'));
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        return withAuthCors(
            errorResponse('Reset token is invalid or expired', 400, {
                code: 'TOKEN_EXPIRED',
            }),
        );
    }

    const user = await User.first({ email });
    if (!user) {
        return withAuthCors(
            errorResponse('User not found', 404, {
                code: 'NOT_FOUND',
            }),
        );
    }

    const passwordHash = await hashPassword(password);
    user.set('passwordHash', passwordHash);
    await user.save();

    // Revoke every existing session after a password reset. This is the exact scenario
    // revocation exists for, so a KV failure must surface (fail loud) rather than return
    // success while the attacker's stolen sessions stay valid.
    try {
        await revokeAllUserSessions(String(user.get('id')), env as any, getAuthOptions(env));
    } catch (error) {
        console.error('Failed to revoke sessions after password reset:', error);
        return withAuthCors(
            errorResponse('Password was reset but existing sessions could not be revoked. Please try again.', 500, {
                code: 'REVOCATION_FAILED',
            }),
        );
    }

    return withAuthCors(jsonResponse({ success: true }));
}

export async function handlePasswordChange(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:password-change:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    if (!env.OBCF_D1) {
        return withAuthCors(
            errorResponse('D1 database binding not configured', 500, {
                code: 'CONFIG_ERROR',
            }),
        );
    }

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    if (!userId) {
        return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{ currentPassword?: string; newPassword?: string }>(request);
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    const fieldErrors: Record<string, string[]> = {};

    if (!currentPassword) {
        fieldErrors.currentPassword = ['Current password is required'];
    }
    if (!newPassword) {
        fieldErrors.newPassword = ['New password is required'];
    } else if (!isStrongPassword(newPassword)) {
        fieldErrors.newPassword = [
            'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol',
        ];
    }

    if (Object.keys(fieldErrors).length > 0) {
        return withAuthCors(
            errorResponse('Validation failed', 400, {
                code: 'VALIDATION_ERROR',
                fieldErrors,
            }),
        );
    }

    const user = await User.find(userId);
    if (!user) {
        return withAuthCors(errorResponse('User not found', 404, { code: 'NOT_FOUND' }));
    }

    const existingHash = user.get('passwordHash');
    if (!existingHash || typeof existingHash !== 'string') {
        return withAuthCors(
            errorResponse('Password change is not available for this account', 400, {
                code: 'PASSWORD_CHANGE_UNAVAILABLE',
            }),
        );
    }

    const isCurrentValid = await verifyPassword(currentPassword, existingHash);
    if (!isCurrentValid) {
        return withAuthCors(
            errorResponse('Current password is incorrect', 400, {
                code: 'INVALID_CURRENT_PASSWORD',
                fieldErrors: {
                    currentPassword: ['Current password is incorrect'],
                },
            }),
        );
    }

    const isSamePassword = await verifyPassword(newPassword, existingHash);
    if (isSamePassword) {
        return withAuthCors(
            errorResponse('New password must be different from current password', 400, {
                code: 'PASSWORD_UNCHANGED',
                fieldErrors: {
                    newPassword: ['New password must be different from current password'],
                },
            }),
        );
    }

    const passwordHash = await hashPassword(newPassword);
    user.set('passwordHash', passwordHash);
    await user.save();

    // Revoke every existing session (including any stolen ones). This is security-critical,
    // so a KV failure must surface rather than silently leave old sessions valid.
    try {
        await revokeAllUserSessions(userId, env as any, getAuthOptions(env));
    } catch (error) {
        console.error('Failed to revoke sessions after password change:', error);
        return withAuthCors(
            errorResponse(
                'Password was changed but existing sessions could not be revoked. Please sign in again.',
                500,
                {
                    code: 'REVOCATION_FAILED',
                },
            ),
        );
    }

    // Re-issue a session for THIS device so the user stays signed in. The reissued session
    // is created after the revocation marker, so it survives while all prior sessions die.
    const emailVerifiedRaw = user.get('emailVerified');
    const { cookie } = await createSessionCookieForUser(
        {
            id: userId,
            email: String(user.get('email')),
            name: (user.get('name') as string | null) ?? null,
            image: (user.get('image') as string | null) ?? null,
            emailVerified: emailVerifiedRaw ? new Date(emailVerifiedRaw as any).getTime() : null,
        },
        env as any,
        request,
        getAuthOptions(env),
    );

    return withAuthCors(jsonResponse({ success: true }, 200, { headers: { 'Set-Cookie': cookie } }));
}

export async function handleUserProfile(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;

    if (!userId) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    if (request.method === 'GET') {
        const user = await User.find(userId);
        if (!user) {
            return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
        }
        const userJson = user.toJson();
        const linkedAccounts = await getUserLinkedAccounts(userId);
        return jsonResponse({ ...userJson, linkedAccounts }, 200);
    }

    if (request.method === 'PATCH') {
        const body = await readJson<{
            name?: string;
            image?: string | null;
            timezone?: string | null;
            activeOrganizationId?: string | null;
        }>(request);

        const updates: Record<string, any> = {};
        const fieldErrors: Record<string, string[]> = {};

        if (body.name !== undefined) {
            const name = typeof body.name === 'string' ? body.name.trim() : '';
            if (!name) {
                fieldErrors.name = ['Name is required'];
            } else if (name.length < 2) {
                fieldErrors.name = ['Name must be at least 2 characters'];
            } else {
                updates.name = name;
            }
        }

        if (body.image !== undefined) {
            const image = typeof body.image === 'string' ? body.image.trim() : '';
            if (!image) {
                updates.image = null;
            } else if (!isValidUrl(image)) {
                fieldErrors.image = ['Image must be a valid URL'];
            } else {
                updates.image = image;
            }
        }

        if (body.timezone !== undefined) {
            const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : null;
            updates.timezone = timezone || null;
        }

        // Persist the user's active organization (cross-device). Membership is validated
        // server-side so a client can only point at an org it actually belongs to.
        if (body.activeOrganizationId !== undefined) {
            const requested = body.activeOrganizationId;
            if (requested === null || requested === '') {
                updates.activeOrganizationId = null;
            } else if (typeof requested === 'string') {
                const accessible = await OrganizationMember.organizationIdsForUser(userId);
                if (!accessible.includes(requested)) {
                    fieldErrors.activeOrganizationId = ['You are not a member of that organization'];
                } else {
                    updates.activeOrganizationId = requested;
                }
            } else {
                fieldErrors.activeOrganizationId = ['Invalid organization id'];
            }
        }

        if (Object.keys(fieldErrors).length > 0) {
            return errorResponse('Validation failed', 400, {
                code: 'VALIDATION_ERROR',
                fieldErrors,
            });
        }

        if (Object.keys(updates).length === 0) {
            return errorResponse('No changes provided', 400, {
                code: 'NO_CHANGES',
            });
        }

        const updated = await User.update(userId, updates);

        // Refresh live sessions so the edit is reflected immediately (see bumpProfileVersion).
        await bumpProfileVersion(env, userId);

        const userJson = updated.toJson();
        const linkedAccounts = await getUserLinkedAccounts(userId);
        return jsonResponse({ ...userJson, linkedAccounts }, 200);
    }

    return errorResponse('Method not allowed', 405);
}

export async function handleAuthRegister(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;

    if (!env.OBCF_D1) {
        return withAuthCors(
            errorResponse('D1 database binding not configured', 500, {
                code: 'CONFIG_ERROR',
            }),
        );
    }

    if (env.AUTH_DISABLE_CREDENTIALS === 'true' || env.AUTH_DISABLE_CREDENTIALS === '1') {
        return withAuthCors(
            errorResponse('Credentials registration is disabled', 403, {
                code: 'CREDENTIALS_DISABLED',
            }),
        );
    }

    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:register:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{
        email?: string;
        password?: string;
        name?: string;
        referralCode?: string;
        utm_source?: string;
        utm_medium?: string;
        utm_campaign?: string;
        utm_term?: string;
        utm_content?: string;
    }>(request);

    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    const fieldErrors: Record<string, string[]> = {};

    if (!email) {
        fieldErrors.email = ['Email is required'];
    } else if (!isEmail(email)) {
        fieldErrors.email = ['Invalid email address'];
    }

    if (!password) {
        fieldErrors.password = ['Password is required'];
    } else if (!isStrongPassword(password)) {
        fieldErrors.password = [
            'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol',
        ];
    }

    if (name && name.length < 2) {
        fieldErrors.name = ['Name must be at least 2 characters'];
    }

    if (Object.keys(fieldErrors).length > 0) {
        return withAuthCors(
            errorResponse('Validation failed', 400, {
                code: 'VALIDATION_ERROR',
                fieldErrors,
            }),
        );
    }

    try {
        const existing = await User.first({ email });
        if (existing) {
            return withAuthCors(
                errorResponse('Email already in use', 409, {
                    code: 'EMAIL_EXISTS',
                }),
            );
        }

        const passwordHash = await hashPassword(password);

        const newUser = await User.create({
            email,
            name: name || null,
            emailVerified: null,
            passwordHash,
        });

        const newUserId = newUser.get('id') as string;

        let organizationId: string | null = null;
        let organizationRole: string | null = null;
        let assignedRole: string | null = null;

        try {
            const provisioned = await provisionDefaultOrganizationForUser({
                user: newUser,
                email,
                name,
                organizationRole: 'owner',
                roleFallbacks: ['member', 'viewer'],
                appId: env.APP_ID ?? 'otta-web',
            });

            organizationId = provisioned.organizationId;
            organizationRole = provisioned.organizationRole;
            assignedRole = provisioned.assignedRole;
        } catch (error) {
            console.warn('Failed to initialize organization or roles:', error);
        }

        let attributionResult;
        if (body.referralCode && getOttabaseConfig(env).packages.referrals) {
            const safeHeaders: Record<string, string> = {};
            for (const h of ['accept', 'accept-language', 'cf-connecting-country']) {
                const v = request.headers.get(h);
                if (v) safeHeaders[h] = v;
            }
            const hasUtm = body.utm_source || body.utm_medium || body.utm_campaign || body.utm_term || body.utm_content;
            const meta =
                hasUtm || Object.keys(safeHeaders).length > 0
                    ? {
                          utm: hasUtm
                              ? {
                                    source: body.utm_source,
                                    medium: body.utm_medium,
                                    campaign: body.utm_campaign,
                                    term: body.utm_term,
                                    content: body.utm_content,
                                }
                              : undefined,
                          headers: Object.keys(safeHeaders).length > 0 ? safeHeaders : undefined,
                      }
                    : undefined;
            attributionResult = await processReferralAttribution({
                newUserId,
                referralCode: body.referralCode,
                ipAddress: getClientIpAddress(request),
                userAgent: request.headers.get('user-agent') ?? null,
                referer: request.headers.get('referer') ?? null,
                meta: meta ?? null,
            });
        }

        const requireVerified = env.AUTH_REQUIRE_EMAIL_VERIFIED === 'true' || env.AUTH_REQUIRE_EMAIL_VERIFIED === '1';
        let verificationSent = false;

        if (requireVerified) {
            const { mailer, from } = await resolveMailer(env);
            if (!mailer) {
                return withAuthCors(
                    errorResponse('Email verification requires a configured email provider', 500, {
                        code: 'CONFIG_ERROR',
                    }),
                );
            }

            registerAppEmailTemplates();
            const identifier = `verify:${email}`;
            const { token } = await createVerificationToken(env, identifier, 24 * 60 * 60);

            const verifyUrl = new URL(env.AUTH_URL || request.url);
            verifyUrl.pathname = '/api/auth/verify-email';
            verifyUrl.searchParams.set('token', token);
            verifyUrl.searchParams.set('email', email);

            await sendTemplatedEmail(mailer, {
                from,
                to: email,
                template: 'minimalist',
                subject: 'Verify your email',
                variables: {
                    subject: 'Verify your email',
                    header: 'Verify your email',
                    body: `<p>Thanks for signing up! Please verify your email to activate your account.</p>
<p><a href="${verifyUrl.toString()}">Verify email</a></p>
<p>If you did not create this account, you can ignore this email.</p>`,
                    footer: `<p>This link expires in 24 hours.</p>`,
                },
            });
            verificationSent = true;
        }

        const userJson = newUser.toJson();
        delete (userJson as any).passwordHash;
        if (organizationId) {
            (userJson as any).organizationId = organizationId;
            (userJson as any).organizationRole = organizationRole;
            (userJson as any).role = assignedRole;
        }

        const response = jsonResponse({
            success: true,
            user: userJson,
            organizationId,
            organizationRole,
            assignedRole,
            requiresEmailVerification: requireVerified,
            verificationSent,
            referralAttribution: attributionResult || null,
        });
        return withAuthCors(response);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Registration failed';
        if (typeof message === 'string' && message.toLowerCase().includes('unique')) {
            return withAuthCors(errorResponse('Email already in use', 409, { code: 'EMAIL_EXISTS' }));
        }
        console.error('Registration error:', error);
        return withAuthCors(errorResponse('Registration failed', 500, { code: 'REGISTRATION_FAILED' }));
    }
}

export async function handleAuthApiRequest(context: AuthRouteContext): Promise<Response> {
    const { request, env, url, withAuthCors } = context;

    if (request.method === 'POST') {
        const ip = getClientIpAddress(request);
        let bucket: string | null = null;

        if (url.pathname.includes('/callback/credentials')) {
            bucket = 'signin';
        } else if (url.pathname.includes('/signin/email')) {
            bucket = 'magiclink';
        } else if (url.pathname.includes('/signout')) {
            bucket = 'signout';
        }

        if (bucket) {
            const rateLimit = await enforceRateLimit(request, env, `auth:${bucket}:${ip}`);
            if (rateLimit) return withAuthCors(rateLimit);
        }
    }

    const response = await handleAuthRequest(request, env as any, getAuthOptions(env));
    return withAuthCors(response);
}
