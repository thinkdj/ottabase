/**
 * Building a {@link LegalConfig} from the app's own config, and checking it for the gaps that matter before publishing.
 */

import { listLegalDocuments } from './assemble';
import { lastUpdatedFor } from './interpolate';
import type { LegalConfig } from './types';

/** The parts of an Ottabase app config the legal pages can read. Structural, so no dependency on `@ottabase/config`. */
export interface AppLikeConfig {
    appName: string;
    meta?: { companyName?: string; description?: string };
    email?: { from?: string };
}

/** The fields the app config cannot supply, plus anything you want to override. */
export type LegalConfigInput = Omit<LegalConfig, 'appName' | 'companyName' | 'contactEmail'> &
    Partial<Pick<LegalConfig, 'appName' | 'companyName' | 'contactEmail'>>;

/** The bare address of an email sender, from "Name <addr>" or "addr". */
export const emailAddressOf = (from: string): string => {
    const m = /<([^>]+)>/.exec(from);
    return (m ? m[1] : from).trim();
};

/**
 * A legal config seeded from the app config: the app name, the company name (falling back to the app name) and the
 * contact email (from the mail sender) come from the app; the site URL, jurisdiction and dates are yours to state.
 */
export function legalConfigFromApp(app: AppLikeConfig, input: LegalConfigInput): LegalConfig {
    const contactEmail = input.contactEmail ?? (app.email?.from ? emailAddressOf(app.email.from) : '');
    if (!contactEmail)
        throw new Error('@ottabase/legal: a contactEmail is required (set it, or set email.from in the app config).');
    return {
        ...input,
        appName: input.appName ?? app.appName,
        companyName: input.companyName ?? app.meta?.companyName ?? app.appName,
        contactEmail,
    };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER = /\b(todo|tbd|fixme|placeholder|your[- ](company|app|name|address)|example\.com)\b/i;

/**
 * The gaps a real deployment should close before these pages go live. Each line names one. Empty means the config is
 * complete for what it publishes. Not a legal review: a check that the templates have what they need.
 */
export function validateLegalConfig(config: LegalConfig): string[] {
    const gaps: string[] = [];
    const check = (ok: unknown, gap: string) => {
        if (!ok) gaps.push(gap);
    };
    check(config.appName?.trim(), 'appName is empty.');
    check(config.companyName?.trim(), 'companyName is empty.');
    check(/^https:\/\/[^\s/]+/.test(config.siteUrl ?? ''), 'siteUrl must be an https URL.');
    check(EMAIL.test(config.contactEmail ?? ''), `contactEmail "${config.contactEmail}" is not an email address.`);
    if (config.privacyEmail)
        check(EMAIL.test(config.privacyEmail), `privacyEmail "${config.privacyEmail}" is not an email address.`);
    check(
        config.jurisdiction?.trim() && !PLACEHOLDER.test(config.jurisdiction),
        'jurisdiction is missing or still a placeholder.',
    );
    for (const field of ['companyName', 'companyAddress', 'siteUrl'] as const) {
        const v = config[field];
        if (v && PLACEHOLDER.test(v)) gaps.push(`${field} looks like a placeholder: "${v}".`);
    }
    for (const doc of listLegalDocuments(config))
        check(lastUpdatedFor(config, doc.id)?.trim(), `lastUpdated has no date for the ${doc.title}.`);
    if (config.features?.eu) {
        check(
            config.companyAddress?.trim(),
            'companyAddress is required for EU/UK users (features.eu): the controller must be identifiable.',
        );
        check(
            config.subProcessors?.length,
            'subProcessors is empty while features.eu is on: the Sub-processors page would be a promise.',
        );
    }
    if (config.features?.ai)
        check(config.subProcessors?.length, 'features.ai is on: list the AI providers in subProcessors.');
    if (config.features?.cookies === undefined && config.features?.analytics)
        gaps.push(
            'features.analytics is on without features.cookies: say how analytics is collected, or enable cookies.',
        );
    for (const [k, v] of Object.entries({
        refundWindowDays: config.refundWindowDays,
        minimumAge: config.minimumAge,
        noticeDays: config.noticeDays,
        deletionDays: config.deletionDays,
    }))
        if (v !== undefined && !(Number.isInteger(v) && v >= 0))
            gaps.push(`${k} must be a whole number of days or years, got ${String(v)}.`);
    const pct = config.refundPercent;
    if (pct !== undefined && !(Number.isInteger(pct) && pct >= 1 && pct <= 100))
        gaps.push(`refundPercent must be a whole number from 1 to 100, got ${String(pct)}.`);
    for (const p of config.subProcessors ?? []) {
        check(p.name?.trim() && p.purpose?.trim(), `A sub-processor is missing its name or purpose.`);
        if (p.url) check(/^https:\/\//.test(p.url), `Sub-processor "${p.name}" has a non-https url.`);
    }
    return gaps;
}
