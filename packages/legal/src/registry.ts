/**
 * The catalog of legal documents: slug, title, sections, and the condition under which the whole document is
 * published for a given config.
 */

import { ACCEPTABLE_USE } from './templates/acceptable-use';
import { COOKIES } from './templates/cookies';
import { PRIVACY } from './templates/privacy';
import { REFUNDS } from './templates/refunds';
import { SUBPROCESSORS } from './templates/subprocessors';
import { TERMS } from './templates/terms';
import type { LegalConfig, LegalDocId, LegalSection } from './types';

export interface LegalDocDef {
    slug: string;
    /** Document title (may contain `{{placeholders}}`). */
    title: string;
    sections: LegalSection[];
    /** Whether this whole document is published for the given config. */
    enabled: (config: LegalConfig) => boolean;
}

/** Display and registration order. */
export const LEGAL_DOC_ORDER: LegalDocId[] = [
    'terms',
    'privacy',
    'cookies',
    'acceptable-use',
    'refunds',
    'subprocessors',
];

export const LEGAL_DOCS: Record<LegalDocId, LegalDocDef> = {
    terms: { slug: 'terms', title: 'Terms of Service', sections: TERMS, enabled: () => true },
    privacy: { slug: 'privacy', title: 'Privacy Policy', sections: PRIVACY, enabled: () => true },
    cookies: { slug: 'cookies', title: 'Cookie Policy', sections: COOKIES, enabled: (c) => !!c.features?.cookies },
    'acceptable-use': {
        slug: 'acceptable-use',
        title: 'Acceptable Use Policy',
        sections: ACCEPTABLE_USE,
        enabled: () => true,
    },
    refunds: {
        slug: 'refunds',
        title: 'Refund and Cancellation Policy',
        sections: REFUNDS,
        enabled: (c) => !!c.features?.paidPlans,
    },
    subprocessors: {
        slug: 'subprocessors',
        title: 'Sub-processors',
        sections: SUBPROCESSORS,
        enabled: (c) => !!(c.subProcessors?.length || c.features?.eu),
    },
};

/** Is this document published for the given config? */
export function docEnabled(id: LegalDocId, config: LegalConfig): boolean {
    return Object.prototype.hasOwnProperty.call(LEGAL_DOCS, id) ? LEGAL_DOCS[id].enabled(config) : false;
}

/** The document id behind a URL slug, whether or not it is enabled; null for an unknown slug. */
export function docIdOfSlug(slug: string): LegalDocId | null {
    return LEGAL_DOC_ORDER.find((k) => LEGAL_DOCS[k].slug === slug) ?? null;
}
