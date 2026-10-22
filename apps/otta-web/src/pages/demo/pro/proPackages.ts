// The Ottabase Pro packages, for the /demo/pro tour and the demo's "Pro" marks. No icons or UI here:
// the account menu imports this, so it stays a few bytes in the entry chunk.

/** The Pro sales page. */
export const PRO_URL = 'https://ottabase.com/pro';

export interface ProPackage {
    /** Package key, as in the app's package list once `otta add pro` installed it. */
    key: string;
    name: string;
    summary: string;
    /** Pages a signed-in visitor can use when the package is installed. Admin consoles are platform-only. */
    tryIt?: { label: string; path: string }[];
}

export const PRO_PACKAGES: ProPackage[] = [
    {
        key: 'beacon',
        name: 'Beacon',
        summary:
            'A public status page at /status: components that follow Tower or are set by hand, incidents with a timeline, maintenance, email subscribers.',
        tryIt: [{ label: 'Open the status page', path: '/status' }],
    },
    {
        key: 'payport',
        name: 'PayPort',
        summary:
            "Sell plans to your app's users and organizations: checkout, webhooks, licenses, plan features and limits, trials, plan changes, lifecycle mail.",
        tryIt: [
            { label: 'See the plans (sandbox checkout)', path: '/plans' },
            { label: 'Your billing', path: '/billing' },
        ],
    },
    {
        key: 'helpdesk',
        name: 'Helpdesk',
        summary:
            "A support inbox inside the app: mail and in-app requests become tickets, answered beside the customer's plan and recent errors.",
        tryIt: [{ label: 'Open a support request', path: '/support' }],
    },
    {
        key: 'privacy',
        name: 'Privacy',
        summary:
            'GDPR and CCPA requests: a queue with each deadline, one-click export of every row a person owns, erasure that keeps invoices, all audited.',
        tryIt: [{ label: 'Export your data', path: '/my-data' }],
    },
    {
        key: 'blackbox',
        name: 'Blackbox',
        summary:
            'Error tracking inside the app: Worker and browser errors grouped into issues, samples, hourly counts, alerts on new and regressed.',
    },
    {
        key: 'workbench',
        name: 'Workbench',
        summary:
            'The database inside the admin: tables with their owning models, rows filtered and edited, a read-only-by-default SQL console, saved queries, export.',
    },
    {
        key: 'tower',
        name: 'Tower',
        summary:
            'Every Ottabase app you run, on one board: health, failing cron, last backup, version drift, a month of history, alerts.',
    },
];

/** Keys of the Pro packages, for marking their pages in the account menu on a demo. */
export const PRO_PACKAGE_KEYS: ReadonlySet<string> = new Set(PRO_PACKAGES.map((pkg) => pkg.key));
