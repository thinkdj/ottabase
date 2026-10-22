/**
 * Default referral usernames, picked for a user who has not chosen one.
 *
 * Candidates read like a person first (`deepak`, `deepakthomas`, `thinkdj`), then like a
 * team (`deepak_crew`), then like a mascot (`sunny_otter`). Every pick is derived from the
 * user id, never from Math.random, so two concurrent requests for the same user settle on
 * the same name instead of overwriting each other.
 */
import { REFERRAL_USERNAME_MAX_LENGTH, REFERRAL_USERNAME_MIN_LENGTH } from './validation';

export interface ReferralUsernameSeed {
    id: string;
    name?: string | null;
    email?: string | null;
}

const FLAIRS = ['crew', 'club', 'hq', 'squad', 'hub', 'works', 'house', 'studio', 'circle', 'den'];
const ADJECTIVES = ['sunny', 'brave', 'clever', 'lucky', 'swift', 'bold', 'merry', 'cosmic', 'golden', 'mellow'];
const ANIMALS = ['otter', 'falcon', 'panda', 'fox', 'koala', 'heron', 'lynx', 'badger', 'gecko', 'puffin'];

/** Room left for a `_flair` suffix so the result stays within the max length. */
const BASE_MAX_LENGTH = REFERRAL_USERNAME_MAX_LENGTH - 7;

/** FNV-1a: a stable, well-spread 32-bit hash, so picks are deterministic per user. */
function hash(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** "Zoë O'Brien" → "zoeobrien": diacritics folded, everything outside [a-z0-9] dropped. */
function slug(value: string | null | undefined): string {
    return (value ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, BASE_MAX_LENGTH);
}

/** Ordered, de-duplicated default usernames for this user; the last ones never run out. */
export function* suggestReferralUsernames(seed: ReferralUsernameSeed): Generator<string> {
    const pick = <T>(list: T[], salt: string) => list[hash(`${seed.id}:${salt}`) % list.length];
    const firstName = slug(seed.name?.trim().split(/\s+/)[0]);
    const fullName = slug(seed.name);
    const emailLocal = slug(seed.email?.split('@')[0]?.split('+')[0]);
    const base = [firstName, fullName, emailLocal].find((s) => s.length >= REFERRAL_USERNAME_MIN_LENGTH);

    const seen = new Set<string>();
    const fresh = (candidate: string) => {
        if (candidate.length < REFERRAL_USERNAME_MIN_LENGTH || seen.has(candidate)) return false;
        seen.add(candidate);
        return true;
    };

    for (const candidate of [firstName, fullName, emailLocal]) {
        if (fresh(candidate)) yield candidate;
    }
    if (base) {
        for (const salt of ['flair-1', 'flair-2']) {
            const candidate = `${base}_${pick(FLAIRS, salt)}`;
            if (fresh(candidate)) yield candidate;
        }
    }
    const mascot = `${pick(ADJECTIVES, 'adj')}_${pick(ANIMALS, 'animal')}`;
    if (fresh(mascot)) yield mascot;
    for (let n = 1; ; n++) {
        yield `${mascot}${hash(`${seed.id}:${n}`) % 10_000}`;
    }
}

/**
 * The first suggestion nobody else holds. `isTaken` must answer false for a name this
 * same user already owns. Gives up after `maxAttempts` lookups.
 */
export async function generateReferralUsername(
    seed: ReferralUsernameSeed,
    isTaken: (candidate: string) => Promise<boolean>,
    maxAttempts = 12,
): Promise<string> {
    let attempts = 0;
    for (const candidate of suggestReferralUsernames(seed)) {
        if (!(await isTaken(candidate))) return candidate;
        if (++attempts >= maxAttempts) break;
    }
    throw new Error('No free referral username found');
}
