/**
 * Core types for `@ottabase/legal`: parameterized, conditional legal pages.
 *
 * The package ships conventional SaaS policy templates as ordered, conditional {@link LegalSection}s. You provide one
 * {@link LegalConfig} (app and company name, contact, jurisdiction, feature toggles, ...); the package drops the clauses
 * that do not apply, fills in your values, applies any per-app overrides, and renders the result as Markdown, HTML or
 * React.
 *
 * These templates are a starting point written in the conventional form, not legal advice. Have counsel review them
 * before you publish, especially jurisdiction, refunds, retention and the data practices they describe.
 */

/** The policy documents the package can produce. */
export type LegalDocId = 'terms' | 'privacy' | 'cookies' | 'acceptable-use' | 'refunds' | 'subprocessors';

/**
 * Feature toggles that switch whole clauses (and whole documents) on or off, so each app only publishes the policy text
 * that actually applies to it. Every flag defaults to off, except that the "not for children" clause is on until
 * `children` says otherwise.
 */
export interface LegalFeatures {
    /** Paid plans or subscriptions: billing, renewal and refund clauses, and the Refunds document. */
    paidPlans?: boolean;
    /** A free trial precedes the paid plan: trial clause in Terms and Refunds. */
    freeTrial?: boolean;
    /** One-time "lifetime" purchases are sold: what lifetime means, and that they are not subscriptions. */
    lifetimePlans?: boolean;
    /** Users create or upload content: content ownership and license clause. */
    userContent?: boolean;
    /** Shared workspaces, teams or organizations with an admin: the organizations clause. */
    organizations?: boolean;
    /** You expose an API or integrations: the API and rate-limit clause. */
    api?: boolean;
    /** You send user content to AI providers: an AI-processing disclosure. */
    ai?: boolean;
    /** You set cookies or local storage: cookie clause and the Cookie Policy document. */
    cookies?: boolean;
    /** You use analytics or measurement: tracking disclosure. */
    analytics?: boolean;
    /** You send marketing or product email beyond service messages: the communications clause. */
    email?: boolean;
    /** The service is intended for children: omit the "not for children" clause. */
    children?: boolean;
    /** You have EU, UK or EEA users: GDPR legal bases, rights, transfer and complaint clauses. */
    eu?: boolean;
    /** You have California users: CCPA/CPRA rights and the "Do Not Sell or Share" statement. */
    california?: boolean;
}

/** A third party that processes personal data on your behalf (GDPR Art. 28 transparency). */
export interface SubProcessor {
    /** Vendor name, such as "Cloudflare, Inc." */
    name: string;
    /** What they do, such as "Hosting and edge compute". */
    purpose: string;
    /** Where data is processed, such as "United States / Global". */
    location?: string;
    /** Their privacy or DPA page. */
    url?: string;
}

/** Per-document overrides: add, replace or remove sections for one app. */
export interface LegalSectionOverrides {
    /** Sections inserted before the template sections. */
    prepend?: LegalSection[];
    /** Sections appended after the template sections. */
    append?: LegalSection[];
    /** Replace a template section (matched by `id`) with these fields, shallow-merged. */
    replace?: Record<string, Partial<Omit<LegalSection, 'id'>>>;
    /** Section ids to drop entirely. */
    remove?: string[];
}

/**
 * Everything the templates need. Build it by hand or from your app config with `legalConfigFromApp`. `{{placeholders}}`
 * in the templates are filled from these values (plus {@link LegalConfig.extraVars}).
 */
export interface LegalConfig {
    /** Product or app name, such as "Tuskly". `{{appName}}` */
    appName: string;
    /** Legal entity that operates the service, such as "Tuskly Inc.". `{{companyName}}` */
    companyName: string;
    /** Public site URL, such as "https://tuskly.com". `{{siteUrl}}` */
    siteUrl: string;
    /** Path where the legal pages are mounted (default "/legal"). Cross-document links use it. `{{legalBase}}` */
    basePath?: string;
    /** General or support contact email. `{{contactEmail}}` */
    contactEmail: string;
    /** Privacy-specific contact (defaults to `contactEmail`). `{{privacyEmail}}` */
    privacyEmail?: string;
    /** Postal address of the controller. Required in practice under the GDPR. `{{companyAddress}}` */
    companyAddress?: string;
    /** Courts or venue for disputes, such as "the State of Delaware, United States". `{{jurisdiction}}` */
    jurisdiction: string;
    /** Governing law (defaults to `jurisdiction`). `{{governingLaw}}` */
    governingLaw?: string;
    /**
     * "Last updated" date shown on each document. A single string applies to all; a map dates each document on its
     * own, which is the honest choice since they change apart. `{{lastUpdated}}`
     */
    lastUpdated: string | Partial<Record<LegalDocId, string>>;
    /** Copyright year shown in the footer (defaults to the current year). `{{copyrightYear}}` */
    copyrightYear?: number;
    /** Days after a charge within which a refund is considered. 0 publishes a no-refund policy. Default 14. `{{refundWindowDays}}` */
    refundWindowDays?: number;
    /** Minimum age to hold an account, when you set one. Unset: "old enough to form a binding contract". `{{minimumAge}}` */
    minimumAge?: number;
    /** Days of notice given before a price change or a material change to the terms takes effect. Default 30. `{{noticeDays}}` */
    noticeDays?: number;
    /** Days after account deletion within which personal data is removed from live systems. Default 30. `{{deletionDays}}` */
    deletionDays?: number;
    /** Clause and document toggles. */
    features?: LegalFeatures;
    /** Sub-processor list (renders the Sub-processors document). */
    subProcessors?: SubProcessor[];
    /** Per-document section overrides. */
    overrides?: Partial<Record<LegalDocId, LegalSectionOverrides>>;
    /** Extra `{{placeholders}}` available to your override sections. */
    extraVars?: Record<string, string | number>;
}

/**
 * One clause. `body` is Markdown with `{{placeholders}}`; `when` decides whether it appears for a given config.
 * Headings inside `body` (`##`, `###`) feed the table of contents.
 */
export interface LegalSection {
    /** Stable id, used by overrides and as the anchor fallback. */
    id: string;
    /** Heading text (Markdown, interpolated), rendered as the section's `##`. Omit for a lead-in paragraph. */
    title?: string;
    /** Markdown body with `{{placeholders}}`. */
    body: string;
    /** Include this section only when it returns true (default: always). */
    when?: (config: LegalConfig) => boolean;
}

/** A heading entry for the on-page table of contents. */
export interface TocItem {
    id: string;
    text: string;
    level: number;
}

/** A fully assembled, interpolated document ready to render. */
export interface AssembledLegalDocument {
    id: LegalDocId;
    /** URL slug, such as "privacy". */
    slug: string;
    /** Interpolated document title, such as "Privacy Policy". */
    title: string;
    /** "Last updated" string for this document, if configured. */
    lastUpdated?: string;
    /** The interpolated Markdown body, all included sections joined. */
    markdown: string;
    /** Table of contents derived from the Markdown headings. */
    toc: TocItem[];
    /** Copyright line for the footer. */
    copyright: string;
}

/** Lightweight descriptor for listing the enabled policies, for a footer or an index page. */
export interface LegalDocMeta {
    id: LegalDocId;
    slug: string;
    title: string;
}
