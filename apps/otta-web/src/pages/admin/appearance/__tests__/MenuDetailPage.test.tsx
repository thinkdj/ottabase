import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { reorder, updateItem, menu } = vi.hoisted(() => ({
    reorder: vi.fn(async () => ({})),
    updateItem: vi.fn(async () => ({})),
    menu: {
        id: 'm1',
        appId: 'app',
        name: 'Main navigation',
        slug: 'main',
        type: 'sidebar',
        items: [
            { id: 'home', menuId: 'm1', parentId: null, name: 'Home', link: '/', sortOrder: 0 },
            { id: 'about', menuId: 'm1', parentId: null, name: 'About', link: '/about', sortOrder: 1 },
            { id: 'team', menuId: 'm1', parentId: 'about', name: 'Team', link: '/team', sortOrder: 0 },
            { id: 'contact', menuId: 'm1', parentId: null, name: 'Contact', link: '/contact', sortOrder: 2 },
        ],
    },
}));

vi.mock('@tanstack/react-router', () => ({
    useParams: () => ({ menuId: 'm1' }),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/' }),
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@ottabase/brand-engine-react', () => ({
    useBrand: () => ({
        config: { menuSlots: { 'header-nav': [{ menuId: 'm1' }], 'footer-nav': [{ menuId: 'other' }] } },
        refresh: vi.fn(),
    }),
}));
vi.mock('@ottabase/ottamenu/render', () => ({
    renderMenu: (m: { items: { id: string; name: string }[] }) => (
        <ul data-testid="preview">
            {m.items.map((i) => (
                <li key={i.id}>{i.name}</li>
            ))}
        </ul>
    ),
}));
vi.mock('../menus/menuApi', () => ({
    menuApi: {
        get: vi.fn(async () => menu),
        reorder,
        updateItem,
        createItem: vi.fn(),
        deleteItem: vi.fn(),
        update: vi.fn(),
        uploadImage: vi.fn(),
    },
}));

import { AdminMenuDetailPage } from '../MenuDetailPage';

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <AdminMenuDetailPage />
        </QueryClientProvider>,
    );
}

const rowNames = () =>
    Array.from(document.querySelectorAll('[data-item-id]')).map((el) => el.getAttribute('data-item-id'));

describe('AdminMenuDetailPage', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows the items in order and where the menu is shown', async () => {
        renderPage();
        expect(await screen.findByRole('heading', { name: 'Main navigation' })).toBeInTheDocument();
        expect(rowNames()).toEqual(['home', 'about', 'team', 'contact']);
        expect(screen.getByText('Header nav')).toBeInTheDocument();
        expect(screen.queryByText('Footer nav')).not.toBeInTheDocument();
    });

    it('nudges an item and saves only the rows that moved', async () => {
        renderPage();
        await screen.findByRole('heading', { name: 'Main navigation' });
        fireEvent.click(screen.getByRole('button', { name: 'Move Contact up' }));

        expect(rowNames()).toEqual(['home', 'contact', 'about', 'team']);
        await waitFor(() =>
            expect(reorder).toHaveBeenCalledWith('m1', [
                { id: 'about', parentId: null, sortOrder: 2 },
                { id: 'contact', parentId: null, sortOrder: 1 },
            ]),
        );
    });

    it('indents from the keyboard on the handle', async () => {
        renderPage();
        await screen.findByRole('heading', { name: 'Main navigation' });
        fireEvent.keyDown(screen.getByRole('button', { name: /^Move Contact\./ }), { key: 'ArrowRight', altKey: true });

        await waitFor(() =>
            expect(reorder).toHaveBeenCalledWith('m1', [{ id: 'contact', parentId: 'about', sortOrder: 1 }]),
        );
        expect(rowNames()).toEqual(['home', 'about', 'team', 'contact']);
        expect(within(screen.getByTestId('preview')).getAllByRole('listitem')).toHaveLength(4);
    });

    it('opens an item in the side panel and saves it', async () => {
        renderPage();
        await screen.findByRole('heading', { name: 'Main navigation' });
        fireEvent.click(screen.getByRole('button', { name: 'Edit About' }));

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('Edit item');
        const name = within(dialog).getByLabelText('Name');
        expect(name).toHaveValue('About');
        fireEvent.change(name, { target: { value: 'About us' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

        await waitFor(() =>
            expect(updateItem).toHaveBeenCalledWith(
                'm1',
                'about',
                expect.objectContaining({ name: 'About us', parentId: null }),
            ),
        );
    });
});
