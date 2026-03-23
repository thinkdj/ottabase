// ============================================================
// Account Security Routes
// ============================================================
//
// Endpoints for password change, TOTP 2FA, and passkey management.
//
// ============================================================

import { getSession, hashPassword, verifyPassword } from '@ottabase/auth/backend';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { Authenticator, User } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAuthOptions } from '../lib/auth-utils';
import { enforceRateLimit } from '../lib/rate-limiting';
import { getClientIpAddress, isStrongPassword, readJson } from '../lib/utils';
import { generateTotpSecret, generateTotpUri, verifyTotp } from '../lib/totp';

interface SecurityRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
    withAuthCors: (response: Response) => Response;
}

// ── Helpers ───────────────────────────────────────────────────

async function requireSession(request: Request, env: CloudflareEnv) {
    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    if (!userId) return null;
    return { userId, session };
}

function requireD1(env: CloudflareEnv) {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }
    registerConnection('default', createD1Driver(env.OBCF_D1));
    return null;
}

// ── Password Change ──────────────────────────────────────────

export async function handlePasswordChange(ctx: SecurityRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:password-change:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    const d1Error = requireD1(env);
    if (d1Error) return withAuthCors(d1Error);

    const auth = await requireSession(request, env);
    if (!auth) return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));

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
        return withAuthCors(errorResponse('Validation failed', 400, { code: 'VALIDATION_ERROR', fieldErrors }));
    }

    // Load user with password hash (hidden field, use raw query)
    const row = await env
        .OBCF_D1!.prepare(`SELECT password_hash FROM users WHERE id = ? LIMIT 1`)
        .bind(auth.userId)
        .first<{ password_hash: string | null }>();

    if (!row?.password_hash) {
        return withAuthCors(
            errorResponse('No password set for this account. Use OAuth or magic link to sign in.', 400, {
                code: 'NO_PASSWORD',
            }),
        );
    }

    const valid = await verifyPassword(currentPassword, row.password_hash);
    if (!valid) {
        return withAuthCors(errorResponse('Current password is incorrect', 400, { code: 'INVALID_PASSWORD' }));
    }

    const newHash = await hashPassword(newPassword);
    const user = await User.find(auth.userId);
    if (!user) {
        return withAuthCors(errorResponse('User not found', 404, { code: 'NOT_FOUND' }));
    }

    user.set('passwordHash', newHash);
    await user.save();

    return withAuthCors(jsonResponse({ success: true }));
}

// ── TOTP Setup ───────────────────────────────────────────────

export async function handleTotpSetup(ctx: SecurityRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const d1Error = requireD1(env);
    if (d1Error) return withAuthCors(d1Error);

    const auth = await requireSession(request, env);
    if (!auth) return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));

    const user = await User.find(auth.userId);
    if (!user) return withAuthCors(errorResponse('User not found', 404, { code: 'NOT_FOUND' }));

    if (user.get('totpEnabled')) {
        return withAuthCors(
            errorResponse('Two-factor authentication is already enabled', 400, { code: 'TOTP_ALREADY_ENABLED' }),
        );
    }

    const secret = generateTotpSecret();
    const email = user.get('email') as string;
    const issuer = 'Ottabase';
    const uri = generateTotpUri(secret, email, issuer);

    return withAuthCors(jsonResponse({ secret, uri }));
}

// ── TOTP Enable ──────────────────────────────────────────────

export async function handleTotpEnable(ctx: SecurityRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:totp-enable:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    const d1Error = requireD1(env);
    if (d1Error) return withAuthCors(d1Error);

    const auth = await requireSession(request, env);
    if (!auth) return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));

    const body = await readJson<{ secret?: string; code?: string }>(request);
    const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!secret || !code) {
        return withAuthCors(
            errorResponse('Secret and verification code are required', 400, { code: 'VALIDATION_ERROR' }),
        );
    }

    // Verify the code against the provided secret
    const valid = await verifyTotp(secret, code);
    if (!valid) {
        return withAuthCors(
            errorResponse('Invalid verification code. Please try again.', 400, { code: 'INVALID_TOTP' }),
        );
    }

    const user = await User.find(auth.userId);
    if (!user) return withAuthCors(errorResponse('User not found', 404, { code: 'NOT_FOUND' }));

    if (user.get('totpEnabled')) {
        return withAuthCors(
            errorResponse('Two-factor authentication is already enabled', 400, { code: 'TOTP_ALREADY_ENABLED' }),
        );
    }

    user.set('totpSecret', secret);
    user.set('totpEnabled', 1);
    await user.save();

    return withAuthCors(jsonResponse({ success: true }));
}

// ── TOTP Disable ─────────────────────────────────────────────

export async function handleTotpDisable(ctx: SecurityRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:totp-disable:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    const d1Error = requireD1(env);
    if (d1Error) return withAuthCors(d1Error);

    const auth = await requireSession(request, env);
    if (!auth) return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));

    const body = await readJson<{ code?: string }>(request);
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!code) {
        return withAuthCors(errorResponse('Verification code is required', 400, { code: 'VALIDATION_ERROR' }));
    }

    const user = await User.find(auth.userId);
    if (!user) return withAuthCors(errorResponse('User not found', 404, { code: 'NOT_FOUND' }));

    if (!user.get('totpEnabled')) {
        return withAuthCors(
            errorResponse('Two-factor authentication is not enabled', 400, { code: 'TOTP_NOT_ENABLED' }),
        );
    }

    // Verify the code against the stored secret (need raw query since totpSecret is hidden)
    const row = await env
        .OBCF_D1!.prepare(`SELECT totp_secret FROM users WHERE id = ? LIMIT 1`)
        .bind(auth.userId)
        .first<{ totp_secret: string | null }>();

    if (!row?.totp_secret) {
        return withAuthCors(errorResponse('TOTP secret not found', 500, { code: 'INTERNAL_ERROR' }));
    }

    const valid = await verifyTotp(row.totp_secret, code);
    if (!valid) {
        return withAuthCors(errorResponse('Invalid verification code', 400, { code: 'INVALID_TOTP' }));
    }

    user.set('totpSecret', null);
    user.set('totpEnabled', 0);
    await user.save();

    return withAuthCors(jsonResponse({ success: true }));
}

// ── Credentials Preflight (for TOTP-aware login) ─────────────

export async function handleCredentialsPreflight(ctx: SecurityRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:preflight:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    if (!env.OBCF_D1) {
        return withAuthCors(errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' }));
    }

    const body = await readJson<{ email?: string; password?: string }>(request);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
        return withAuthCors(jsonResponse({ valid: false }));
    }

    const result = await env.OBCF_D1.prepare(
        `SELECT id, password_hash, totp_enabled FROM users WHERE email = ? LIMIT 1`,
    )
        .bind(email)
        .first<{ id: string; password_hash: string | null; totp_enabled: number }>();

    if (!result?.password_hash) {
        return withAuthCors(jsonResponse({ valid: false }));
    }

    const valid = await verifyPassword(password, result.password_hash);
    if (!valid) {
        return withAuthCors(jsonResponse({ valid: false }));
    }

    return withAuthCors(jsonResponse({ valid: true, totpRequired: !!result.totp_enabled }));
}

// ── Passkeys: List ───────────────────────────────────────────

export async function handlePasskeysList(ctx: SecurityRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const d1Error = requireD1(env);
    if (d1Error) return withAuthCors(d1Error);

    const auth = await requireSession(request, env);
    if (!auth) return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));

    const authenticators = await Authenticator.findByUserId(auth.userId);
    const passkeys = authenticators.map((a) => ({
        id: a.get('id'),
        credentialId: a.get('credentialId'),
        credentialDeviceType: a.get('credentialDeviceType'),
        credentialBackedUp: a.get('credentialBackedUp'),
        transports: a.get('transports'),
        createdAt: a.get('createdAt'),
    }));

    return withAuthCors(jsonResponse({ passkeys }));
}

// ── Passkeys: Registration Options ──────────────────────────

export async function handlePasskeysRegisterOptions(ctx: SecurityRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const d1Error = requireD1(env);
    if (d1Error) return withAuthCors(d1Error);

    const auth = await requireSession(request, env);
    if (!auth) return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));

    const user = await User.find(auth.userId);
    if (!user) return withAuthCors(errorResponse('User not found', 404, { code: 'NOT_FOUND' }));

    const existingAuthenticators = await Authenticator.findByUserId(auth.userId);

    // Build WebAuthn registration options (SimpleWebAuthn-compatible format)
    const rpName = 'Ottabase';
    const rpID = new URL(request.url).hostname;
    const userEmail = user.get('email') as string;
    const userName = (user.get('name') as string) || userEmail;

    // Generate a random challenge
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeB64 = bufferToBase64Url(challenge);

    // Store challenge in KV for verification (expires in 5 minutes)
    if (env.OBCF_KV) {
        await env.OBCF_KV.put(`webauthn:challenge:${auth.userId}`, challengeB64, { expirationTtl: 300 });
    }

    const excludeCredentials = existingAuthenticators.map((a) => ({
        id: a.get('credentialId') as string,
        type: 'public-key' as const,
        transports: ((a.get('transports') as string) || '').split(',').filter(Boolean),
    }));

    const options = {
        challenge: challengeB64,
        rp: { name: rpName, id: rpID },
        user: {
            id: bufferToBase64Url(new TextEncoder().encode(auth.userId)),
            name: userEmail,
            displayName: userName,
        },
        pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
        ],
        timeout: 60000,
        attestation: 'none',
        excludeCredentials,
        authenticatorSelection: {
            // No authenticatorAttachment specified — allows both platform (Windows Hello,
            // Touch ID) and cross-platform (USB/NFC/BLE security keys)
            residentKey: 'preferred' as const,
            requireResidentKey: false,
            userVerification: 'preferred' as const,
        },
    };

    return withAuthCors(jsonResponse({ options }));
}

// ── Passkeys: Verify Registration ───────────────────────────

export async function handlePasskeysRegisterVerify(ctx: SecurityRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const d1Error = requireD1(env);
    if (d1Error) return withAuthCors(d1Error);

    const auth = await requireSession(request, env);
    if (!auth) return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));

    if (!env.OBCF_KV) {
        return withAuthCors(errorResponse('KV not configured', 500, { code: 'CONFIG_ERROR' }));
    }

    // Retrieve the expected challenge
    const expectedChallenge = await env.OBCF_KV.get(`webauthn:challenge:${auth.userId}`);
    if (!expectedChallenge) {
        return withAuthCors(errorResponse('Challenge expired or not found', 400, { code: 'CHALLENGE_EXPIRED' }));
    }

    // Clean up the challenge
    await env.OBCF_KV.delete(`webauthn:challenge:${auth.userId}`);

    const body = await readJson<{
        id: string;
        rawId: string;
        response: {
            clientDataJSON: string;
            attestationObject: string;
        };
        type: string;
        authenticatorAttachment?: string;
    }>(request);

    if (!body.id || !body.rawId || !body.response?.clientDataJSON || !body.response?.attestationObject) {
        return withAuthCors(errorResponse('Invalid registration response', 400, { code: 'VALIDATION_ERROR' }));
    }

    // Decode clientDataJSON to verify challenge and origin
    const clientDataRaw = base64UrlToBuffer(body.response.clientDataJSON);
    const clientData = JSON.parse(new TextDecoder().decode(clientDataRaw));

    if (clientData.type !== 'webauthn.create') {
        return withAuthCors(errorResponse('Invalid client data type', 400, { code: 'INVALID_CLIENT_DATA' }));
    }

    if (clientData.challenge !== expectedChallenge) {
        return withAuthCors(errorResponse('Challenge mismatch', 400, { code: 'CHALLENGE_MISMATCH' }));
    }

    const expectedOrigin = new URL(request.url).origin;
    // In dev, the frontend may be on a different port
    const validOrigins = [expectedOrigin];
    const authUrl = (env as any).AUTH_URL || (env as any).NEXTAUTH_URL;
    if (authUrl) validOrigins.push(new URL(authUrl).origin);
    // Also allow the frontend origin (port 3003 in dev)
    const reqOrigin = new URL(request.url);
    if (reqOrigin.port === '3004') {
        validOrigins.push(reqOrigin.origin.replace(':3004', ':3003'));
    }

    if (!validOrigins.includes(clientData.origin)) {
        return withAuthCors(errorResponse('Origin mismatch', 400, { code: 'ORIGIN_MISMATCH' }));
    }

    // Parse attestation object to extract credential public key
    // For "none" attestation, we trust the credential directly
    const attestationBuffer = base64UrlToBuffer(body.response.attestationObject);
    const attestation = decodeCborSimple(attestationBuffer);

    if (!attestation || !attestation.authData) {
        return withAuthCors(errorResponse('Invalid attestation', 400, { code: 'INVALID_ATTESTATION' }));
    }

    // Parse authenticator data
    const authData = new Uint8Array(attestation.authData);
    // rpIdHash (32) + flags (1) + signCount (4)
    const flags = authData[32];
    const hasAttestedCred = (flags & 0x40) !== 0;
    if (!hasAttestedCred) {
        return withAuthCors(errorResponse('No attested credential data', 400, { code: 'NO_CREDENTIAL_DATA' }));
    }

    const signCount = new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0, false);

    // Parse attested credential data
    // AAGUID (16) + credIdLength (2) + credId (credIdLength) + credentialPublicKey (remaining)
    let offset = 37; // 32 + 1 + 4
    // skip AAGUID
    offset += 16;
    const credIdLength = (authData[offset] << 8) | authData[offset + 1];
    offset += 2;
    const credentialIdBytes = authData.slice(offset, offset + credIdLength);
    offset += credIdLength;
    const credentialPublicKeyBytes = authData.slice(offset);

    const credentialId = bufferToBase64Url(credentialIdBytes);
    const credentialPublicKey = bufferToBase64Url(credentialPublicKeyBytes);

    // Determine device type
    const backupEligible = (flags & 0x08) !== 0;
    const backedUp = (flags & 0x10) !== 0;
    const deviceType = backupEligible ? 'multiDevice' : 'singleDevice';

    // Determine transports from authenticatorAttachment
    const transports: string[] = [];
    if (body.authenticatorAttachment === 'platform') {
        transports.push('internal');
    } else if (body.authenticatorAttachment === 'cross-platform') {
        transports.push('usb', 'ble', 'nfc');
    }

    // Store the credential
    await Authenticator.create({
        credentialId,
        userId: auth.userId,
        providerAccountId: auth.userId,
        credentialPublicKey,
        counter: signCount,
        credentialDeviceType: deviceType,
        credentialBackedUp: backedUp ? 1 : 0,
        transports: transports.join(','),
    });

    return withAuthCors(jsonResponse({ success: true, credentialId }));
}

// ── Passkeys: Delete ─────────────────────────────────────────

export async function handlePasskeyDelete(ctx: SecurityRouteContext, passkeyId: string): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const d1Error = requireD1(env);
    if (d1Error) return withAuthCors(d1Error);

    const auth = await requireSession(request, env);
    if (!auth) return withAuthCors(errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' }));

    const authenticator = await Authenticator.find(passkeyId);
    if (!authenticator || authenticator.get('userId') !== auth.userId) {
        return withAuthCors(errorResponse('Passkey not found', 404, { code: 'NOT_FOUND' }));
    }

    await authenticator.delete();

    return withAuthCors(jsonResponse({ success: true }));
}

// ── Passkeys: Authentication Options (for login) ─────────────

export async function handlePasskeysAuthOptions(ctx: SecurityRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:passkey-auth:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    if (!env.OBCF_D1) {
        return withAuthCors(errorResponse('D1 not configured', 500, { code: 'CONFIG_ERROR' }));
    }

    const rpID = new URL(request.url).hostname;
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const challengeB64 = bufferToBase64Url(challenge);

    // Store challenge keyed by IP (no user context yet)
    if (env.OBCF_KV) {
        await env.OBCF_KV.put(`webauthn:auth-challenge:${ip}`, challengeB64, { expirationTtl: 300 });
    }

    const options = {
        challenge: challengeB64,
        rpId: rpID,
        timeout: 60000,
        userVerification: 'preferred',
        allowCredentials: [], // Empty = discoverable credential (passkey)
    };

    return withAuthCors(jsonResponse({ options }));
}

// ── Passkeys: Verify Authentication (for login) ──────────────

export async function handlePasskeysAuthVerify(ctx: SecurityRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = ctx;

    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `auth:passkey-verify:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    if (!env.OBCF_D1 || !env.OBCF_KV) {
        return withAuthCors(errorResponse('D1/KV not configured', 500, { code: 'CONFIG_ERROR' }));
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const expectedChallenge = await env.OBCF_KV.get(`webauthn:auth-challenge:${ip}`);
    if (!expectedChallenge) {
        return withAuthCors(errorResponse('Challenge expired', 400, { code: 'CHALLENGE_EXPIRED' }));
    }
    await env.OBCF_KV.delete(`webauthn:auth-challenge:${ip}`);

    const body = await readJson<{
        id: string;
        rawId: string;
        response: {
            clientDataJSON: string;
            authenticatorData: string;
            signature: string;
            userHandle?: string;
        };
        type: string;
    }>(request);

    if (!body.id || !body.response?.clientDataJSON || !body.response?.authenticatorData || !body.response?.signature) {
        return withAuthCors(errorResponse('Invalid authentication response', 400, { code: 'VALIDATION_ERROR' }));
    }

    // Decode and verify clientDataJSON
    const clientDataRaw = base64UrlToBuffer(body.response.clientDataJSON);
    const clientData = JSON.parse(new TextDecoder().decode(clientDataRaw));

    if (clientData.type !== 'webauthn.get') {
        return withAuthCors(errorResponse('Invalid client data type', 400, { code: 'INVALID_CLIENT_DATA' }));
    }

    if (clientData.challenge !== expectedChallenge) {
        return withAuthCors(errorResponse('Challenge mismatch', 400, { code: 'CHALLENGE_MISMATCH' }));
    }

    // Find the authenticator by credential ID
    const credentialId = body.id;
    const authenticator = await Authenticator.findByCredentialId(credentialId);
    if (!authenticator) {
        return withAuthCors(errorResponse('Passkey not recognized', 400, { code: 'UNKNOWN_CREDENTIAL' }));
    }

    // Verify the signature
    const authDataBuffer = base64UrlToBuffer(body.response.authenticatorData);
    const signatureBuffer = base64UrlToBuffer(body.response.signature);

    // Compute hash of clientDataJSON
    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataRaw));

    // Concatenate authenticatorData + clientDataHash to form the signed data
    const signedData = new Uint8Array(authDataBuffer.length + clientDataHash.length);
    signedData.set(new Uint8Array(authDataBuffer), 0);
    signedData.set(clientDataHash, authDataBuffer.length);

    // Import the stored public key and verify
    const pubKeyB64 = authenticator.get('credentialPublicKey') as string;
    const pubKeyBuffer = base64UrlToBuffer(pubKeyB64);

    let verified = false;
    try {
        // Parse the COSE public key to extract algorithm and key data
        const coseKey = decodeCborSimple(pubKeyBuffer);
        if (coseKey) {
            const cryptoKey = await importCosePublicKey(coseKey);
            if (cryptoKey) {
                const algo = cryptoKey.algorithm;
                verified = await crypto.subtle.verify(
                    algo.name === 'ECDSA' ? { name: 'ECDSA', hash: 'SHA-256' } : algo,
                    cryptoKey,
                    signatureBuffer,
                    signedData,
                );
            }
        }
    } catch (error) {
        console.warn('WebAuthn signature verification failed:', error);
        return withAuthCors(errorResponse('Signature verification failed', 400, { code: 'VERIFICATION_FAILED' }));
    }

    if (!verified) {
        return withAuthCors(errorResponse('Invalid passkey signature', 400, { code: 'INVALID_SIGNATURE' }));
    }

    // Update counter
    const newCount = new DataView(authDataBuffer.buffer, authDataBuffer.byteOffset + 33, 4).getUint32(0, false);
    await authenticator.updateCounter(newCount);

    // Look up the user
    const userId = authenticator.get('userId') as string;
    const user = await User.find(userId);
    if (!user) {
        return withAuthCors(errorResponse('User not found', 404, { code: 'NOT_FOUND' }));
    }

    // Return user info so the frontend can create a session via Auth.js
    return withAuthCors(
        jsonResponse({
            success: true,
            user: {
                id: user.get('id'),
                email: user.get('email'),
                name: user.get('name'),
                image: user.get('image'),
            },
        }),
    );
}

// ── Buffer Utilities ─────────────────────────────────────────

function bufferToBase64Url(buffer: Uint8Array): string {
    let binary = '';
    for (const byte of buffer) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): Uint8Array {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// ── Minimal CBOR Decoder ─────────────────────────────────────
// Supports only the subset needed for WebAuthn attestation/COSE keys

function decodeCborSimple(data: Uint8Array): any {
    let offset = 0;

    function readByte(): number {
        return data[offset++];
    }

    function readBytes(n: number): Uint8Array {
        const slice = data.slice(offset, offset + n);
        offset += n;
        return slice;
    }

    function readUint16(): number {
        const val = (data[offset] << 8) | data[offset + 1];
        offset += 2;
        return val;
    }

    function readUint32(): number {
        const val = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
        offset += 4;
        return val >>> 0;
    }

    function decodeLength(additional: number): number {
        if (additional < 24) return additional;
        if (additional === 24) return readByte();
        if (additional === 25) return readUint16();
        if (additional === 26) return readUint32();
        throw new Error('CBOR: unsupported length');
    }

    function decode(): any {
        if (offset >= data.length) return undefined;

        const initial = readByte();
        const major = initial >> 5;
        const additional = initial & 0x1f;

        switch (major) {
            case 0: // unsigned integer
                return decodeLength(additional);
            case 1: // negative integer
                return -1 - decodeLength(additional);
            case 2: {
                // byte string
                const len = decodeLength(additional);
                return readBytes(len);
            }
            case 3: {
                // text string
                const len = decodeLength(additional);
                return new TextDecoder().decode(readBytes(len));
            }
            case 4: {
                // array
                const len = decodeLength(additional);
                const arr: any[] = [];
                for (let i = 0; i < len; i++) {
                    arr.push(decode());
                }
                return arr;
            }
            case 5: {
                // map
                const len = decodeLength(additional);
                const obj: Record<string | number, any> = {};
                for (let i = 0; i < len; i++) {
                    const key = decode();
                    const value = decode();
                    obj[key] = value;
                }
                return obj;
            }
            case 7: {
                // simple/float
                if (additional === 20) return false;
                if (additional === 21) return true;
                if (additional === 22) return null;
                return undefined;
            }
            default:
                throw new Error(`CBOR: unsupported major type ${major}`);
        }
    }

    try {
        return decode();
    } catch {
        return null;
    }
}

// ── COSE Key Import ──────────────────────────────────────────

async function importCosePublicKey(coseKey: Record<number, any>): Promise<CryptoKey | null> {
    const kty = coseKey[1]; // Key type
    const alg = coseKey[3]; // Algorithm

    if (kty === 2) {
        // EC2 key (ECDSA)
        const crv = coseKey[-1];
        const x = coseKey[-2];
        const y = coseKey[-3];

        if (!x || !y) return null;

        const namedCurve = crv === 1 ? 'P-256' : crv === 2 ? 'P-384' : crv === 3 ? 'P-521' : null;
        if (!namedCurve) return null;

        // Build uncompressed point format: 0x04 || x || y
        const xBytes = x instanceof Uint8Array ? x : new Uint8Array(0);
        const yBytes = y instanceof Uint8Array ? y : new Uint8Array(0);
        const rawKey = new Uint8Array(1 + xBytes.length + yBytes.length);
        rawKey[0] = 0x04;
        rawKey.set(xBytes, 1);
        rawKey.set(yBytes, 1 + xBytes.length);

        return crypto.subtle.importKey('raw', rawKey, { name: 'ECDSA', namedCurve }, false, ['verify']);
    }

    if (kty === 3) {
        // RSA key
        const n = coseKey[-1];
        const e = coseKey[-2];

        if (!n || !e) return null;

        const nBytes = n instanceof Uint8Array ? n : new Uint8Array(0);
        const eBytes = e instanceof Uint8Array ? e : new Uint8Array(0);

        // Build JWK
        const jwk = {
            kty: 'RSA',
            n: bufferToBase64Url(nBytes),
            e: bufferToBase64Url(eBytes),
            alg: alg === -257 ? 'RS256' : 'RS256',
        };

        return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    }

    return null;
}
