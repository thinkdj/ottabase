// ============================================================
// OTTABASE USER CONFIG — ResumeMe App
// ============================================================

import { defineOttabaseConfig } from '@ottabase/config';

export default defineOttabaseConfig({
    appId: 'resumeme',
    appName: 'ResumeMe',

    meta: {
        description: 'Professional resume builder — create, customize, and export polished resumes',
        author: '@thinkdj',
        keywords: 'resume, builder, CV, professional, career, job, application',
        companyName: 'Ottabase',
    },

    storage: {
        prefix: 'resumeme',
    },

    packages: {
        ottablog: false,
        shortlinks: true,
        referrals: false,
    },

    customPackages: {},

    features: {
        referrals: {
            enabled: false,
            trackClicks: false,
            expiryDays: 90,
        },
        spotlight: {
            enabled: true,
            shortcuts: ['/'],
        },
        pagination: {
            defaultPageSize: 10,
            maxPageSize: 100,
            sizeOptions: [5, 10, 20, 50, 100],
        },
        crudHub: {
            apiBaseUrl: '/api/crudhub',
            urlBase: 'crudhub',
            urlBaseListing: 'browse',
        },
        authBehavior: {
            sessionMaxAge: 30 * 24 * 60 * 60,
            requireEmailVerified: false,
            disableCredentials: false,
            verbose: false,
        },
    },

    email: {
        from: 'noreply@example.com',
        sesRegion: 'us-east-1',
    },

    ui: {
        preventFOUC: false,
        preventFOUCInsideIframe: false,
        debounceMs: 500,
        layout: { minWidth: 320, maxWidth: 1280 },
        enforceGoogleFonts: true,
    },
});
