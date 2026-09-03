/**
 * Token authorization. Knows nothing about R2 or HTTP responses.
 *
 * TURBO_CACHE_TOKENS is JSON keyed by token id; each entry stores the SHA-256 hex of the
 * bearer token (never the token), the teams it may touch ("*" = any) and a write flag.
 */

export interface TokenGrant {
    sha256: string;
    teams: string[];
    write: boolean;
}

export type TokenMap = Record<string, TokenGrant>;

export interface Grant {
    id: string;
    write: boolean;
}

const HEX_64 = /^[a-f0-9]{64}$/;

/** Fail closed: anything not exactly the expected shape yields `null` (→ every request 401). */
export function parseTokens(json: string | undefined): TokenMap | null {
    if (!json) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: TokenMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (!value || typeof value !== 'object') return null;
        const { sha256, teams, write } = value as Record<string, unknown>;
        if (typeof sha256 !== 'string' || !HEX_64.test(sha256)) return null;
        if (!Array.isArray(teams) || teams.length === 0 || !teams.every((t) => typeof t === 'string')) return null;
        if (typeof write !== 'boolean') return null;
        out[id] = { sha256: sha256.toLowerCase(), teams: teams as string[], write };
    }
    return out;
}

export async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function bearerToken(request: Request): string | null {
    const header = request.headers.get('authorization') ?? '';
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    return match ? match[1] : null;
}

/**
 * `unauthorized` = no/unknown token, `forbidden` = known token not allowed for `team`.
 * Comparing SHA-256 hex digests; a timing-safe compare buys nothing here.
 */
export async function authorize(
    tokens: TokenMap | null,
    bearer: string | null,
    team: string,
): Promise<Grant | 'unauthorized' | 'forbidden'> {
    if (!tokens || !bearer) return 'unauthorized';
    const digest = await sha256Hex(bearer);
    const entry = Object.entries(tokens).find(([, grant]) => grant.sha256 === digest);
    if (!entry) return 'unauthorized';
    const [id, grant] = entry;
    if (!grant.teams.includes('*') && !grant.teams.includes(team)) return 'forbidden';
    return { id, write: grant.write };
}
