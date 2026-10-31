/**
 * The landing admin: content is validated in the browser with the same schema the server uses,
 * errors land on the exact field, saves send the whole page, and the theme picker applies at once.
 */
import { ApiError } from '@ottabase/api';
import { DEFAULT_SITE, type LandingPageData } from '@ottabase/ottalanding';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, toast, blockers } = vi.hoisted(() => ({
    api: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    // Every useBlocker registration, so tests can ask "would leaving be blocked right now?"
    blockers: [] as Array<{ shouldBlockFn: () => boolean; enableBeforeUnload: () => boolean }>,
}));
const resolver = vi.hoisted(() => ({ status: 'idle' as 'idle' | 'blocked', proceed: vi.fn(), reset: vi.fn() }));
vi.mock('@/lib/api', async () => {
    const real = await import('@ottabase/api');
    return { api, isApiError: real.isApiError, getErrorMessage: real.getErrorMessage };
});
vi.mock('sonner', () => ({ toast }));
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
    useNavigate: () => vi.fn(),
    useParams: () => ({ pageId: 'p1' }),
    useBlocker: (opts: (typeof blockers)[number]) => {
        blockers.push(opts);
        return resolver.status === 'blocked' ? resolver : { status: 'idle' };
    },
}));
const wouldBlock = () => blockers.at(-1)!.shouldBlockFn() && blockers.at(-1)!.enableBeforeUnload();
// The scaled live preview needs layout (ResizeObserver); here it just reports what it would draw.
vi.mock('@ottabase/ottalanding/react', () => ({
    LandingPreview: ({ site, sections, scheme }: { site: { theme: string }; sections: unknown[]; scheme?: string }) => (
        <div data-testid="preview" data-scheme={scheme}>
            {site.theme}:{sections.length}
        </div>
    ),
}));
// jsdom has no canvas: drawing is covered in the package; here the save wiring is what counts.
const share = vi.hoisted(() => ({
    withSiteShareImage: vi.fn(async (site: object) => ({ site })),
    withPageShareImage: vi.fn(async (_id: string, page: object) => ({ page })),
}));
vi.mock('../shareImage', async (importOriginal) => ({
    ...(await importOriginal<object>()),
    paintShareCard: async () => [],
    ...share,
}));
// The media library is its own feature; here it hands back a public image, or a private one
// (no `file`), as a pick would.
const SHOT = vi.hoisted(() => ({
    key: `otta-web/media/${'c'.repeat(32)}.png`,
    width: 1200,
    height: 800,
    variants: ['thumb' as const, 'card' as const],
}));
type Pick = { url: string; alt: string; file: typeof SHOT | null };
vi.mock('@/components/media-library/MediaLibraryBrowser', () => ({
    MediaLibraryBrowser: ({ onSelectItem }: { onSelectItem: (item: Pick) => void }) => (
        <>
            <button
                type="button"
                onClick={() => onSelectItem({ url: `/api/files/public/${SHOT.key}`, alt: 'Dashboard', file: SHOT })}
            >
                Pick sample
            </button>
            <button type="button" onClick={() => onSelectItem({ url: '/api/files/abc', alt: '', file: null })}>
                Pick private
            </button>
        </>
    ),
}));
const SHARE = { key: `otta-web/share-image/${'d'.repeat(32)}.png`, width: 1200, height: 630 };
vi.mock('@ottabase/ui', async (importOriginal) => {
    const real = await importOriginal<object>();
    const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
    return {
        ...real,
        DropdownMenu: Pass,
        DropdownMenuTrigger: Pass,
        DropdownMenuContent: Pass,
        DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) => (
            <button type="button" role="menuitem" onClick={onSelect}>
                {children}
            </button>
        ),
    };
});

import { AdminLandingLeadsPage } from '../AdminLandingLeadsPage';
import { AdminLandingPageEditorPage } from '../AdminLandingPageEditorPage';
import { AdminLandingSitePage } from '../AdminLandingSitePage';
import { UnsavedChangesGuard } from '../UnsavedChangesGuard';

const about: LandingPageData = {
    id: 'p1',
    path: '/about',
    title: 'About us',
    description: '',
    published: true,
    sections: [{ id: 's1', type: 'text', data: { body: 'We build things.' } }],
};
const state = () => ({ site: { ...DEFAULT_SITE }, pages: [about] });

function renderWithQuery(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
    vi.clearAllMocks();
    api.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
        if (url.startsWith('/api/landing/leads')) return { leads: [], total: 0, unread: 0 };
        if (!init?.method) return state();
        if (url === '/api/landing/site') return { site: init.body };
        return { page: { ...about, ...(init.body as object) } };
    });
});

/** Radix tabs switch on mouse-down, like a real click. */
const openTab = async (name: string) => fireEvent.mouseDown(await screen.findByRole('tab', { name }), { button: 0 });
const openPageSettings = async () => fireEvent.click(await screen.findByRole('button', { name: /Page settings/ }));
const closePageSettings = () => fireEvent.click(screen.getByRole('button', { name: 'Done' }));

describe('page editor', () => {
    it('keeps Save disabled until something changes, and previews the draft live', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        const save = await screen.findByRole('button', { name: 'Save' });
        expect(save).toBeDisabled();
        expect(screen.getByTestId('preview')).toHaveTextContent('launch:1');

        fireEvent.click(screen.getByRole('menuitem', { name: /Hero/ }));
        expect(save).toBeEnabled();
        expect(screen.getByTestId('preview')).toHaveTextContent('launch:2');
    });

    it('validates in the browser and points at the exact field, without calling the server', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        fireEvent.click(await screen.findByRole('menuitem', { name: /Hero/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        const headline = screen.getByLabelText(/Headline/);
        expect(headline).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByText('Required')).toBeInTheDocument();
        expect(api).toHaveBeenCalledTimes(1); // only the initial load
    });

    it('saves the whole page once it is valid', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        fireEvent.click(await screen.findByRole('menuitem', { name: /Hero/ }));
        fireEvent.change(screen.getByLabelText(/Headline/), { target: { value: 'Hello there' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Page saved'));
        const [url, init] = api.mock.calls.at(-1)!;
        expect(url).toBe('/api/landing/pages/p1');
        expect(init.method).toBe('PUT');
        expect(init.body.sections.map((s: { type: string }) => s.type)).toEqual(['text', 'hero']);
        expect(init.body.sections[1].data.title).toBe('Hello there');
    });

    it('keeps title, path and description in Page settings, saved with the page', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        // Server echoes the Zod-normalised page (trimmed), like the real API.
        api.mockImplementation(async (_url: string, init?: { method?: string; body?: { title: string } }) =>
            init?.method ? { page: { ...about, ...init.body, title: init.body!.title.trim() } } : state(),
        );
        await openPageSettings();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'About us   ' } });
        closePageSettings();
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        // Clean again, even though the server trimmed the text.
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
    });

    it('shows page-level problems that belong to no single field', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        api.mockImplementationOnce(async () => {
            throw new ApiError({
                error: 'Please fix the highlighted fields.',
                status: 422,
                fieldErrors: { sections: ['This page has too much content. Split it into more pages.'] },
            });
        });
        fireEvent.click(await screen.findByRole('menuitem', { name: /FAQ/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('too much content');
    });

    it('opens Page settings on a server-side error there (e.g. a taken path)', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        api.mockImplementationOnce(async () => {
            throw new ApiError({
                error: 'Another page already uses this path.',
                status: 422,
                fieldErrors: { path: ['Another page already uses this path.'] },
            });
        });
        await openPageSettings();
        fireEvent.change(screen.getByLabelText('Path'), { target: { value: '/contact' } });
        closePageSettings();
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByLabelText('Path')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getAllByText('Another page already uses this path.')).not.toHaveLength(0);
    });

    it('publishes a draft in one step, and unpublishes a live page', async () => {
        api.mockImplementation(async (url: string, init?: { method?: string; body?: object }) =>
            init?.method
                ? { page: { ...about, ...init.body } }
                : { site: DEFAULT_SITE, pages: [{ ...about, published: false }] },
        );
        renderWithQuery(<AdminLandingPageEditorPage />);
        expect(await screen.findByRole('button', { name: 'Save draft' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Page published'));
        expect(api.mock.calls.at(-1)![1].body.published).toBe(true);
    });

    it('unpublishes a live page without a separate save', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Unpublish' }));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Page unpublished'));
        expect(api.mock.calls.at(-1)![1].body.published).toBe(false);
    });

    it('reorders and removes sections', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        fireEvent.click(await screen.findByRole('menuitem', { name: /FAQ/ }));
        const order = () =>
            [...document.querySelectorAll('[aria-expanded]')].flatMap(
                (b) => within(b as HTMLElement).queryByText(/^(FAQ|Text)$/)?.textContent ?? [],
            );
        expect(order()).toEqual(['Text', 'FAQ']);
        fireEvent.click(screen.getAllByRole('button', { name: 'Move up' })[1]);
        expect(order()).toEqual(['FAQ', 'Text']);
        fireEvent.click(screen.getByRole('button', { name: 'Remove text section' }));
        expect(order()).toEqual(['FAQ']);
        expect(screen.getByTestId('preview')).toHaveTextContent('launch:1');
    });
});

describe('unsaved changes', () => {
    it('guards in-app navigation and reloads only while the page has unsaved edits', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        await screen.findByRole('button', { name: 'Save' });
        expect(wouldBlock()).toBe(false);
        await openPageSettings();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'About the team' } });
        closePageSettings();
        expect(wouldBlock()).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(wouldBlock()).toBe(false);
    });

    it('guards the site settings too', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Settings');
        fireEvent.change(await screen.findByLabelText('Site name'), { target: { value: 'Acme' } });
        expect(wouldBlock()).toBe(true);
    });

    it('asks before leaving, and only leaves when confirmed', () => {
        resolver.status = 'blocked';
        try {
            render(<UnsavedChangesGuard when />);
            expect(screen.getByText('Leave without saving?')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
            expect(resolver.proceed).toHaveBeenCalled();
        } finally {
            resolver.status = 'idle';
        }
    });
});

describe('preview color scheme', () => {
    it("starts in the theme's own scheme and switches between light and dark", async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        const preview = await screen.findByTestId('preview');
        expect(preview).toHaveAttribute('data-scheme', 'light'); // Launch defaults to light
        fireEvent.click(screen.getByRole('radio', { name: 'dark' }));
        expect(screen.getByTestId('preview')).toHaveAttribute('data-scheme', 'dark');
        expect(screen.getByRole('radio', { name: 'dark' })).toHaveAttribute('aria-checked', 'true');
    });
});

describe('site page', () => {
    it('opens on the pages, with their status, and keeps the home page undeletable', async () => {
        api.mockImplementation(async (url: string) =>
            url.startsWith('/api/landing/leads')
                ? { leads: [], total: 0, unread: 0 }
                : {
                      site: DEFAULT_SITE,
                      pages: [
                          { ...about, id: 'home', path: '/', title: 'Home', published: true },
                          { ...about, published: false },
                      ],
                  },
        );
        renderWithQuery(<AdminLandingSitePage />);
        expect(await screen.findByRole('tab', { name: 'Pages' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Draft')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete Home' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Delete About us' })).toBeInTheDocument();
    });

    it('still renders when the stored public address does not parse', async () => {
        api.mockImplementation(async (url: string) =>
            url.startsWith('/api/landing/leads')
                ? { leads: [], total: 0, unread: 0 }
                : { site: { ...DEFAULT_SITE, siteUrl: 'https://[bad' }, pages: [about] },
        );
        renderWithQuery(<AdminLandingSitePage />);
        expect(await screen.findByRole('heading', { name: 'Landing site' })).toBeInTheDocument();
    });

    it('switches theme with one click', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Design');
        fireEvent.click(await screen.findByRole('radio', { name: /Bold/ }));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Theme changed to Bold'));
        expect(api).toHaveBeenCalledWith('/api/landing/site', {
            method: 'PUT',
            body: expect.objectContaining({ theme: 'bold' }),
        });
    });

    it('keeps unsaved edits across tabs and theme switches', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Settings');
        fireEvent.change(await screen.findByLabelText('Site name'), { target: { value: 'Acme Rockets' } });
        await openTab('Design');
        fireEvent.click(await screen.findByRole('radio', { name: /Bold/ }));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Theme changed to Bold'));
        await openTab('Settings');
        expect(await screen.findByLabelText('Site name')).toHaveValue('Acme Rockets');
        expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    it('saves edits from every tab with one save bar, shown only while something changed', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Settings');
        expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
        fireEvent.change(await screen.findByLabelText('Site name'), { target: { value: 'Acme' } });
        await openTab('Design');
        fireEvent.change(await screen.findByLabelText('Brand color'), { target: { value: '#2563eb' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/landing/site', {
                method: 'PUT',
                body: expect.objectContaining({ name: 'Acme', brandColor: '#2563eb' }),
            }),
        );
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull());
    });

    it('takes you to the tab with the field that needs fixing', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Design');
        fireEvent.change(await screen.findByLabelText('Brand color'), { target: { value: 'blue' } });
        await openTab('Settings');
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(await screen.findByText('Use a hex color like #2563eb')).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    });

    it('edits links as compact rows: add, reorder, remove', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Navigation');
        const header = await screen.findByRole('group', { name: 'Header links' });
        const inHeader = within(header);
        expect(inHeader.getByLabelText('Link 1 text')).toHaveValue(DEFAULT_SITE.nav![0].label);
        expect(inHeader.getByLabelText('Link 1 goes to')).toHaveValue(DEFAULT_SITE.nav![0].href);

        fireEvent.click(inHeader.getByRole('button', { name: 'Move link 2 up' }));
        expect(inHeader.getByLabelText('Link 1 text')).toHaveValue(DEFAULT_SITE.nav![1].label);

        fireEvent.click(within(header).getByRole('button', { name: 'Add link' }));
        const count = DEFAULT_SITE.nav!.length + 1;
        expect(inHeader.getByLabelText(`Link ${count} text`)).toHaveValue('');
        fireEvent.click(inHeader.getByRole('button', { name: `Remove link ${count}` }));
        expect(inHeader.queryByLabelText(`Link ${count} text`)).toBeNull();
    });
});

describe('images and colors', () => {
    it('picks a logo from the media library, stores the file (not its URL) and saves it with a brand color', async () => {
        const { container } = renderWithQuery(<AdminLandingSitePage />);
        await openTab('Design');
        fireEvent.click(await screen.findByRole('button', { name: 'Choose logo' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Pick sample' }));
        expect(screen.getByText(`${'c'.repeat(32)}.png`)).toBeInTheDocument();
        // The small preview shows the thumbnail rendition, not the original.
        expect(
            container.querySelector(`img[src="/api/files/public/otta-web/media/${'c'.repeat(32)}/thumb.webp"]`),
        ).not.toBeNull();
        fireEvent.change(screen.getByLabelText('Brand color'), { target: { value: '#2563eb' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/landing/site', {
                method: 'PUT',
                body: expect.objectContaining({ logo: SHOT, brandColor: '#2563eb' }),
            }),
        );
    });

    it('refuses a private file, which the public site could not show', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Design');
        fireEvent.click(await screen.findByRole('button', { name: 'Choose logo' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Pick private' }));
        expect(toast.error).toHaveBeenCalledWith('That image is private. Pick a public one.');
        expect(screen.queryByRole('button', { name: 'Replace logo' })).toBeNull();
    });

    it('keeps a typed image address as the trimmed string', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Design');
        fireEvent.click((await screen.findAllByRole('button', { name: 'Use an image address' }))[0]);
        fireEvent.change(screen.getByLabelText('Logo'), { target: { value: '  https://cdn.acme.dev/logo.svg ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/landing/site', {
                method: 'PUT',
                body: expect.objectContaining({ logo: 'https://cdn.acme.dev/logo.svg' }),
            }),
        );
    });

    it('rejects a color that is not #rrggbb, and can go back to the theme’s own', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Design');
        fireEvent.change(await screen.findByLabelText('Brand color'), { target: { value: 'blue' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        expect(await screen.findByText('Use a hex color like #2563eb')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
        expect(screen.getByLabelText('Brand color')).toHaveValue('');
    });

    it('fills an empty image description from the library, but never overwrites one', async () => {
        const hero = { id: 'h1', type: 'hero', data: { title: 'Hi' } };
        api.mockImplementation(async () => ({ site: DEFAULT_SITE, pages: [{ ...about, sections: [hero] }] }));
        renderWithQuery(<AdminLandingPageEditorPage />);
        fireEvent.click(await screen.findByRole('button', { name: /Hero/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Choose image' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Pick sample' }));
        expect(screen.getByLabelText('Image description')).toHaveValue('Dashboard');

        fireEvent.change(screen.getByLabelText('Image description'), { target: { value: 'Mine' } });
        fireEvent.click(screen.getByRole('button', { name: 'Replace image' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Pick sample' }));
        expect(screen.getByLabelText('Image description')).toHaveValue('Mine');
    });
});

describe('social image', () => {
    it('renders the site image on save and keeps the card the editor shows', async () => {
        share.withSiteShareImage.mockImplementationOnce(async (site: object) => ({
            site: {
                ...site,
                share: { ...(site as { share?: object }).share, image: SHARE },
            },
        }));
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Settings');
        expect(await screen.findByRole('img', { name: 'Social image: Ottabase' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'Ship faster' } });
        expect(screen.getByRole('img', { name: 'Social image: Ship faster' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/landing/site', {
                method: 'PUT',
                body: expect.objectContaining({
                    share: { heading: 'Ship faster', image: SHARE },
                }),
            }),
        );
    });

    it('still saves when the image can’t be updated, and says so', async () => {
        share.withSiteShareImage.mockImplementationOnce(async (site: object) => ({ site, warning: 'Saved, but…' }));
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Settings');
        fireEvent.change(await screen.findByLabelText('Site name'), { target: { value: 'Acme' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Saved, but…'));
        expect(toast.success).toHaveBeenCalledWith('Site settings saved');
    });

    it('re-renders the image in the new theme’s fonts when the theme changes', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        await openTab('Design');
        fireEvent.click(await screen.findByRole('radio', { name: /Bold/ }));
        await waitFor(() =>
            expect(share.withSiteShareImage).toHaveBeenCalledWith(expect.objectContaining({ theme: 'bold' })),
        );
    });

    it('gives a page its own image on request, defaulting to its title, and can go back to the site’s', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        await openPageSettings();
        fireEvent.click(await screen.findByLabelText('Use a custom image for this page'));
        expect(screen.getByRole('img', { name: 'Social image: About us' })).toBeInTheDocument();
        expect(screen.getByLabelText('Heading')).toHaveAttribute('placeholder', 'About us');
        closePageSettings();
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() =>
            expect(share.withPageShareImage).toHaveBeenCalledWith(
                'p1',
                expect.objectContaining({ share: {} }),
                expect.anything(),
            ),
        );

        await openPageSettings();
        fireEvent.click(screen.getByLabelText('Use a custom image for this page'));
        expect(screen.queryByRole('img', { name: /Social image:/ })).toBeNull();
    });
});

describe('preview links', () => {
    const draft = { ...about, published: false };
    const withSite = (site: object) =>
        api.mockImplementation(async (url: string, init?: { method?: string; body?: { reset?: boolean } }) => {
            if (!init?.method) return { site: { ...DEFAULT_SITE, ...site }, pages: [draft] };
            if (url.endsWith('/preview'))
                return { token: init.body?.reset ? 'NEWtokenNEWtokenNEWtoken' : 'tokentokentokentokentoke' };
            return {};
        });

    it('offers a private link for drafts on the live site, and resets it on request', async () => {
        withSite({ siteUrl: 'https://acme.dev' });
        renderWithQuery(<AdminLandingPageEditorPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Share preview' }));
        expect(
            await screen.findByDisplayValue('https://acme.dev/about?preview=tokentokentokentokentoke'),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Reset link' }));
        expect(
            await screen.findByDisplayValue('https://acme.dev/about?preview=NEWtokenNEWtokenNEWtoken'),
        ).toBeInTheDocument();
        expect(api).toHaveBeenCalledWith('/api/landing/pages/p1/preview', { method: 'POST', body: { reset: true } });
    });

    it('asks for the public URL first instead of making a link that goes nowhere', async () => {
        withSite({});
        renderWithQuery(<AdminLandingPageEditorPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Share preview' }));
        expect(await screen.findByText(/in the site settings first/)).toBeInTheDocument();
        expect(api).not.toHaveBeenCalledWith(expect.stringContaining('/preview'), expect.anything());
    });

    it('is not offered for published pages, which are public already', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        await screen.findByRole('button', { name: 'Save' });
        expect(screen.queryByRole('button', { name: 'Share preview' })).toBeNull();
    });
});

describe('form entries inbox', () => {
    const entry = (over: object) => ({
        id: 'l1',
        kind: 'contact',
        email: 'ada@example.com',
        name: 'Ada',
        message: 'Can I use this for my startup?',
        pagePath: '/contact',
        read: false,
        createdAt: '2026-10-11T09:00:00.000Z',
        ...over,
    });
    const inbox = (url: string, init?: { method?: string; responseType?: string }) => {
        if (url === '/api/landing') return state();
        if (init?.responseType === 'blob') return new Blob(['csv']);
        if (init?.method) return { success: true };
        const signups = url.includes('kind=signup');
        const leads = signups
            ? [entry({ id: 'l2', kind: 'signup', name: '', message: '', email: 'fan@example.com' })]
            : [entry({}), entry({ id: 'l3', name: 'Grace', email: 'grace@example.com', read: true })];
        return { leads, total: leads.length, unread: leads.filter((l) => !l.read).length };
    };

    beforeEach(() => {
        api.mockImplementation(async (url: string, init?: { method?: string; responseType?: string }) =>
            inbox(url, init),
        );
    });

    it('lists entries with what is new, and reads one when it is opened', async () => {
        renderWithQuery(<AdminLandingLeadsPage />);
        expect(await screen.findByText('1 new')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Ada/ }));
        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/landing/leads/l1', { method: 'PATCH', body: { read: true } }),
        );
        expect(screen.getAllByRole('link', { name: /Reply/ })[0]).toHaveAttribute(
            'href',
            'mailto:ada%40example.com?subject=Re%3A%20your%20message',
        );
    });

    it('filters to signups', async () => {
        renderWithQuery(<AdminLandingLeadsPage />);
        await screen.findByText('1 new');
        fireEvent.click(screen.getByRole('radio', { name: 'Signups' }));
        expect(await screen.findByText('fan@example.com')).toBeInTheDocument();
        expect(api).toHaveBeenCalledWith('/api/landing/leads?kind=signup&offset=0');
    });

    it('deletes only after confirming', async () => {
        renderWithQuery(<AdminLandingLeadsPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'Delete entry from ada@example.com' }));
        expect(api).not.toHaveBeenCalledWith('/api/landing/leads/l1', { method: 'DELETE' });
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/api/landing/leads/l1', { method: 'DELETE' }));
    });

    it('exports a CSV download and suggests turning on email notifications', async () => {
        const createObjectURL = vi.fn(() => 'blob:csv');
        Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
        renderWithQuery(<AdminLandingLeadsPage />);
        expect(await screen.findByText(/Want an email when someone writes/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
        await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
        expect(api).toHaveBeenCalledWith('/api/landing/leads?format=csv', { responseType: 'blob' });
    });

    it('shows the count of new entries on the landing site page', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        expect(await screen.findByRole('link', { name: /Form entries/ })).toHaveAttribute(
            'href',
            '/admin/content/landing/leads',
        );
        expect(await screen.findByLabelText('1 new')).toBeInTheDocument();
    });
});
