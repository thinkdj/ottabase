/**
 * Import reads files in the browser and sends them in server-sized batches; the dialog must
 * report the server's per-post outcome rather than assume every post landed.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiClient, invalidateQueries } = vi.hoisted(() => ({
    apiClient: vi.fn(),
    invalidateQueries: vi.fn(async () => undefined),
}));

vi.mock('@ottabase/ottaorm/client', () => ({ useApiClient: () => apiClient }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries }) }));

// Passthrough primitives; the dialog renders its children only while open, like Radix.
vi.mock('@ottabase/ui-shadcn', () => {
    const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
    return {
        Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
            <button {...props}>{children}</button>
        ),
        Dialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) =>
            open ? <div>{children}</div> : null,
        DialogContent: Pass,
        DialogDescription: Pass,
        DialogFooter: Pass,
        DialogHeader: Pass,
        DialogTitle: Pass,
    };
});

import { BlogImportExport } from '../BlogImportExport';

// jsdom's File has no Blob#text() (every browser does), so test files carry their own.
const textFile = (content: string, fileName: string) =>
    Object.assign(new File([content], fileName), { text: async () => content });
const markdownFile = (name: string) =>
    textFile(`---\ntitle: ${name}\ndraft: true\n---\nBody of ${name}.`, `${name}.md`);

async function chooseFiles(files: File[]) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
        fireEvent.change(input, { target: { files } });
    });
}

describe('BlogImportExport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.mockImplementation(async (_url: string, init: { body: { posts: Array<{ slug: string }> } }) => ({
            created: init.body.posts.map((post) => ({ slug: post.slug, id: `id-${post.slug}` })),
            skipped: [],
            warnings: [],
        }));
    });

    it('previews parsed files, then imports them in batches of ten and sums the results', async () => {
        render(<BlogImportExport />);
        await chooseFiles(Array.from({ length: 12 }, (_, i) => markdownFile(`post-${i}`)));

        expect(screen.getByText(/12 post\(s\) ready, 0 published, 12 not published/)).toBeTruthy();
        expect(apiClient).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.click(screen.getByText('Import 12 post(s)'));
        });

        await waitFor(() => expect(screen.getByText('12 created, 0 skipped.')).toBeTruthy());
        expect(apiClient).toHaveBeenCalledTimes(2);
        expect(apiClient.mock.calls.map(([, init]) => init.body.posts.length)).toEqual([10, 2]);
        expect(apiClient.mock.calls[0][0]).toBe('/api/blog/import');
        expect(apiClient.mock.calls[0][1].body.posts[0]).toMatchObject({ title: 'post-0', status: 'draft' });
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['posts'] });
    });

    it('lists unreadable files and reports what the server skipped', async () => {
        apiClient.mockResolvedValueOnce({
            created: [],
            skipped: [{ slug: 'post-a', reason: 'A post with this slug already exists' }],
            warnings: [],
        });
        render(<BlogImportExport />);
        await chooseFiles([markdownFile('post-a'), textFile('x', 'notes.txt')]);

        expect(screen.getByText(/notes\.txt: only \.json exports and \.md files/)).toBeTruthy();

        await act(async () => {
            fireEvent.click(screen.getByText('Import 1 post(s)'));
        });

        await waitFor(() => expect(screen.getByText('0 created, 1 skipped.')).toBeTruthy());
        expect(screen.getByText('post-a: A post with this slug already exists')).toBeTruthy();
    });
});
