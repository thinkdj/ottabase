/** Standalone articles from the rest of the team: product, design and developer relations. */
import type { BlogDemoPostSeed } from '@ottabase/ottablog/router';
import { checklist, code, cta, doc, faq, h2, image, ol, p, quote, steps, table, ul, warning } from '../blocks';
import { IMAGES, unsplash } from '../images';
import { JONAS, MAYA, PRIYA } from '../people';

export const ARTICLES: readonly BlogDemoPostSeed[] = [
    {
        title: 'A calmer way to ship content',
        slug: 'a-calmer-way-to-ship-content',
        excerpt:
            'How a post gets out the door here: from a draft that is allowed to be bad to a publish you do not have to double-check.',
        contentType: 'blog',
        isFeatured: true,
        publishedAt: '2026-07-07T08:00:00.000Z',
        authorEmail: MAYA,
        categories: ['Product'],
        tags: ['Editor', 'Workflow', 'Publishing'],
        heroImage: { url: unsplash(IMAGES.coast), alt: IMAGES.coast.alt, caption: IMAGES.coast.caption },
        seoMeta: {
            description: 'The editorial rhythm behind every post on this blog, and the tools that make it quiet.',
        },
        content: doc('a-calmer-way-to-ship-content', [
            p(
                'The best writing tool is the one you stop noticing. Write the thing, read it the way a visitor will, press publish. If you find yourself fighting the editor instead of the sentence, something has gone wrong, and it is usually the tool.',
            ),
            h2('The draft is allowed to be bad'),
            p(
                'Drafts autosave while you type, every version is kept, and nothing is visible until you say so. That sounds like plumbing. It is the whole point: a writer who knows the draft is safe writes faster and worse, and worse first drafts become better posts.',
            ),
            image(IMAGES.deskWork),
            h2('Read it like a visitor'),
            p(
                'Preview is not a mode. The editor renders every block exactly the way the published page will, in the same theme, light or dark, with the same hero image. The first time a writer sees their post is also the last time they are surprised by it.',
            ),
            h2('Publish is a verb, not a ceremony'),
            ul([
                'The publish panel asks for the three things a post needs: a slug, an excerpt, a date. Everything else has a sensible default.',
                'Scheduling is a date on the same panel, not a separate screen.',
                'A signed preview link lets someone outside the team read a draft without an account.',
                'Unsaved changes block navigation with a plain question, not a modal essay.',
            ]),
            quote('Ship the sentence, not the formatting.', 'Pinned above the editor in the office'),
            h2('A small editorial rhythm'),
            checklist([
                ['Write the ugly draft in one sitting', true],
                ['Leave it overnight', true],
                ['Read it on a phone', true],
                ['Cut the first paragraph', true],
                ['Publish before you are sure', false],
            ]),
            p(
                'The last box stays unticked on purpose. Most posts are published a day later than they should be, and the delay never made them better.',
            ),
        ]),
    },
    {
        title: 'Designing a brand kit that survives dark mode',
        slug: 'designing-a-brand-kit-that-survives-dark-mode',
        excerpt:
            'A brand is not a set of colours. It is a set of roles that colours play, and dark mode is the first test of whether you named them honestly.',
        contentType: 'blog',
        publishedAt: '2026-07-28T09:30:00.000Z',
        authorEmail: PRIYA,
        categories: ['Design'],
        tags: ['Design systems', 'Brand', 'Dark mode', 'Accessibility'],
        heroImage: { url: unsplash(IMAGES.neon), alt: IMAGES.neon.alt },
        content: doc('designing-a-brand-kit-that-survives-dark-mode', [
            p(
                'Every brand guide we have ever received had a page of hex values and no page about what they are for. Dark mode is where that catches up with you. The navy that carried the whole identity becomes invisible on a dark background, and nobody can say which colour should take its place, because nobody wrote down what it was doing.',
            ),
            h2('Tokens, not colours'),
            p(
                'A brand kit here is a list of roles. Each role has a value for light and a value for dark, and components only ever ask for the role. The identity survives because the roles survive.',
            ),
            table([
                ['Role', 'Light', 'Dark', 'Used for'],
                ['background', 'warm white', 'near black', 'the page'],
                ['foreground', 'ink', 'off white', 'body text'],
                ['muted', 'stone', 'graphite', 'secondary text, dividers'],
                ['primary', 'deep green', 'soft green', 'actions, links, the logo mark'],
                ['accent', 'amber', 'amber, lighter', 'highlights that must not look like actions'],
            ]),
            h2('Contrast is a budget'),
            p(
                'Each role pair is checked for contrast in both schemes before the kit can be saved. The surprising part is how often the dark value needs to be lighter and less saturated than instinct suggests. A brand green at full strength on black vibrates; the same green two steps lighter reads as the same brand and stops hurting.',
            ),
            ul([
                'Body text against the page: 7:1, because people read for a long time.',
                'Secondary text: 4.5:1, no lower, even when it looks elegant.',
                'An action against its own background: 3:1 for the shape, 4.5:1 for the label.',
            ]),
            h2('Test both, every time'),
            image(IMAGES.cityNight, 'Night is not the absence of light. It is a different set of lights.'),
            p(
                'The site design workspace shows the real layout in the real kit with a light and dark toggle beside it. Reviewing a change means flipping the toggle, not imagining it. Since we started doing that, the dark scheme has stopped being the one with the bugs.',
            ),
            h2('The kit is the contract'),
            p(
                'When a route needs a different look, it gets a different kit, not a different stylesheet. The blog can run on an editorial kit while the admin stays on the default one, and both keep every rule above. That is the whole trick: name the roles, keep the rules, let the values change.',
            ),
            cta('Read about theming in the docs', '/docs'),
        ]),
    },
    {
        title: 'What a block editor owes its writers',
        slug: 'what-a-block-editor-owes-its-writers',
        excerpt:
            'Blocks are promises. Undo is sacred. Export is the exit. The three rules we hold our editor to, and the reasons behind each.',
        contentType: 'blog',
        publishedAt: '2026-08-18T07:30:00.000Z',
        authorEmail: JONAS,
        categories: ['Product'],
        tags: ['Editor', 'Writing', 'Open source'],
        heroImage: { url: unsplash(IMAGES.laptopCode), alt: IMAGES.laptopCode.alt },
        content: doc('what-a-block-editor-owes-its-writers', [
            p(
                'A block editor asks a writer to think in units: a heading, a paragraph, a list, a photograph. In exchange it owes them a few things, and most editors forget at least one. These are the three we test against.',
            ),
            h2('Blocks are promises'),
            p(
                'When a writer picks a quote block, they are trusting that it will look like a quote everywhere: in the editor, on the page, in the RSS feed, in the export. A block that renders one way while writing and another way when published is lying, and writers notice the first time.',
            ),
            h2('Undo is sacred'),
            p(
                'Every change, including a block type change, a reorder and a delete, is one step back on Ctrl Z. No confirmation dialogs. A writer who trusts undo experiments; a writer who does not writes defensively, and defensive writing is dull.',
            ),
            h2('Export is the exit'),
            p(
                'Content that cannot leave is content held hostage. Every post exports to JSON for machines and Markdown for everything else, every block included, in one call.',
            ),
            code(
                "const editor = useOttaEditor({ holder: ref, defaultPlugins: 'all' });\n\nconst json = await editor.exportJSON();      // what the database stores\nconst markdown = await editor.exportMarkdown(); // what you paste anywhere else",
            ),
            faq([
                [
                    'Can a writer break the layout?',
                    'No. Blocks render inside the theme and cannot reach outside it. Raw HTML is sanitized on the way out.',
                ],
                [
                    'What happens to a block the theme does not know?',
                    'It renders with the default look of its type. Nothing disappears.',
                ],
                [
                    'Is the kitchensink post real content?',
                    'It is a test page that writes every block once. Open it in the editor to see each shape.',
                ],
            ]),
            quote('The editor should disappear. The writing should not.', 'Jonas, in the first design review'),
        ]),
    },
    {
        title: 'The accessibility fixes we almost skipped',
        slug: 'the-accessibility-fixes-we-almost-skipped',
        excerpt:
            'Our photo lightbox looked finished and was not. A native dialog, a focus hand-off and one StrictMode surprise later, it is.',
        contentType: 'blog',
        publishedAt: '2026-09-15T08:15:00.000Z',
        authorEmail: PRIYA,
        categories: ['Design', 'Engineering'],
        tags: ['Accessibility', 'React', 'UI'],
        heroImage: { url: unsplash(IMAGES.books), alt: IMAGES.books.alt },
        content: doc('the-accessibility-fixes-we-almost-skipped', [
            p(
                'The lightbox had swipe gestures, a thumbnail rail, auto-hiding controls and a reduced motion mode. It had everything except a role. A screen reader announced nothing when it opened, Tab left the viewer for the page behind it, and closing it dropped focus on the body. We had built a very polished trap.',
            ),
            h2('A lightbox is a dialog'),
            p(
                'The fix was smaller than the feature. The browser already knows how to run a modal: the native <code>dialog</code> element opened with <code>showModal()</code> gives you the top layer, a focus trap, an inert page behind and Escape to close, with nothing to maintain.',
            ),
            ul([
                'Role and modality announced for free: <code>dialog</code>, <code>aria-modal</code>, a label.',
                'Tab cycles inside the viewer because everything outside it is inert.',
                'No z-index wars. The top layer is above everything by definition.',
                'Fullscreen goes on the dialog itself, which is the element actually on top.',
            ]),
            code(
                'useEffect(() => {\n    const dialog = ref.current;\n    if (!dialog) return;\n    dialog.showModal();\n    dialog.focus();\n    return () => {\n        // React removes the dialog after this runs; nothing outside a modal can take\n        // focus until then, so hand focus back once the removal has landed.\n        queueMicrotask(() => opener.current?.focus());\n    };\n}, []);',
            ),
            h2('Focus has to go somewhere'),
            p(
                'The browser restores focus for you when you call <code>close()</code>, but we unmount the dialog instead, so we remember the opener ourselves. The first version did that synchronously in the cleanup and silently failed: the dialog was still modal at that moment, so the opener could not take focus. One microtask later, it could.',
            ),
            warning(
                'StrictMode runs effects twice',
                'In development, the second run of the open effect saw the dialog itself as the active element and recorded it as the opener. Keep the opener in a ref that survives the re-run, or the fix only works in production.',
            ),
            h2('The checklist we now run'),
            checklist([
                ['Opens with a role and a name', true],
                ['Focus moves in on open and returns to the opener on close', true],
                ['Escape and the arrow keys work from anywhere inside', true],
                ['A focused video keeps its own arrow keys', true],
                ['Hidden controls come back while a keyboard user has one focused', true],
                ['The counter is announced when it changes', true],
            ]),
            p('Every box took under an hour. The trap had taken a week. The lesson writes itself.'),
        ]),
    },
    {
        title: 'Search that works at 3 a.m.',
        slug: 'search-that-works-at-3-am',
        excerpt:
            'A command palette is a search box that admits it is a search box. What we learned ranking results for tired people.',
        contentType: 'blog',
        publishedAt: '2026-09-29T06:50:00.000Z',
        authorEmail: JONAS,
        categories: ['Product'],
        tags: ['Search', 'Keyboard', 'UX'],
        heroImage: { url: unsplash(IMAGES.milkyWay), alt: IMAGES.milkyWay.alt },
        content: doc('search-that-works-at-3-am', [
            p(
                'The palette gets used most by people who are tired: on call, mid-incident, or just late. They do not want a tour. They want to type three letters and be somewhere. Everything about it follows from that.',
            ),
            h2('Everything is a command'),
            p(
                'Pages, admin screens, posts, people, settings and actions all live in one list. There is no second search for content and a third for settings. If it has a URL or a verb, Ctrl K finds it.',
            ),
            h2('Ranking for tired people'),
            ol([
                'Exact prefix matches first. If you typed "aud", the audit log wins over "Cloud".',
                'Things you opened recently next. Memory is cheap and usually right.',
                'Then fuzzy matches, scored by how many of your letters appear in order.',
                'Actions that change data come last, and say what they will do.',
            ]),
            h2('Keyboard first, mouse welcome'),
            table([
                ['Keys', 'Does'],
                ['Ctrl K', 'Open the palette anywhere'],
                ['Up and Down', 'Move through results'],
                ['Enter', 'Go there'],
                ['Tab', 'Fill the selected result into the box, to refine it'],
                ['Escape', 'Close, and forget what you typed'],
            ]),
            p(
                'The mouse works too, and the results are big enough to hit on a phone. But the whole thing is designed so you never have to look at it, which is the only honest definition of fast.',
            ),
            cta('Try it on this page: press Ctrl K', '/'),
        ]),
    },
    {
        title: 'Email you can actually trust',
        slug: 'email-you-can-actually-trust',
        excerpt:
            'Every email the app sends now lives in one catalogue, renders in the admin exactly as it goes out, and can be sent to yourself in one click.',
        contentType: 'blog',
        publishedAt: '2026-10-01T09:05:00.000Z',
        authorEmail: MAYA,
        categories: ['Engineering', 'Product'],
        tags: ['Email', 'Infrastructure', 'Workflow'],
        heroImage: { url: unsplash(IMAGES.deskNotebook), alt: IMAGES.deskNotebook.alt },
        content: doc('email-you-can-actually-trust', [
            p(
                'Transactional email is the part of an app nobody looks at until it is wrong. The verification link that expired, the invite with a raw template tag in the footer, the reset email that went out from a provider nobody configured. We had all three at some point. Here is how we stopped.',
            ),
            h2('One catalogue, one truth'),
            p(
                'Every email the app can send is an entry in one list: a subject, a header, a body and sample values. The worker composes real sends from that list, and the admin page renders the same list. The preview cannot drift from production because it is production.',
            ),
            code(
                "await sendTemplatedEmail(mailer, {\n    from,\n    to: email,\n    ...composeAppEmail('password-reset', { url: resetUrl.toString() }),\n});",
            ),
            h2('Providers are a secret away'),
            table([
                ['Provider', 'Runs on', 'Needs'],
                ['Dev Trap', 'Anywhere, into a local inbox', 'A KV binding'],
                ['Resend', 'The edge', 'An API key'],
                ['AWS SES', 'The edge', 'Access keys and a region'],
                ['SMTP', 'Node only', 'A server URL'],
            ]),
            p(
                'The app picks the first configured provider unless you choose one. The Email page shows which are configured, with the variable each one is missing, so the answer to "why did this not send" is on the screen rather than in the logs.',
            ),
            h2('Send it to yourself first'),
            steps([
                ['Open Admin, Infrastructure, Email', 'Every email is rendered there, with its subject.'],
                ['Pick a provider, or leave it on Auto', 'Unconfigured providers are greyed out, not hidden.'],
                [
                    'Press Send test on any email',
                    'It goes to the signed-in admin, or to any list of recipients, through the same path real mail takes.',
                ],
                [
                    'Check the Dev Mail page',
                    'In development the message lands in a local inbox you can read without leaving the app.',
                ],
            ]),
            p(
                'The footer bug, incidentally, was a template that escapes its footer while the catalogue sent it HTML. The gallery made it visible on the first render. That is the whole argument for building it.',
            ),
        ]),
    },
];
