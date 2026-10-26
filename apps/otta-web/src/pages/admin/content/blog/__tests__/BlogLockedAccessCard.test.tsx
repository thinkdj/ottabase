/**
 * The locked-categories card: the teaser always leads with the title, and readers are invited
 * and removed by the blog's access endpoints (the server is the gate; this is the control).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mutations, accessState } = vi.hoisted(() => ({
    mutations: new Map<string, { mutate: ReturnType<typeof vi.fn>; options: any }>(),
    accessState: {
        lockedTeaser: [] as string[],
        lockedCategories: [
            { id: 'c1', name: 'Life', slug: 'life', inherited: false },
            { id: 'c2', name: 'Family', slug: 'family', inherited: true },
        ],
        readers: [{ id: 'u2', name: 'Asha', email: 'asha@example.com', image: null }],
    },
}));

vi.mock('@ottabase/ottaorm/client', () => ({
    useApiQuery: () => ({ data: accessState, isLoading: false }),
    useApiMutation: (options: any) => {
        const key = typeof options.endpoint === 'function' ? options.endpoint('{id}') : options.endpoint;
        const entry = { mutate: vi.fn(), options };
        mutations.set(`${options.method} ${key}`, entry);
        return { mutate: entry.mutate, isPending: false };
    },
}));

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock('../blogAdminPaths', () => ({ useBlogSurface: () => ({ categoriesPath: '/admin/content/blog/categories' }) }));

vi.mock('@ottabase/ui', () => {
    const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
    return {
        Avatar: Pass,
        AvatarFallback: Pass,
        AvatarImage: () => null,
        Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
            <button {...props}>{children}</button>
        ),
        Card: Pass,
        CardContent: Pass,
        CardDescription: Pass,
        CardHeader: Pass,
        CardTitle: Pass,
        Checkbox: ({
            id,
            checked,
            disabled,
            onCheckedChange,
        }: {
            id: string;
            checked: boolean;
            disabled?: boolean;
            onCheckedChange: (checked: boolean) => void;
        }) => (
            <input
                type="checkbox"
                id={id}
                aria-label={id}
                checked={checked}
                disabled={disabled}
                onChange={(event) => onCheckedChange(event.target.checked)}
            />
        ),
        Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
        Label: ({ children }: { children?: React.ReactNode }) => <label>{children}</label>,
    };
});

import { BlogLockedAccessCard } from '../BlogLockedAccessCard';

describe('BlogLockedAccessCard', () => {
    beforeEach(() => mutations.clear());

    it('lists locked categories, marking the ones locked through a parent', () => {
        render(<BlogLockedAccessCard />);
        expect(screen.getByText('Locked: Life, Family (via parent)')).toBeTruthy();
    });

    it('keeps excerpt and hero image off until the title teaser is on, then saves all three', () => {
        render(<BlogLockedAccessCard />);
        const excerpt = screen.getByLabelText('locked-teaser-excerpt') as HTMLInputElement;
        expect(excerpt.disabled).toBe(true);

        fireEvent.click(screen.getByLabelText('locked-teaser-title'));
        fireEvent.click(screen.getByLabelText('locked-teaser-excerpt'));
        fireEvent.click(screen.getByLabelText('locked-teaser-heroImage'));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        const save = mutations.get('POST /api/blog/studio/access')!;
        expect(save.mutate).toHaveBeenCalledWith({ lockedTeaser: ['title', 'excerpt', 'heroImage'] });
    });

    it('invites by email and removes a reader by id', () => {
        render(<BlogLockedAccessCard />);

        fireEvent.change(screen.getByLabelText('Reader email'), { target: { value: ' friend@example.com ' } });
        fireEvent.click(screen.getByRole('button', { name: /invite/i }));
        expect(mutations.get('POST /api/blog/studio/access/readers')!.mutate).toHaveBeenCalledWith({
            email: 'friend@example.com',
        });

        fireEvent.click(screen.getByRole('button', { name: 'Remove access for Asha' }));
        const revoke = mutations.get('DELETE /api/blog/studio/access/readers/%7Bid%7D')!;
        expect(revoke.mutate).toHaveBeenCalledWith('u2');
        expect(revoke.options.endpoint('u 2')).toBe('/api/blog/studio/access/readers/u%202');
    });
});
