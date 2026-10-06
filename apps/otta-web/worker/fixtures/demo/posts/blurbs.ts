/** Short notes from the team. A blurb is one thought, no title, posted the day it was had. */
import type { BlogDemoPostSeed } from '@ottabase/ottablog/router';
import { JONAS, MAYA, PRIYA, TOMAS } from '../people';

const blurb = (
    slug: string,
    authorEmail: string,
    publishedAt: string,
    blurbText: string,
    crossposts?: readonly string[],
): BlogDemoPostSeed => ({ slug, contentType: 'blurb', authorEmail, publishedAt, blurbText, crossposts });

export const BLURBS: readonly BlogDemoPostSeed[] = [
    blurb(
        'note-audit-timeline',
        TOMAS,
        '2026-10-05T17:40:00.000Z',
        'Shipped the audit timeline today. Grouping entries by day did more for readability than any column we ever added. The filters live in the URL, so a link to a filtered view is a link to the same view.',
    ),
    blurb(
        'note-dark-mode-second-eyes',
        PRIYA,
        '2026-10-03T11:20:00.000Z',
        'Dark mode is not a theme. It is a second pair of eyes on every contrast decision you were not sure about.',
    ),
    blurb(
        'note-command-palette',
        JONAS,
        '2026-09-27T09:05:00.000Z',
        'A good command palette is a search box that admits it is a search box. Ctrl K, three letters, Enter. If it needs a tutorial, it is a menu.',
        ['https://social.example/@jonas/120934'],
    ),
    blurb(
        'note-no-dashes',
        MAYA,
        '2026-09-18T14:10:00.000Z',
        'New rule for our copy from today: no dashes doing the work of a sentence. Commas and full stops. It reads calmer, and it forces us to finish the thought.',
    ),
    blurb(
        'note-keep-data-near-compute',
        TOMAS,
        '2026-08-22T08:30:00.000Z',
        'Edge latency numbers are only impressive until you add one round trip to a database on another continent. Keep the data next to the compute, or the compute next to the data. Pick one.',
    ),
];
