import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate, search, apiClient, toastSuccess } = vi.hoisted(() => ({
    navigate: vi.fn(),
    search: { value: {} as { edit?: string } },
    apiClient: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => navigate,
    useSearch: () => search.value,
}));
vi.mock('@ottabase/ui-shadcn', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ui-shadcn')>()),
    toast: { success: toastSuccess, error: vi.fn() },
}));
vi.mock('@/ottabase/config', () => ({ APP_ID: 'demo' }));

import { ShortlinksPage } from '../ShortlinksPage';

const links = [
    {
        id: 'l1',
        fullUrl: 'https://github.com/ottabase',
        shortCode: 'gh',
        type: 'redirect',
        appId: 'demo',
        expiryDate: null,
        interstitialEnabled: false,
        interstitialSeconds: 10,
        createdAt: 1,
        updatedAt: 1,
    },
    {
        id: 'l2',
        fullUrl: 'https://example.com/docs',
        shortCode: 'docs',
        type: 'redirect',
        appId: 'demo',
        expiryDate: 1,
        interstitialEnabled: false,
        interstitialSeconds: 10,
        createdAt: 1,
        updatedAt: 1,
    },
];
const scope = { appId: 'demo', organizationId: null, principalId: 'me' };

function renderPage() {
    return render(
        <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
            <ShortlinksPage />
        </OttaQueryProvider>,
    );
}

describe('ShortlinksPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        search.value = {};
        Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
        apiClient.mockImplementation(async (url: string, options?: { method?: string; body?: unknown }) => {
            if (url.startsWith('/api/shortlinks/analytics'))
                return { data: [{ dimension: 'gh', value: 42 }], meta: {} };
            if (url.startsWith('/api/shortlinks?')) {
                return {
                    data: links,
                    pagination: { page: 1, perPage: 15, total: links.length, totalPages: 1, next: null, prev: null },
                };
            }
            if (url === '/api/shortlinks' && options?.method === 'POST') {
                const body = options.body as { fullUrl: string };
                return { success: true, data: { ...links[0], id: 'l3', shortCode: 'k7m2px', fullUrl: body.fullUrl } };
            }
            return { success: true, data: links[0] };
        });
    });

    it('lists links with their clicks and the totals', async () => {
        renderPage();
        expect(await screen.findByText('gh')).toBeInTheDocument();
        expect(screen.getByText('docs')).toBeInTheDocument();
        expect(await screen.findByText('Clicks, last 30 days')).toBeInTheDocument();
        expect(screen.getAllByText('42')).toHaveLength(2);
        expect(screen.getByText('Expired')).toBeInTheDocument();
        expect(screen.getByText('Never')).toBeInTheDocument();
    });

    it('pasting a URL makes a link and copies it', async () => {
        renderPage();
        await screen.findByText('gh');
        fireEvent.change(screen.getByLabelText('Destination URL'), { target: { value: 'https://example.com/x' } });
        fireEvent.click(screen.getByRole('button', { name: 'Shorten' }));

        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/shortlinks',
                expect.objectContaining({ method: 'POST', body: { fullUrl: 'https://example.com/x', appId: 'demo' } }),
            ),
        );
        await waitFor(() =>
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(/\/k7m2px$/)),
        );
        expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('/k7m2px'), expect.anything());
        expect(screen.getByLabelText('Destination URL')).toHaveValue('');
    });

    it('a row opens the editor and saving sends the changes', async () => {
        search.value = { edit: 'l1' };
        renderPage();
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('Edit link');
        const destination = screen.getByLabelText('Destination');
        expect(destination).toHaveValue('https://github.com/ottabase');

        fireEvent.change(destination, { target: { value: 'https://github.com/ottabase/ottabase' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/shortlinks/l1',
                expect.objectContaining({
                    method: 'PATCH',
                    body: expect.objectContaining({ fullUrl: 'https://github.com/ottabase/ottabase', shortCode: 'gh' }),
                }),
            ),
        );
        await waitFor(() =>
            expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ search: { edit: undefined } })),
        );
    });
});
