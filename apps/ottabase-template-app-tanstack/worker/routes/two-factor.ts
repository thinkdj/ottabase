import {
    buildOtpauthUrl,
    decryptTotpSecret,
    encryptTotpSecret,
    generateBackupCodeHashes,
    generateTotpSecret,
    getWebAuthnRpId,
    getWebAuthnRpName,
    signPreAuthToken,
    userRequiresTwoFactor,
    verifyAndConsumeBackupCode,
    verifyTotpToken,
} from '@ottabase/auth/two-factor';
import { getSession, verifyPassword } from '@ottabase/auth/backend';
import { globalKey } from '@ottabase/cf/cache-keys';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { Authenticator, User } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { getAuthOptions } from '../lib/auth-utils';
import { enforceRateLimit } from '../lib/rate-limiting';
import { getClientIpAddress, readJson } from '../lib/utils';
import type { AuthRouteContext } from './auth';

const LOGIN_CHALLENGE_TTL_SEC = 300;
const TOTP_SETUP_TTL_SEC = 900;

interface LoginChallengePayload {
    userId: string;
    email: string;
    webAuthnChallenge?: string;
}

function loginChallengeKey(id: string): string {
    return globalKey('auth', '2fa', 'login', id);
}

function totpSetupKey(userId: string): string {
    return globalKey('auth', '2fa', 'totp-setup', userId);
}

/** Decode base64url (WebAuthn credential id) to Uint8Array */
function isoBase64URLToBuffer(s: string): Uint8Array {
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
}

function parseTransports(raw: string | null | undefined): string[] | undefined {
    if (!raw) return undefined;
    const parts = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (!parts.length) return undefined;
    return parts;
}

export async function handleTwoFactorPassword(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    if (!env.OBCF_D1 || !env.OBCF_KV) {
        return withAuthCors(
            errorResponse('Two-factor login requires D1 and KV bindings', 500, { code: 'CONFIG_ERROR' }),
        );
    }
    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:2fa-password:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{ email?: string; password?: string }>(request);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
        return withAuthCors(errorResponse('Email and password are required', 400, { code: 'VALIDATION_ERROR' }));
    }

    const user = await User.first({ email });
    if (!user) {
        return withAuthCors(errorResponse('Invalid credentials', 401, { code: 'INVALID_CREDENTIALS' }));
    }

    const hash = user.get('passwordHash');
    if (!hash || !(await verifyPassword(password, String(hash)))) {
        return withAuthCors(errorResponse('Invalid credentials', 401, { code: 'INVALID_CREDENTIALS' }));
    }

    const userId = String(user.get('id'));
    const needs2fa = await userRequiresTwoFactor(env.OBCF_D1, userId);
    if (!needs2fa) {
        return withAuthCors(jsonResponse({ ok: true, requiresTwoFactor: false }));
    }

    const challengeId = crypto.randomUUID();
    const payload: LoginChallengePayload = { userId, email };

    const passkeys = await Authenticator.where({ userId });
    let webauthnOptions: Awaited<ReturnType<typeof generateAuthenticationOptions>> | null = null;

    if (passkeys.length > 0) {
        const rpId = getWebAuthnRpId(env);
        webauthnOptions = await generateAuthenticationOptions({
            rpID: rpId,
            allowCredentials: passkeys.map((a) => ({
                id: isoBase64URLToBuffer(String(a.get('credentialId'))),
                transports: parseTransports(a.get('transports') as string | undefined),
            })),
            userVerification: 'preferred',
            timeout: 60000,
        });
        payload.webAuthnChallenge = webauthnOptions.challenge as string;
    }

    await env.OBCF_KV.put(loginChallengeKey(challengeId), JSON.stringify(payload), {
        expirationTtl: LOGIN_CHALLENGE_TTL_SEC,
    });

    return withAuthCors(
        jsonResponse({
            ok: true,
            requiresTwoFactor: true,
            challengeId,
            webauthnOptions,
        }),
    );
}

export async function handleTwoFactorVerify(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    if (!env.OBCF_D1 || !env.OBCF_KV) {
        return withAuthCors(
            errorResponse('Two-factor login requires D1 and KV bindings', 500, { code: 'CONFIG_ERROR' }),
        );
    }
    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:2fa-verify:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{
        challengeId?: string;
        totpCode?: string;
        backupCode?: string;
        webauthn?: Record<string, unknown>;
    }>(request);

    const challengeId = typeof body.challengeId === 'string' ? body.challengeId : '';
    if (!challengeId) {
        return withAuthCors(errorResponse('challengeId is required', 400, { code: 'VALIDATION_ERROR' }));
    }

    const raw = await env.OBCF_KV.get(loginChallengeKey(challengeId));
    if (!raw) {
        return withAuthCors(errorResponse('Challenge expired or invalid', 401, { code: 'CHALLENGE_INVALID' }));
    }

    let challenge: LoginChallengePayload;
    try {
        challenge = JSON.parse(raw) as LoginChallengePayload;
    } catch {
        return withAuthCors(errorResponse('Challenge expired or invalid', 401, { code: 'CHALLENGE_INVALID' }));
    }

    const { userId, email } = challenge;
    const origin = request.headers.get('Origin') || new URL(request.url).origin;
    const rpId = getWebAuthnRpId(env);

    const row = await env.OBCF_D1.prepare(
        `SELECT totp_secret_enc as totpSecretEnc, totp_enabled_at as totpEnabledAt, backup_codes_json as backupCodesJson FROM users WHERE id = ?`,
    )
        .bind(userId)
        .first<{ totpSecretEnc: string | null; totpEnabledAt: number | null; backupCodesJson: string | null }>();

    if (!row) {
        return withAuthCors(errorResponse('User not found', 404, { code: 'NOT_FOUND' }));
    }

    let verified = false;

    const totpCode = typeof body.totpCode === 'string' ? body.totpCode.trim() : '';
    const backupCode = typeof body.backupCode === 'string' ? body.backupCode.trim() : '';
    const webPayload = body.webauthn;

    if (webPayload && typeof webPayload === 'object') {
        if (!challenge.webAuthnChallenge) {
            return withAuthCors(
                errorResponse('WebAuthn is not available for this challenge', 400, { code: 'WEBAUTHN_NA' }),
            );
        }
        const credentialIdStr = String((webPayload as { id?: string }).id || '');
        const stored = await Authenticator.findByCredentialId(credentialIdStr);
        if (!stored || String(stored.get('userId')) !== userId) {
            return withAuthCors(errorResponse('Unknown security key', 401, { code: 'WEBAUTHN_FAILED' }));
        }
        const pubKeyB64 = String(stored.get('credentialPublicKey'));
        const verification = await verifyAuthenticationResponse({
            response: webPayload as any,
            expectedChallenge: challenge.webAuthnChallenge,
            expectedOrigin: origin,
            expectedRPID: rpId,
            requireUserVerification: false,
            credential: {
                id: isoBase64URLToBuffer(credentialIdStr),
                publicKey: base64ToUint8Array(pubKeyB64),
                counter: Number(stored.get('counter')) || 0,
            },
        });
        if (!verification.verified) {
            return withAuthCors(errorResponse('Security key verification failed', 401, { code: 'WEBAUTHN_FAILED' }));
        }
        const newCounter = verification.authenticationInfo?.newCounter;
        if (typeof newCounter === 'number') {
            await stored.updateCounter(newCounter);
        }
        verified = true;
    } else if (totpCode && row.totpSecretEnc && row.totpEnabledAt) {
        const secret = await decryptTotpSecret(env, row.totpSecretEnc);
        if (secret && verifyTotpToken(secret, totpCode)) {
            verified = true;
        }
    } else if (backupCode && row.backupCodesJson) {
        let hashes: string[];
        try {
            hashes = JSON.parse(row.backupCodesJson) as string[];
        } catch {
            hashes = [];
        }
        if (Array.isArray(hashes) && hashes.length) {
            const next = await verifyAndConsumeBackupCode(backupCode, hashes);
            if (next) {
                await env.OBCF_D1.prepare(`UPDATE users SET backup_codes_json = ? WHERE id = ?`)
                    .bind(JSON.stringify(next), userId)
                    .run();
                verified = true;
            }
        }
    }

    if (!verified) {
        return withAuthCors(errorResponse('Invalid second factor', 401, { code: 'SECOND_FACTOR_INVALID' }));
    }

    await env.OBCF_KV.delete(loginChallengeKey(challengeId));

    const preAuthToken = await signPreAuthToken(env, { sub: userId, email });
    return withAuthCors(jsonResponse({ ok: true, email, preAuthToken }));
}

export async function handleTwoFactorStatus(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    if (!env.OBCF_D1) {
        return withAuthCors(errorResponse('D1 not configured', 500, { code: 'CONFIG_ERROR' }));
    }
    registerConnection('default', createD1Driver(env.OBCF_D1));
    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    if (!userId) {
        return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));
    }

    const row = await env.OBCF_D1.prepare(
        `SELECT totp_enabled_at as totpEnabledAt,
            (SELECT COUNT(*) FROM authenticators WHERE user_id = ?) as passkeyCount
     FROM users WHERE id = ?`,
    )
        .bind(userId, userId)
        .first<{ totpEnabledAt: number | null; passkeyCount: number }>();

    const passkeys = await Authenticator.where({ userId: String(userId) });

    return withAuthCors(
        jsonResponse({
            totpEnabled: !!(row?.totpEnabledAt && Number(row.totpEnabledAt) > 0),
            passkeyCount: Number(row?.passkeyCount) || 0,
            passkeys: passkeys.map((a) => ({
                id: a.get('id'),
                credentialId: a.get('credentialId'),
                createdAt: a.get('createdAt'),
                deviceType: a.get('credentialDeviceType'),
            })),
        }),
    );
}

export async function handleTotpSetupStart(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    if (!env.OBCF_D1 || !env.OBCF_KV) {
        return withAuthCors(errorResponse('TOTP setup requires D1 and KV', 500, { code: 'CONFIG_ERROR' }));
    }
    registerConnection('default', createD1Driver(env.OBCF_D1));
    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    const email = session?.user?.email;
    if (!userId || !email) {
        return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));
    }

    const secret = generateTotpSecret();
    await env.OBCF_KV.put(
        totpSetupKey(String(userId)),
        JSON.stringify({ secret, exp: Date.now() + TOTP_SETUP_TTL_SEC * 1000 }),
        { expirationTtl: TOTP_SETUP_TTL_SEC },
    );

    const cfg = getOttabaseConfig(env);
    const issuer = cfg.appName || 'App';
    const otpauthUrl = buildOtpauthUrl({ issuer, accountName: email, secret });

    return withAuthCors(jsonResponse({ otpauthUrl, secret }));
}

export async function handleTotpEnable(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    if (!env.OBCF_D1 || !env.OBCF_KV) {
        return withAuthCors(errorResponse('TOTP setup requires D1 and KV', 500, { code: 'CONFIG_ERROR' }));
    }
    registerConnection('default', createD1Driver(env.OBCF_D1));
    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    if (!userId) {
        return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));
    }

    const body = await readJson<{ code?: string }>(request);
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(code)) {
        return withAuthCors(
            errorResponse('Enter the 6-digit code from your authenticator', 400, { code: 'VALIDATION_ERROR' }),
        );
    }

    const raw = await env.OBCF_KV.get(totpSetupKey(String(userId)));
    if (!raw) {
        return withAuthCors(errorResponse('Setup expired — start again', 400, { code: 'SETUP_EXPIRED' }));
    }
    let pending: { secret: string; exp: number };
    try {
        pending = JSON.parse(raw) as { secret: string; exp: number };
    } catch {
        return withAuthCors(errorResponse('Setup expired — start again', 400, { code: 'SETUP_EXPIRED' }));
    }
    if (pending.exp < Date.now()) {
        return withAuthCors(errorResponse('Setup expired — start again', 400, { code: 'SETUP_EXPIRED' }));
    }

    if (!verifyTotpToken(pending.secret, code)) {
        return withAuthCors(errorResponse('Invalid authenticator code', 400, { code: 'INVALID_CODE' }));
    }

    const enc = await encryptTotpSecret(env, pending.secret);
    const { codes, hashes } = await generateBackupCodeHashes(10);

    await env.OBCF_D1.prepare(
        `UPDATE users SET totp_secret_enc = ?, totp_enabled_at = ?, backup_codes_json = ?, updated_at = ? WHERE id = ?`,
    )
        .bind(enc, Date.now(), JSON.stringify(hashes), Date.now(), userId)
        .run();

    await env.OBCF_KV.delete(totpSetupKey(String(userId)));

    return withAuthCors(jsonResponse({ ok: true, backupCodes: codes }));
}

export async function handleTotpDisable(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    if (!env.OBCF_D1) {
        return withAuthCors(errorResponse('D1 not configured', 500, { code: 'CONFIG_ERROR' }));
    }
    registerConnection('default', createD1Driver(env.OBCF_D1));
    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    if (!userId) {
        return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));
    }

    const body = await readJson<{ password?: string; totpCode?: string }>(request);
    const password = typeof body.password === 'string' ? body.password : '';
    const totpCode = typeof body.totpCode === 'string' ? body.totpCode.trim() : '';

    if (!password || !totpCode) {
        return withAuthCors(
            errorResponse('Password and authenticator code are required', 400, { code: 'VALIDATION_ERROR' }),
        );
    }

    const user = await User.find(String(userId));
    if (!user) {
        return withAuthCors(errorResponse('Not found', 404, { code: 'NOT_FOUND' }));
    }

    const ph = user.get('passwordHash');
    if (!ph || !(await verifyPassword(password, String(ph)))) {
        return withAuthCors(errorResponse('Invalid password', 401, { code: 'INVALID_PASSWORD' }));
    }

    const enc = user.get('totpSecretEnc') as string | null | undefined;
    if (!enc) {
        return withAuthCors(errorResponse('TOTP is not enabled', 400, { code: 'TOTP_OFF' }));
    }
    const secret = await decryptTotpSecret(env, enc);
    if (!secret || !verifyTotpToken(secret, totpCode)) {
        return withAuthCors(errorResponse('Invalid authenticator code', 401, { code: 'INVALID_CODE' }));
    }

    await env.OBCF_D1.prepare(
        `UPDATE users SET totp_secret_enc = NULL, totp_enabled_at = NULL, backup_codes_json = NULL, updated_at = ? WHERE id = ?`,
    )
        .bind(Date.now(), userId)
        .run();

    return withAuthCors(jsonResponse({ ok: true }));
}

export async function handleWebAuthnRegisterOptions(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    if (!env.OBCF_D1 || !env.OBCF_KV) {
        return withAuthCors(errorResponse('WebAuthn requires D1 and KV', 500, { code: 'CONFIG_ERROR' }));
    }
    registerConnection('default', createD1Driver(env.OBCF_D1));
    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    const email = session?.user?.email;
    const name = session?.user?.name;
    if (!userId || !email) {
        return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));
    }

    const existing = await Authenticator.where({ userId: String(userId) });
    const rpId = getWebAuthnRpId(env);
    const rpName = getOttabaseConfig(env).appName || getWebAuthnRpName(env);

    const options = await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userID: new TextEncoder().encode(String(userId)),
        userName: email,
        userDisplayName: typeof name === 'string' && name ? name : email,
        attestationType: 'none',
        authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
        },
        excludeCredentials: existing.map((a) => ({
            id: isoBase64URLToBuffer(String(a.get('credentialId'))),
            transports: parseTransports(a.get('transports') as string | undefined),
        })),
        timeout: 60000,
    });

    await env.OBCF_KV.put(
        globalKey('auth', '2fa', 'webauthn-reg', String(userId)),
        JSON.stringify({ challenge: options.challenge, exp: Date.now() + 300000 }),
        { expirationTtl: 300 },
    );

    return withAuthCors(jsonResponse(options));
}

export async function handleWebAuthnRegisterVerify(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    if (!env.OBCF_D1 || !env.OBCF_KV) {
        return withAuthCors(errorResponse('WebAuthn requires D1 and KV', 500, { code: 'CONFIG_ERROR' }));
    }
    registerConnection('default', createD1Driver(env.OBCF_D1));
    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    if (!userId) {
        return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));
    }

    const body = await readJson<{ credential?: Record<string, unknown> }>(request);
    const credential = body.credential;
    if (!credential || typeof credential !== 'object') {
        return withAuthCors(errorResponse('credential is required', 400, { code: 'VALIDATION_ERROR' }));
    }

    const raw = await env.OBCF_KV.get(globalKey('auth', '2fa', 'webauthn-reg', String(userId)));
    if (!raw) {
        return withAuthCors(errorResponse('Registration session expired', 400, { code: 'CHALLENGE_INVALID' }));
    }
    let reg: { challenge: string; exp: number };
    try {
        reg = JSON.parse(raw) as { challenge: string; exp: number };
    } catch {
        return withAuthCors(errorResponse('Registration session expired', 400, { code: 'CHALLENGE_INVALID' }));
    }
    if (reg.exp < Date.now()) {
        return withAuthCors(errorResponse('Registration session expired', 400, { code: 'CHALLENGE_INVALID' }));
    }

    const origin = request.headers.get('Origin') || new URL(request.url).origin;
    const rpId = getWebAuthnRpId(env);

    const verification = await verifyRegistrationResponse({
        response: credential as any,
        expectedChallenge: reg.challenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
        return withAuthCors(errorResponse('Could not verify security key', 400, { code: 'WEBAUTHN_FAILED' }));
    }

    const info = verification.registrationInfo;
    const cred = info.credential;
    const credentialId = cred.id;
    const resp = (credential as { response?: { transports?: string[] } }).response;
    const transports = resp?.transports;

    const pubB64 = bufferToBase64(cred.publicKey);

    await Authenticator.create({
        credentialId,
        userId: String(userId),
        providerAccountId: credentialId,
        credentialPublicKey: pubB64,
        counter: cred.counter,
        credentialDeviceType: info.credentialDeviceType,
        credentialBackedUp: info.credentialBackedUp,
        transports: Array.isArray(transports) ? transports.join(',') : undefined,
    });

    await env.OBCF_KV.delete(globalKey('auth', '2fa', 'webauthn-reg', String(userId)));

    return withAuthCors(jsonResponse({ ok: true }));
}

export async function handleWebAuthnCredentialDelete(context: AuthRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;
    if (!env.OBCF_D1) {
        return withAuthCors(errorResponse('D1 not configured', 500, { code: 'CONFIG_ERROR' }));
    }
    registerConnection('default', createD1Driver(env.OBCF_D1));
    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    if (!userId) {
        return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));
    }

    const body = await readJson<{ credentialId?: string; password?: string }>(request);
    const credentialId = typeof body.credentialId === 'string' ? body.credentialId : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!credentialId || !password) {
        return withAuthCors(errorResponse('credentialId and password are required', 400, { code: 'VALIDATION_ERROR' }));
    }

    const user = await User.find(String(userId));
    if (!user) {
        return withAuthCors(errorResponse('Not found', 404, { code: 'NOT_FOUND' }));
    }
    const ph = user.get('passwordHash');
    if (!ph || !(await verifyPassword(password, String(ph)))) {
        return withAuthCors(errorResponse('Invalid password', 401, { code: 'INVALID_PASSWORD' }));
    }

    const auth = await Authenticator.findByCredentialId(credentialId);
    if (!auth || String(auth.get('userId')) !== String(userId)) {
        return withAuthCors(errorResponse('Credential not found', 404, { code: 'NOT_FOUND' }));
    }

    await auth.destroy();
    return withAuthCors(jsonResponse({ ok: true }));
}

function bufferToBase64(buf: Uint8Array): string {
    let s = '';
    for (const b of buf) {
        s += String.fromCharCode(b);
    }
    return btoa(s);
}

function base64ToUint8Array(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
}
