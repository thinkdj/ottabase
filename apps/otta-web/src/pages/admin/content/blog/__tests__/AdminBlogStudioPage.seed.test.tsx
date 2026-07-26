/**
 * Demo seeding writes sample content into the app, so it is a platform-owner
 * setup step. The server gate (POST /api/blog/seed-demo → system-scoped
 * platform:admin) is authoritative; these tests lock the matching client
 * behaviour so an org admin never sees a control they cannot use.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isPlatformAdminMock, useSessionMock, seedMutate, mutationOptionsFor } = vi.hoisted(() => {
    const byEndpoint = new Map<string, any>();
    return {
        isPlatformAdminMock: vi.fn(),
        useSessionMock: vi.fn(),
        seedMutate: vi.fn(),
        mutationOptionsFor: byEndpoint,
    };
});

vi.mock('@/lib/auth', () => ({ isPlatformAdmin: isPlatformAdminMock, useSession: useSessionMock }));

vi.mock('@ottabase/ottaorm/client', () => ({
    useApiQuery: () => ({
        data: { activeThemeId: null, themes: [], plugins: [] },
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
    }),
    // Route by endpoint so the seed mutation can be driven independently of the
    // theme/plugin mutations the page also registers.
    useApiMutation: (options: any) => {
        mutationOptionsFor.set(options.endpoint, options);
        if (options.endpoint === '/api/blog/seed-demo') {
            return { mutate: seedMutate, isPending: false };
        }
        return { mutate: vi.fn(), isPending: false };
    },
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock('../BlogAdminNav', () => ({ BlogAdminNav: () => null }));
vi.mock('../blogAdminPaths', () => ({ useBlogSurface: () => ({ contentPath: '/admin/content/blog' }) }));

// Passthrough shadcn primitives — assertions target text and the click handler.
// `asChild` is a Radix slot hint, never a DOM attribute, so it is dropped.
vi.mock('@ottabase/ui-shadcn', () => {
    const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
    return {
        AlertDialog: Pass,
        AlertDialogAction: Pass,
        AlertDialogCancel: Pass,
        AlertDialogContent: Pass,
        AlertDialogDescription: Pass,
        AlertDialogFooter: Pass,
        AlertDialogHeader: Pass,
        AlertDialogTitle: Pass,
        Button: ({
            children,
            asChild: _asChild,
            ...props
        }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) => (
            <button {...props}>{children}</button>
        ),
        Card: Pass,
        CardContent: Pass,
        CardDescription: Pass,
        CardHeader: Pass,
        CardTitle: Pass,
        Dialog: Pass,
        DialogContent: Pass,
        DialogDescription: Pass,
        DialogFooter: Pass,
        DialogHeader: Pass,
        DialogTitle: Pass,
        Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
        Label: ({ children }: { children?: React.ReactNode }) => <label>{children}</label>,
        Select: Pass,
        SelectContent: Pass,
        SelectItem: Pass,
        SelectTrigger: Pass,
        SelectValue: Pass,
        Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
    };
});

import { AdminBlogStudioPage } from '../AdminBlogStudioPage';

const seedButton = () => screen.queryByRole('button', { name: /seed demo content/i });

describe('Content Studio demo seeding', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mutationOptionsFor.clear();
        useSessionMock.mockReturnValue({ user: { id: 'u1' } });
    });

    it('hides the demo card from a non-platform admin', () => {
        isPlatformAdminMock.mockReturnValue(false);

        render(<AdminBlogStudioPage />);

        expect(seedButton()).toBeNull();
        expect(screen.queryByText('Demo Content')).toBeNull();
    });

    it('explains what seeding does before the platform owner runs it', () => {
        isPlatformAdminMock.mockReturnValue(true);

        render(<AdminBlogStudioPage />);

        expect(screen.getByText('Demo Content')).toBeTruthy();
        expect(screen.getByText(/kitchensink/i)).toBeTruthy();
        expect(screen.getByText(/never overwritten/i)).toBeTruthy();
        expect(seedButton()).toBeTruthy();
    });

    it('targets the consolidated endpoint and refreshes the content list', () => {
        isPlatformAdminMock.mockReturnValue(true);

        render(<AdminBlogStudioPage />);
        fireEvent.click(seedButton()!);

        expect(seedMutate).toHaveBeenCalledTimes(1);
        const options = mutationOptionsFor.get('/api/blog/seed-demo');
        expect(options.method).toBe('POST');
        expect(options.invalidateEntities).toEqual(['posts']);
    });

    it('reports how many rows a run created', () => {
        isPlatformAdminMock.mockReturnValue(true);

        render(<AdminBlogStudioPage />);
        act(() =>
            mutationOptionsFor.get('/api/blog/seed-demo').mutationOptions.onSuccess({
                created: [{ id: 'p1', slug: 'welcome', contentType: 'blog' }],
                existing: [],
                total: 4,
            }),
        );

        expect(screen.getByText('Seeded 1 of 4')).toBeTruthy();
    });

    it('reports an already-seeded run without claiming new rows', () => {
        isPlatformAdminMock.mockReturnValue(true);

        render(<AdminBlogStudioPage />);
        act(() =>
            mutationOptionsFor.get('/api/blog/seed-demo').mutationOptions.onSuccess({
                created: [],
                existing: ['welcome'],
                total: 4,
            }),
        );

        expect(screen.getByText('Already seeded')).toBeTruthy();
    });
});
