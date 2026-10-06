import { buildPreviewTheme } from '@ottabase/brand-engine';
import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    apiClient: vi.fn(),
    putMappings: vi.fn(async () => ({})),
    putSlots: vi.fn(async () => ({ success: true })),
    refresh: vi.fn(),
}));

const theme = buildPreviewTheme({ tokensJson: '{}', themePresetId: null }, 'light');
const full = {
    kit: 'a',
    routeMappings: [
        { pathPattern: '/blog/**', layoutTemplateId: 'app-shell', brandKitId: 'b', priority: 10 },
        { pathPattern: '/**', layoutTemplateId: 'homepage', brandKitId: 'a', priority: 0 },
    ],
    layoutTemplatesMap: {},
    brandKitsMap: {
        a: {
            brandName: 'Acme',
            logos: {},
            theme,
            defaultColorScheme: 'light',
            allowDarkModeToggle: true,
            hideOttabaseBranding: false,
        },
        b: {
            brandName: 'Blog co',
            logos: {},
            theme,
            defaultColorScheme: 'light',
            allowDarkModeToggle: true,
            hideOttabaseBranding: false,
        },
    },
};
const mappings = full.routeMappings.map((m, i) => ({ ...m, id: `map-${i}` }));
const kits = [
    {
        id: 'a',
        name: 'Acme kit',
        brandName: 'Acme',
        isDefault: true,
        defaultColorScheme: 'light',
        allowDarkModeToggle: true,
        hideOttabaseBranding: false,
    },
    {
        id: 'b',
        name: 'Blog kit',
        brandName: 'Blog co',
        defaultColorScheme: 'light',
        allowDarkModeToggle: true,
        hideOttabaseBranding: false,
    },
];
const menus = [{ id: 'm1', appId: null, name: 'Main navigation', slug: 'main', type: 'navbar', items: [] }];

vi.mock('@tanstack/react-router', () => ({
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
        <a href={to} {...rest}>
            {children}
        </a>
    ),
}));
vi.mock('@ottabase/brand-engine-react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/brand-engine-react')>()),
    useBrand: () => ({ config: null, refresh: mocks.refresh }),
}));
vi.mock('@/ottabase/components/ConfigurableLayout', () => ({
    ConfigurableLayout: ({ config, children }: { config: { header: string }; children: React.ReactNode }) => (
        <div data-testid="shell" data-header={config.header}>
            {children}
        </div>
    ),
}));
vi.mock('@/hooks/useEditorLeaveGuard', () => ({ useEditorLeaveGuard: () => ({ blocker: null }) }));
vi.mock('@/components/editor/UnsavedChangesDialog', () => ({ UnsavedChangesDialog: () => null }));
vi.mock('../brand/brandApi', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../brand/brandApi')>()),
    brandConfigApi: { get: async () => full },
    layoutApi: {
        putMappings: mocks.putMappings,
        getTemplates: vi.fn(),
        putTemplate: vi.fn(),
        deleteTemplate: vi.fn(),
        getMappings: vi.fn(),
    },
    menuSlotsApi: { getRaw: async () => [], put: mocks.putSlots },
}));
vi.mock('../menus/menuApi', () => ({ menuApi: { list: async () => menus } }));

import { AdminSiteDesignPage } from '../SiteDesignPage';

const scope = { appId: 'app', organizationId: null, principalId: 'u1' };

describe('AdminSiteDesignPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiClient.mockImplementation(async (url: string) => {
            if (url === '/api/brand/kits') return kits;
            if (url === '/api/brand/layouts') return [];
            if (url === '/api/brand/mappings') return mappings;
            throw new Error(`unexpected ${url}`);
        });
        render(
            <OttaQueryProvider apiClient={mocks.apiClient} visibilityScope={scope}>
                <AdminSiteDesignPage />
            </OttaQueryProvider>,
        );
    });

    it('previews the site for a path with the kit and layout that path gets', async () => {
        expect(await screen.findByText(/Uses Acme kit on the Homepage layout/)).toBeInTheDocument();
        const shell = screen.getByTestId('shell');
        expect(shell).toHaveAttribute('data-header', 'minimal');
        expect(within(shell).getByRole('heading', { level: 1, hidden: true })).toHaveTextContent('Acme');

        fireEvent.change(screen.getByLabelText('Preview path'), { target: { value: '/blog' } });
        expect(screen.getByText(/Uses Blog kit on the App Shell layout/)).toBeInTheDocument();
        expect(screen.getByTestId('shell')).toHaveAttribute('data-header', 'topbar');
        expect(within(screen.getByTestId('shell')).getByRole('heading', { level: 1, hidden: true })).toHaveTextContent(
            'Blog co',
        );
        expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
    });

    it('removing a route changes the preview and saves routes and slots together', async () => {
        await screen.findByText(/Uses Acme kit on the Homepage layout/);
        fireEvent.change(screen.getByLabelText('Preview path'), { target: { value: '/blog' } });
        fireEvent.click(screen.getAllByRole('button', { name: 'Remove route' })[0]);
        expect(screen.getByText(/Uses Acme kit on the Homepage layout/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Put a menu in a slot' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(mocks.putMappings).toHaveBeenCalledTimes(1));
        expect(mocks.putMappings.mock.calls[0][0]).toEqual({
            mappings: [
                {
                    pathPattern: '/**',
                    layoutTemplateId: 'homepage',
                    brandKitId: 'a',
                    priority: 0,
                    tokenOverridesJson: null,
                },
            ],
        });
        expect(mocks.putSlots).toHaveBeenCalledWith([
            { slotName: 'header-nav', menuId: 'm1', renderType: 'navbar', sortOrder: 0 },
        ]);
        await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
        expect(await screen.findByRole('button', { name: 'Saved' })).toBeDisabled();
    });
});
