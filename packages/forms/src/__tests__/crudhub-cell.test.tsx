import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { CrudHubCell, emptyLabel, registerCrudHubRenderer, shortId } from '../components/crudhub/CrudHubCell';
import { relatedLabel } from '../components/crudhub/CrudHubDetail';
import { crudHubAbilities, resolveListPrefs } from '../components/crudhub/CrudHubList';
import { fillRouteTokens, readRemembered, writeRemembered } from '../components/crudhub/useCrudHub';

const cell = (value: unknown, field?: Record<string, unknown>, extra?: Record<string, unknown>) =>
    render(
        <CrudHubCell
            entity="posts"
            fieldKey="f"
            field={field as never}
            value={value}
            row={{ f: value }}
            {...(extra as object)}
        />,
    );

describe('CrudHubCell', () => {
    it('shows typed empties so null, empty string and empty list differ', () => {
        expect(emptyLabel(null)).toBe('null');
        expect(emptyLabel(undefined)).toBe('—');
        expect(emptyLabel('')).toBe("''");
        expect(emptyLabel([])).toBe('[]');
        expect(emptyLabel({})).toBe('{}');
        expect(emptyLabel(0)).toBeNull();
        expect(emptyLabel(false)).toBeNull();
        cell(null);
        expect(screen.getByText('null').className).toContain('italic');
    });

    it('shortens ids in tables only and renders booleans, urls and json', () => {
        expect(shortId('0123456789abcdefghijklmnop', 'table')).toBe('0123…mnop');
        expect(shortId('0123456789abcdefghijklmnop', 'details')).toBe('0123456789abcdefghijklmnop');
        cell(true, { type: 'boolean' });
        expect(screen.getByText('Yes')).toBeTruthy();
        cell('https://example.com/a/very/long/path/that/keeps/going/and/going/forever', { type: 'string' });
        const link = screen.getByRole('link');
        expect(link.getAttribute('href')).toContain('https://example.com');
        expect(link.textContent).toContain('…');
        cell({ a: 1, b: [1, 2], c: 3 }, { type: 'json' });
        expect(screen.getByRole('button').textContent).toContain('a: 1');
    });

    it('prefers a registered client renderer and links the title field', () => {
        registerCrudHubRenderer('posts.status', (v) => <b data-testid="custom">{String(v).toUpperCase()}</b>);
        render(<CrudHubCell entity="posts" fieldKey="status" field={undefined} value="draft" row={{}} />);
        expect(screen.getByTestId('custom').textContent).toBe('DRAFT');
        cell('Hello', { type: 'string' }, { titleHref: '/admin/crudhub/posts/1', editHref: '/x/edit' });
        expect(screen.getByRole('link', { name: 'Hello' }).getAttribute('href')).toBe('/admin/crudhub/posts/1');
        expect(screen.getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe('/x/edit');
    });
});

describe('CrudHub helpers', () => {
    it('fills route tokens and remembers list preferences per model', () => {
        expect(fillRouteTokens('/blog/:slug', { slug: 'a b' })).toBe('/blog/a%20b');
        expect(fillRouteTokens('/blog/:slug', {})).toBeNull();
        writeRemembered('posts', { perPage: 50 });
        writeRemembered('posts', { sort: { column: 'title', direction: 'desc' } });
        expect(readRemembered('posts')).toEqual({ perPage: 50, sort: { column: 'title', direction: 'desc' } });
        expect(readRemembered('nothing')).toEqual({});
    });

    it('lets the URL win over remembered preferences, and those over model defaults', () => {
        const model = { defaultSort: 'createdAt', defaultSortDirection: 'desc' as const };
        const sortA = { column: 'a', direction: 'asc' as const };
        const sortB = { column: 'b', direction: 'desc' as const };
        expect(resolveListPrefs({}, {}, model)).toEqual({
            perPage: 10,
            sort: { column: 'createdAt', direction: 'desc' },
        });
        expect(resolveListPrefs({}, { perPage: 50, sort: sortA }, model)).toEqual({ perPage: 50, sort: sortA });
        expect(resolveListPrefs({ perPage: 20, sort: sortB }, { perPage: 50, sort: sortA }, model)).toEqual({
            perPage: 20,
            sort: sortB,
        });
        // An explicit "no sort" is honoured at every level
        expect(resolveListPrefs({ sort: null }, { sort: sortA }, model).sort).toBeNull();
        expect(resolveListPrefs({}, { sort: null }, model).sort).toBeNull();
    });

    it('lets readOnly block generic writes only, never actions or a custom editor', () => {
        expect(crudHubAbilities({ readOnly: false }, true)).toEqual({
            create: true,
            remove: true,
            edit: true,
            actions: true,
        });
        expect(crudHubAbilities({ readOnly: true }, true)).toEqual({
            create: false,
            remove: false,
            edit: false,
            actions: true,
        });
        expect(crudHubAbilities({ readOnly: true, routes: { edit: '/x/:id' } }, true).edit).toBe(true);
        expect(crudHubAbilities({ readOnly: false }, false)).toEqual({
            create: false,
            remove: false,
            edit: false,
            actions: false,
        });
    });

    it('labels a related row by its model title field, then name, title, slug, content, id', () => {
        const related = { titleField: 'title', primaryKey: 'id' } as never;
        expect(relatedLabel({ id: '1', title: 'Post', name: 'x' }, related)).toBe('Post');
        expect(relatedLabel({ id: '1', name: 'Ann' })).toBe('Ann');
        expect(relatedLabel({ id: '1', content: 'a'.repeat(80) })).toHaveLength(58);
        expect(relatedLabel({ id: '42' })).toBe('42');
    });
});
