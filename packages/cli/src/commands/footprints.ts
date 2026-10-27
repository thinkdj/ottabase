import fs from 'fs-extra';
import path from 'path';

/**
 * The app's footprint map, `ottabase/footprints.json`: for each strippable key, the files and
 * folders that exist only for it, the npm packages only it needs, and the keys that cannot stay
 * without it. `otta strip` reads it to know what to remove; `otta add` reads the reference app's to
 * know what to copy. The format and the markers that complete it are described in strip.ts.
 */
export interface Footprint {
    /** What it is, for the plan. */
    description?: string;
    /** Files and folders, relative to the app, that exist only for this key. */
    paths?: string[];
    /** Keys that cannot stay without this one; they are stripped along with it. */
    needs?: string[];
    /** npm dependencies only this key uses, removed from the app's package.json. */
    dependencies?: string[];
}

export type Footprints = Record<string, Footprint>;

export const FOOTPRINTS_FILE = 'ottabase/footprints.json';
export const PACKAGE_KEY = /^[a-z][a-z0-9-]*$/;

/** The app's footprint map, or an empty one when it ships none. */
export function readFootprints(appDir: string): Footprints {
    const file = path.join(appDir, FOOTPRINTS_FILE);
    if (!fs.existsSync(file)) return {};
    const raw = fs.readJsonSync(file) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(`${FOOTPRINTS_FILE} must be an object keyed by package key.`);
    }
    const footprints: Footprints = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (key.startsWith('$')) continue; // "$comment" and friends: notes for the reader, not keys
        if (!PACKAGE_KEY.test(key)) throw new Error(`${FOOTPRINTS_FILE}: "${key}" is not a package key.`);
        if (!value || typeof value !== 'object') throw new Error(`${FOOTPRINTS_FILE}: "${key}" must be an object.`);
        const entry = value as Footprint;
        for (const field of ['paths', 'needs', 'dependencies'] as const) {
            const list = entry[field];
            if (list !== undefined && (!Array.isArray(list) || list.some((item) => typeof item !== 'string'))) {
                throw new Error(`${FOOTPRINTS_FILE}: "${key}".${field} must be a list of strings.`);
            }
        }
        for (const p of entry.paths ?? []) {
            if (path.isAbsolute(p) || p.split(/[\\/]/).includes('..')) {
                throw new Error(`${FOOTPRINTS_FILE}: "${key}" path "${p}" must stay inside the app.`);
            }
        }
        footprints[key] = entry;
    }
    return footprints;
}

/** The keys to strip plus every key that `needs` one of them, transitively. */
export function stripClosure(footprints: Footprints, keys: string[]): string[] {
    const result = new Set(keys);
    let grew = true;
    while (grew) {
        grew = false;
        for (const [key, footprint] of Object.entries(footprints)) {
            if (result.has(key)) continue;
            if ((footprint.needs ?? []).some((needed) => result.has(needed))) {
                result.add(key);
                grew = true;
            }
        }
    }
    return [...result];
}
