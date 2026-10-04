import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = {
    id: string;
    url: string;
    storageKey: string;
    originalName: string;
    mimeType: string;
    mediaKind: 'image' | 'document';
    status: 'active';
    fileSize: number;
    provider: 'r2';
    title?: string | null;
};

const row = (id: string, name: string): Row => ({
    id,
    url: `https://cdn.test/${name}`,
    storageKey: name,
    originalName: name,
    mimeType: 'image/jpeg',
    mediaKind: 'image',
    status: 'active',
    fileSize: 1024,
    provider: 'r2',
});

const { state, uploadMedia, toastInfo } = vi.hoisted(() => ({
    state: { rows: [] as Row[] },
    uploadMedia: vi.fn(),
    toastInfo: vi.fn(),
}));

const page = () => ({ pages: [{ data: state.rows, total: state.rows.length }] });

vi.mock('@/hooks/mediaLibraryHooks', () => ({
    mediaLibraryHooks: {
        useInfiniteList: () => ({
            data: page(),
            isLoading: false,
            hasNextPage: false,
            refetch: async () => ({ data: page() }),
        }),
        useUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
    },
}));
vi.mock('@/lib/upload', () => ({ uploadMedia }));
vi.mock('@ottabase/medialibrary/react', () => ({ MediaPreview: () => <span /> }));
vi.mock('@ottabase/ui-components', () => ({ ConfirmDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: toastInfo } }));

import { MediaLibraryBrowser } from '../MediaLibraryBrowser';

const renderPicker = (props: Partial<Parameters<typeof MediaLibraryBrowser>[0]> = {}) =>
    render(
        <MediaLibraryBrowser
            mode="picker"
            title="Pick"
            description=""
            emptyTitle="Empty"
            emptyDescription=""
            confirmLabel="Use this"
            {...props}
        />,
    );

// Title and file name share the text; the first match is inside the tile
const tile = (name: string) => screen.getAllByText(name)[0].closest('button')!;

describe('MediaLibraryBrowser in picker mode', () => {
    beforeEach(() => {
        state.rows = [row('a', 'beach.jpg'), row('b', 'hills.jpg'), row('c', 'city.jpg')];
        vi.clearAllMocks();
    });

    it('starts with nothing picked and toggles a single pick', () => {
        const onSelectItem = vi.fn();
        renderPicker({ onSelectItem });
        const confirm = screen.getByRole('button', { name: 'Use this' });
        expect(confirm).toBeDisabled();

        fireEvent.click(tile('hills.jpg'));
        expect(tile('hills.jpg')).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(tile('beach.jpg')); // single mode: replaces
        expect(tile('hills.jpg')).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(confirm);
        expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ mediaId: 'a' }), expect.anything());

        fireEvent.click(tile('beach.jpg')); // tap again to drop it
        expect(screen.getByRole('button', { name: 'Use this' })).toBeDisabled();
    });

    it('returns multi picks in tap order and numbers them', () => {
        const onSelectItems = vi.fn();
        renderPicker({ allowMultiselect: true, onSelectItems });
        fireEvent.click(tile('city.jpg'));
        fireEvent.click(tile('beach.jpg'));

        expect(within(tile('city.jpg')).getByText('1')).toBeTruthy();
        expect(within(tile('beach.jpg')).getByText('2')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Use this (2)' }));
        expect(onSelectItems.mock.calls[0][0].map((p: { mediaId: string }) => p.mediaId)).toEqual(['c', 'a']);
    });

    it('uploads dropped files the picker accepts and picks them', async () => {
        uploadMedia.mockImplementation(async (file: File) => {
            state.rows = [row('new', file.name), ...state.rows];
            return { media: { id: 'new' } };
        });
        const { container } = renderPicker({ acceptKinds: ['image'] });
        const photo = new File(['x'], 'sunset.jpg', { type: 'image/jpeg' });
        const pdf = new File(['x'], 'notes.pdf', { type: 'application/pdf' });

        await act(async () => {
            fireEvent.drop(container.firstElementChild!, {
                dataTransfer: { types: ['Files'], files: [photo, pdf] },
            });
        });

        expect(uploadMedia).toHaveBeenCalledTimes(1);
        expect(uploadMedia.mock.calls[0][0]).toBe(photo);
        expect(toastInfo).toHaveBeenCalledWith(expect.stringMatching(/Skipped 1 file/));
        await waitFor(() => expect(tile('sunset.jpg')).toHaveAttribute('aria-pressed', 'true'));
    });
});
