/** Comment threads on a few articles, by the team. Seeded only where a post has no comments yet. */
import { JONAS, MAYA, PRIYA, TOMAS } from './people';

export interface DemoComment {
    authorEmail: string;
    body: string;
    replies?: readonly { authorEmail: string; body: string }[];
}

export interface DemoThread {
    /** The post the thread belongs to */
    slug: string;
    comments: readonly DemoComment[];
}

export const THREADS: readonly DemoThread[] = [
    {
        slug: 'why-we-build-on-the-edge',
        comments: [
            {
                authorEmail: JONAS,
                body: 'The Sydney row in that table is the whole argument. We had a reader there who assumed the site was down because the first paint took three seconds.',
                replies: [
                    {
                        authorEmail: TOMAS,
                        body: 'Same reader emailed last week to ask what we changed. Nothing in the page. Everything under it.',
                    },
                ],
            },
            {
                authorEmail: MAYA,
                body: 'Worth saying out loud: the trade-off section is the part people skip and the part that saves them a month. SQLite is a feature until it is not.',
            },
        ],
    },
    {
        slug: 'a-calmer-way-to-ship-content',
        comments: [
            {
                authorEmail: PRIYA,
                body: 'The unticked last box is my favourite thing on this blog. We should put it on the publish button.',
                replies: [
                    {
                        authorEmail: MAYA,
                        body: 'It is on the publish button. You have never noticed because you always publish on time.',
                    },
                ],
            },
            {
                authorEmail: TOMAS,
                body: 'Reading on a phone before publishing catches one layout problem per post, every post. Cheapest QA we have.',
            },
        ],
    },
    {
        slug: 'the-accessibility-fixes-we-almost-skipped',
        comments: [
            {
                authorEmail: JONAS,
                body: 'The StrictMode note deserves its own post. I lost an afternoon to exactly that double effect last year and never understood why it only broke in dev.',
                replies: [
                    {
                        authorEmail: PRIYA,
                        body: 'The ref trick is the whole fix. Capture the opener once and let the re-run leave it alone.',
                    },
                ],
            },
        ],
    },
    {
        slug: 'what-a-block-editor-owes-its-writers',
        comments: [
            {
                authorEmail: MAYA,
                body: 'Undo is sacred should be a line in the hiring doc. Every editor that broke it lost a writer the same week.',
            },
        ],
    },
];
