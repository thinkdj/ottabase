import { getSession, handleAuthRequest, hashPassword } from '@ottabase/auth/backend';
import { getLoginConfig } from '@ottabase/auth/components';
import { userKey } from '@ottabase/cf/cache-keys';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { sendTemplatedEmail } from '@ottabase/email';
import { registerConnection } from '@ottabase/ottaorm';
import { User, VerificationToken } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { isEmail } from '@ottabase/utils/string';
import { isValidUrl } from '@ottabase/utils/url';
import type { CloudflareEnv } from '../../cloudflare-env';
import { processReferralAttribution } from '../../ottabase/helpers/referral-attribution';
import { registerAppEmailTemplates } from '../../src/email/templates';
import { createVerificationToken, getAuthOptions, getUserLinkedAccounts, resolveMailer } from '../lib/auth-utils';
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

    const verifyUrl = new URL(request.url);
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
    const verification = await VerificationToken.findByIdentifierAndToken(identifier, token);
    if (!verification) {
        return withAuthCors(
            errorResponse('Verification token is invalid or expired', 400, {
                code: 'INVALID_TOKEN',
            }),
        );
    }

    const expiresAt = Number(verification.get('expires'));
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        await VerificationToken.deleteByIdentifierAndToken(identifier, token);
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
    }

    await VerificationToken.deleteByIdentifierAndToken(identifier, token);

    const accept = request.headers.get('Accept') || '';
    if (accept.includes('text/html')) {
        const redirectUrl = env.AUTH_URL || env.NEXTAUTH_URL || new URL(request.url).origin;
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

    const resetUrl = new URL(env.AUTH_URL || env.NEXTAUTH_URL || request.url);
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
    const verification = await VerificationToken.findByIdentifierAndToken(identifier, token);
    if (!verification) {
        return withAuthCors(
            errorResponse('Reset token is invalid or expired', 400, {
                code: 'INVALID_TOKEN',
            }),
        );
    }

    const expiresAt = Number(verification.get('expires'));
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        await VerificationToken.deleteByIdentifierAndToken(identifier, token);
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

    await VerificationToken.deleteByIdentifierAndToken(identifier, token);

    if (env.OBCF_KV) {
        try {
            const revokedAt = Math.floor(Date.now() / 1000);
            await env.OBCF_KV.put(userKey('auth', String(user.get('id')), 'revoked'), String(revokedAt), {
                expirationTtl: Number(env.AUTH_SESSION_MAX_AGE) || 30 * 24 * 60 * 60,
            });
        } catch {
            // ignore revocation errors
        }
    }

    return withAuthCors(jsonResponse({ success: true }));
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
        const body = await readJson<{ name?: string; image?: string | null }>(request);

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

        if (env.OBCF_KV) {
            try {
                const version = Date.now();
                await env.OBCF_KV.put(userKey('auth', userId, 'profile', 'version'), String(version), {
                    expirationTtl: Number(env.AUTH_SESSION_MAX_AGE) || 30 * 24 * 60 * 60,
                });
            } catch (error) {
                console.warn('Failed to bump profile version in KV:', error);
            }
        }

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
            });

            organizationId = provisioned.organizationId;
            organizationRole = provisioned.organizationRole;
            assignedRole = provisioned.assignedRole;
        } catch (error) {
            console.warn('Failed to initialize organization or roles:', error);
        }

        let attributionResult;
        if (body.referralCode) {
            attributionResult = await processReferralAttribution({
                newUserId,
                referralCode: body.referralCode,
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

            const verifyUrl = new URL(request.url);
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
        return withAuthCors(errorResponse(message, 500));
    }
}

export async function handleAuthJsRequest(context: AuthRouteContext): Promise<Response> {
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
