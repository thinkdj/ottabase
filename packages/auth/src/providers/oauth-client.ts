// ============================================================
// @ottabase/auth - Generic OAuth 2.0 / OIDC Authorization-Code Client
// ============================================================
//
// A single, provider-agnostic implementation of the authorization-code
// flow with PKCE (RFC 7636). Every OAuth preset in `presets.ts` is just
// data (endpoints, scope, claim mapping) fed into these functions --
// there is no per-provider control flow to audit.
//
// ============================================================

import { base64UrlEncode, randomToken, sha256Base64Url } from '../crypto';
import type { OAuthProfile, OAuthProviderConfig, OAuthTokenResponse } from './types';

export interface PkcePair {
    codeVerifier: string;
    codeChallenge: string;
}

/** PKCE code_verifier + S256 code_challenge pair (RFC 7636). */
export async function createPkcePair(): Promise<PkcePair> {
    const codeVerifier = randomToken(32);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    return { codeVerifier, codeChallenge };
}

export function buildAuthorizationUrl(
    provider: OAuthProviderConfig,
    params: { redirectUri: string; state: string; codeChallenge: string },
): string {
    const url = new URL(provider.authorizationUrl);
    url.searchParams.set('client_id', provider.clientId ?? '');
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', provider.scope);
    url.searchParams.set('state', params.state);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    for (const [key, value] of Object.entries(provider.authorizationParams ?? {})) {
        url.searchParams.set(key, value);
    }

    return url.toString();
}

export async function exchangeCodeForTokens(
    provider: OAuthProviderConfig,
    params: { code: string; redirectUri: string; codeVerifier: string },
): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: params.redirectUri,
        code_verifier: params.codeVerifier,
        ...provider.tokenParams,
    });

    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        ...provider.extraHeaders,
    };

    if (provider.tokenAuthStyle === 'basic') {
        headers.Authorization = `Basic ${base64UrlEncodeAscii(`${provider.clientId}:${provider.clientSecret}`)}`;
    } else {
        body.set('client_id', provider.clientId ?? '');
        body.set('client_secret', provider.clientSecret ?? '');
    }

    const response = await fetch(provider.tokenUrl, { method: 'POST', headers, body: body.toString() });
    if (!response.ok) {
        throw new Error(`OAuth token exchange failed for provider "${provider.id}" (HTTP ${response.status})`);
    }

    return (await response.json()) as OAuthTokenResponse;
}

function base64UrlEncodeAscii(value: string): string {
    return btoa(value);
}

export async function fetchUserProfile(provider: OAuthProviderConfig, tokens: OAuthTokenResponse): Promise<OAuthProfile> {
    if (provider.getProfile) {
        return provider.getProfile(tokens, provider);
    }

    if (!provider.userInfoUrl || !provider.mapProfile) {
        throw new Error(`OAuth provider "${provider.id}" is missing a userinfo endpoint or profile mapper`);
    }

    const response = await fetch(provider.userInfoUrl, {
        headers: {
            Authorization: `${tokens.token_type ?? 'Bearer'} ${tokens.access_token}`,
            Accept: 'application/json',
            ...provider.extraHeaders,
        },
    });

    if (!response.ok) {
        throw new Error(`OAuth userinfo request failed for provider "${provider.id}" (HTTP ${response.status})`);
    }

    const raw = await response.json();
    return provider.mapProfile(raw, tokens);
}
