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
    toast: { success: vi.fn(), error: vi.fn() },
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
vi.mock('@ottabase/ui-shadcn', async (importOriginal) => {
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
        if (!init?.method) return state();
        if (url === '/api/landing/site') return { site: init.body };
        return { page: { ...about, ...(init.body as object) } };
    });
});

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

    it('is clean again after a save, even when the server normalises the text', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        // Server echoes the Zod-normalised page (trimmed), like the real API.
        api.mockImplementation(async (_url: string, init?: { method?: string; body?: { title: string } }) =>
            init?.method ? { page: { ...about, ...init.body, title: init.body!.title.trim() } } : state(),
        );
        fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'About us   ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
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
        fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'About' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('too much content');
    });

    it('shows server-side field errors (e.g. a taken path) on the field', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        api.mockImplementationOnce(async () => {
            throw new ApiError({
                error: 'Another page already uses this path.',
                status: 422,
                fieldErrors: { path: ['Another page already uses this path.'] },
            });
        });
        fireEvent.change(await screen.findByLabelText('Path'), { target: { value: '/contact' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findAllByText('Another page already uses this path.')).not.toHaveLength(0);
        expect(screen.getByLabelText('Path')).toHaveAttribute('aria-invalid', 'true');
    });

    it('reorders and removes sections', async () => {
        renderWithQuery(<AdminLandingPageEditorPage />);
        fireEvent.click(await screen.findByRole('menuitem', { name: /FAQ/ }));
        const order = () =>
            [...document.querySelectorAll('[aria-expanded]')].map(
                (b) => within(b as HTMLElement).getByText(/^(FAQ|Text)$/).textContent,
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
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'About the team' } });
        expect(wouldBlock()).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
        expect(wouldBlock()).toBe(false);
    });

    it('guards the site settings form too', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        fireEvent.change(await screen.findByLabelText(/Site name/), { target: { value: 'Acme' } });
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
    it('switches theme with one click', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        fireEvent.click(await screen.findByRole('radio', { name: /Bold/ }));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Theme changed to Bold'));
        expect(api).toHaveBeenCalledWith('/api/landing/site', {
            method: 'PUT',
            body: expect.objectContaining({ theme: 'bold' }),
        });
    });

    it('keeps unsaved site-settings edits when the theme is switched', async () => {
        renderWithQuery(<AdminLandingSitePage />);
        fireEvent.change(await screen.findByLabelText(/Site name/), { target: { value: 'Acme Rockets' } });
        fireEvent.click(screen.getByRole('radio', { name: /Bold/ }));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Theme changed to Bold'));
        expect(screen.getByLabelText(/Site name/)).toHaveValue('Acme Rockets');
        expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled();
    });

    it('lists pages with their status and keeps the home page undeletable', async () => {
        api.mockImplementation(async () => ({
            site: DEFAULT_SITE,
            pages: [
                { ...about, id: 'home', path: '/', title: 'Home', published: true },
                { ...about, published: false },
            ],
        }));
        renderWithQuery(<AdminLandingSitePage />);
        expect(await screen.findByText('Draft')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete Home' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Delete About us' })).toBeInTheDocument();
    });
});
