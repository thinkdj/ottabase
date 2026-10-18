// ============================================================
// LEGAL CONFIG  —  the one source for the Terms, Privacy, Cookies, Acceptable Use, Refunds and Sub-processors pages
// ============================================================
// Read by the Worker (ottabase/packages/legal.ts serves /api/legal/*) and by the SPA (src/pages/legal renders /legal/*).
// Identity comes from ottabase.config.ts, so a rename propagates. Everything the app config cannot know is stated here.
//
// Before going live: set jurisdiction and companyAddress, date each document, list the real sub-processors, and have
// counsel read the result. The package's health check (legal:config) names every gap until then.
// ============================================================

import { legalConfigFromApp, type LegalConfig } from '@ottabase/legal';
import ottabaseConfig from './ottabase.config';

export const legalConfig: LegalConfig = legalConfigFromApp(ottabaseConfig, {
    siteUrl: 'https://ottabase.com',
    basePath: '/legal',
    // The courts and law that govern disputes. A placeholder keeps the health check red until it is set.
    jurisdiction: 'TODO: the state or country whose courts and law govern, e.g. "the State of Delaware, United States"',
    // The controller's postal address, shown on the Privacy Policy; required for EU/UK users.
    companyAddress: '',
    // One date per document, bumped only when that document changes.
    lastUpdated: {
        terms: '17 October 2026',
        privacy: '17 October 2026',
        cookies: '17 October 2026',
        'acceptable-use': '17 October 2026',
        refunds: '17 October 2026',
        subprocessors: '17 October 2026',
    },
    refundWindowDays: 14,
    noticeDays: 30,
    deletionDays: 30,
    // Which clauses and documents this app publishes.
    features: {
        paidPlans: true, // Polar-backed plans
        freeTrial: false,
        lifetimePlans: false,
        userContent: true, // posts, uploads, forms
        organizations: true, // multi-tenant orgs with RBAC
        api: true, // API keys package
        ai: true, // ottaai through the AI Gateway
        cookies: true, // session cookie, preferences
        analytics: true,
        email: true, // verification, notifications
        eu: true, // GDPR
        california: true, // CCPA/CPRA
    },
    subProcessors: [
        {
            name: 'Cloudflare, Inc.',
            purpose: 'Hosting, storage, edge compute, email routing and AI Gateway',
            location: 'Global',
            url: 'https://www.cloudflare.com/trust-hub/gdpr/',
        },
        {
            name: 'Polar Software Inc.',
            purpose: 'Payments, invoicing and tax as merchant of record',
            location: 'United States',
            url: 'https://polar.sh/legal/privacy',
        },
    ],
});
