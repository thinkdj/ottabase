/**
 * The social image: the 1200×630 card shown when a page is shared on X, LinkedIn, Slack, …
 *
 * Its content is typed like everything else (`SHARE_FIELDS`). The admin draws it on a canvas
 * with `drawShareCard` (./share-card-draw.ts, exported from `@ottabase/ottalanding/react`) — the
 * same function for the live preview and the uploaded PNG, so what the editor shows is exactly
 * what gets shared. This file holds only the schema and size, so server code can import it.
 */

import { defineFields, type Data } from './fields';

export const SHARE_FIELDS = defineFields({
    heading: { kind: 'text', label: 'Heading' },
    subtext: { kind: 'textarea', label: 'Supporting text' },
    color: { kind: 'color', label: 'Background color', help: 'Defaults to the brand color.' },
    background: {
        kind: 'image',
        label: 'Background image',
        help: 'Shown behind the text, darkened so the text stays readable.',
    },
    /** The rendered PNG (a stored file of the `share-image` purpose), written by the admin when the card is saved; never typed in. */
    image: { kind: 'image', label: 'Rendered image' },
});

export type ShareCard = Data<typeof SHARE_FIELDS>;

export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const;
