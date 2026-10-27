/**
 * `{{placeholder}}` interpolation, variable assembly and heading slugging. Pure and dependency-free.
 */

import type { LegalConfig, LegalDocId } from './types';

export const DEFAULTS = {
    basePath: '/legal',
    refundWindowDays: 14,
    refundPercent: 100,
    noticeDays: 30,
    deletionDays: 30,
} as const;

/** Turn heading text into a stable, URL-safe anchor id. */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[`*_~]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

/**
 * A stateful slugger that appends `-1`, `-2`, ... on collisions in document order. The renderers and the TOC each use
 * a fresh slugger over the same Markdown, so their anchor ids line up.
 */
export function makeHeadingSlugger(): (text: string) => string {
    const counts = new Map<string, number>();
    return (text: string): string => {
        const base = slugify(text) || 'section';
        const n = counts.get(base) ?? 0;
        counts.set(base, n + 1);
        return n === 0 ? base : `${base}-${n}`;
    };
}

/** The "last updated" string for a specific document, if configured. */
export function lastUpdatedFor(config: LegalConfig, docId: LegalDocId): string | undefined {
    const lu = config.lastUpdated;
    return typeof lu === 'string' ? lu : lu?.[docId];
}

/** The mount path without a trailing slash. */
export const legalBaseOf = (config: Pick<LegalConfig, 'basePath'>): string =>
    (config.basePath ?? DEFAULTS.basePath).replace(/\/+$/, '') || '';

/** A Markdown bullet list of the configured sub-processors. */
function subProcessorList(config: LegalConfig): string {
    return (config.subProcessors ?? [])
        .map((p) => {
            const loc = p.location ? ` (${p.location})` : '';
            const link = p.url ? `. [Privacy information](${p.url})` : '';
            return `- **${p.name}**: ${p.purpose}${loc}${link}`;
        })
        .join('\n');
}

/** Build the `{{placeholder}}` to value map from config, per document. */
export function buildVars(config: LegalConfig, docId?: LegalDocId): Record<string, string> {
    // Clamped so a bad value never publishes "retain -20%"; `validateLegalConfig` still reports it.
    const refundPercent = Math.min(100, Math.max(1, Math.round(config.refundPercent ?? DEFAULTS.refundPercent)));
    const vars: Record<string, string> = {
        appName: config.appName,
        companyName: config.companyName,
        siteUrl: config.siteUrl.replace(/\/+$/, ''),
        legalBase: legalBaseOf(config),
        contactEmail: config.contactEmail,
        privacyEmail: config.privacyEmail ?? config.contactEmail,
        companyAddress: config.companyAddress ?? '',
        jurisdiction: config.jurisdiction,
        governingLaw: config.governingLaw ?? config.jurisdiction,
        lastUpdated:
            (docId && lastUpdatedFor(config, docId)) ||
            (typeof config.lastUpdated === 'string' ? config.lastUpdated : ''),
        copyrightYear: String(config.copyrightYear ?? new Date().getFullYear()),
        refundWindowDays: String(config.refundWindowDays ?? DEFAULTS.refundWindowDays),
        refundPercent: String(refundPercent),
        refundRetainedPercent: String(100 - refundPercent),
        minimumAge: config.minimumAge ? String(config.minimumAge) : '',
        noticeDays: String(config.noticeDays ?? DEFAULTS.noticeDays),
        deletionDays: String(config.deletionDays ?? DEFAULTS.deletionDays),
        subProcessorList: subProcessorList(config),
    };
    if (config.extraVars) {
        for (const [k, v] of Object.entries(config.extraVars)) vars[k] = String(v);
    }
    return vars;
}

/**
 * Replace `{{placeholder}}` tokens with values. An unknown placeholder resolves to an empty string, so a missing
 * optional value simply disappears.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : '',
    );
}
