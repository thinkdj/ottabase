/**
 * The locked-categories card: the teaser always leads with the title, audiences are created,
 * renamed, deleted and filled by email, and each locked category is given audiences, all through
 * the blog's access endpoints (the server is the gate; this is the control).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Endpoint = string | ((variables: any) => string);

const { mutations, accessState } = vi.hoisted(() => ({
    mutations: [] as { method: string; endpoint: Endpoint; mutate: ReturnType<typeof vi.fn> }[],
    accessState: {
        current: {} as Record<string, unknown>,
    },
}));

vi.mock('@ottabase/ottaorm/client', () => ({
    useApiQuery: () => ({ data: accessState.current, isLoading: false }),
    useApiMutation: (options: { method: string; endpoint: Endpoint }) => {
        const entry = { method: options.method, endpoint: options.endpoint, mutate: vi.fn() };
        mutations.push(entry);
        return { mutate: entry.mutate, isPending: false };
    },
}));

vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ setQueryData: vi.fn() }) }));

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
        ConfirmDialog: ({
            open,
            primaryActionText,
            onConfirm,
        }: {
            open: boolean;
            primaryActionText: string;
            onConfirm: () => void;
        }) => (open ? <button onClick={onConfirm}>{primaryActionText}</button> : null),
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

/** The variables last sent by the mutation for `method url` (the endpoint is resolved from them). */
function sent(method: string, url: string): unknown {
    for (const entry of [...mutations].reverse()) {
        if (entry.method !== method) continue;
        for (const [variables] of [...entry.mutate.mock.calls].reverse()) {
            const resolved = typeof entry.endpoint === 'string' ? entry.endpoint : entry.endpoint(variables);
            if (resolved === url) return variables;
        }
    }
    throw new Error(`nothing sent to ${method} ${url}`);
}

const family = {
    id: 'aud-family',
    name: 'Family',
    members: [{ id: 'u2', name: 'Asha', email: 'asha@example.com', image: null }],
};
const friends = { id: 'aud friends', name: 'Friends', members: [] };

beforeEach(() => {
    mutations.length = 0;
    accessState.current = {
        lockedTeaser: [],
        lockedCategories: [
            { id: 'c1', name: 'Life', slug: 'life', inherited: false, audienceIds: ['aud-family'] },
            { id: 'c2', name: 'Kids', slug: 'kids', inherited: true, audienceIds: [] },
        ],
        audiences: [family, friends],
    };
});

describe('BlogLockedAccessCard', () => {
    it('keeps excerpt and hero image off until the title teaser is on, then saves all three', () => {
        render(<BlogLockedAccessCard />);
        const excerpt = screen.getByLabelText('locked-teaser-excerpt') as HTMLInputElement;
        expect(excerpt.disabled).toBe(true);

        fireEvent.click(screen.getByLabelText('locked-teaser-title'));
        fireEvent.click(screen.getByLabelText('locked-teaser-excerpt'));
        fireEvent.click(screen.getByLabelText('locked-teaser-heroImage'));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(sent('POST', '/api/blog/studio/access')).toEqual({ lockedTeaser: ['title', 'excerpt', 'heroImage'] });
    });

    it('creates an audience with a trimmed name', () => {
        render(<BlogLockedAccessCard />);
        const name = screen.getByLabelText('New audience name');

        fireEvent.change(name, { target: { value: '  Close friends ' } });
        fireEvent.submit(name.closest('form')!);

        expect(sent('POST', '/api/blog/studio/audiences')).toEqual({ name: 'Close friends' });
    });

    it('adds a reader to an audience by email and removes one by id', () => {
        render(<BlogLockedAccessCard />);
        const email = screen.getByLabelText('Reader email for Family');

        fireEvent.change(email, { target: { value: ' friend@example.com ' } });
        fireEvent.submit(email.closest('form')!);
        expect(sent('POST', '/api/blog/studio/audiences/aud-family/members')).toEqual({
            audienceId: 'aud-family',
            email: 'friend@example.com',
        });

        fireEvent.click(screen.getByRole('button', { name: 'Remove Asha from Family' }));
        expect(sent('DELETE', '/api/blog/studio/audiences/aud-family/members/u2')).toEqual({
            audienceId: 'aud-family',
            userId: 'u2',
        });
    });

    it('renames an audience in place and deletes one only once confirmed', () => {
        render(<BlogLockedAccessCard />);

        fireEvent.click(screen.getByRole('button', { name: 'Rename Friends' }));
        const name = screen.getByLabelText('Audience name');
        fireEvent.change(name, { target: { value: 'Old friends' } });
        fireEvent.submit(name.closest('form')!);
        // Ids are encoded into the path.
        expect(sent('PATCH', '/api/blog/studio/audiences/aud%20friends')).toEqual({
            id: 'aud friends',
            name: 'Old friends',
        });

        fireEvent.click(screen.getByRole('button', { name: 'Delete Family' }));
        expect(() => sent('DELETE', '/api/blog/studio/audiences/aud-family')).toThrow();
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        expect(sent('DELETE', '/api/blog/studio/audiences/aud-family')).toBe('aud-family');
    });

    it('gives and takes a locked category from audiences, one toggle at a time', () => {
        render(<BlogLockedAccessCard />);
        const life = within(screen.getByText('Life').closest('li')!);

        expect(life.getByRole('button', { name: 'Family' }).getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(life.getByRole('button', { name: 'Friends' }));
        expect(sent('PUT', '/api/blog/studio/categories/c1/audiences')).toEqual({
            categoryId: 'c1',
            audienceIds: ['aud-family', 'aud friends'],
        });

        fireEvent.click(life.getByRole('button', { name: 'Family' }));
        expect(sent('PUT', '/api/blog/studio/categories/c1/audiences')).toEqual({ categoryId: 'c1', audienceIds: [] });

        // A child of a locked category can be given on its own; its parent's audiences read it too.
        expect(screen.getByText(/locked by its parent/)).toBeTruthy();
    });

    it('asks for an audience before categories can be given', () => {
        accessState.current = { ...accessState.current, audiences: [] };
        render(<BlogLockedAccessCard />);

        expect(screen.getByText(/Add an audience above/)).toBeTruthy();
    });
});
