import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModelCrud } from '../components/ModelCrud';
import type { ModelConfig } from '../types';

const { formSpy } = vi.hoisted(() => ({ formSpy: vi.fn() }));

vi.mock('../components/ModelTable', () => ({
    ModelTable: ({ onRowClick, onCreate }: { onRowClick?: (r: unknown) => void; onCreate?: () => void }) => (
        <div>
            <button type="button" onClick={() => onRowClick?.({ id: 't1', name: 'Travel' })}>
                Travel row
            </button>
            <button type="button" onClick={onCreate}>
                Add tag
            </button>
        </div>
    ),
}));
vi.mock('../components/ModelForm', () => ({
    ModelForm: (props: { mode: string; initialData?: { name?: string }; hideHeader?: boolean }) => {
        formSpy(props);
        return <div>{props.mode === 'edit' ? `Editing ${props.initialData?.name}` : 'Creating'}</div>;
    },
}));

const tagsConfig: ModelConfig = {
    entity: 'post_tags',
    displayName: 'Tag',
    fields: { id: { type: 'id', primaryKey: true }, name: { type: 'string' } },
};
const scope = { appId: 'app', organizationId: 'org', principalId: 'me' };

describe('ModelCrud side panel', () => {
    it('opens the clicked row in the panel and reports the selection', async () => {
        const onSelectedIdChange = vi.fn();
        const apiClient = vi
            .fn()
            .mockResolvedValueOnce({ data: [{ id: 't1', name: 'Travel' }], total: 1, page: 1, perPage: 10 })
            .mockResolvedValueOnce({ id: 't1', name: 'Travel' });

        render(
            <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
                <ModelCrud config={tagsConfig} onSelectedIdChange={onSelectedIdChange} />
            </OttaQueryProvider>,
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Travel row' }));
        expect(onSelectedIdChange).toHaveBeenCalledWith('t1');
        expect(await screen.findByText('Editing Travel')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toHaveTextContent('Edit tag');
        expect(formSpy.mock.calls.at(-1)?.[0].hideHeader).toBe(true);
        expect(screen.getByRole('button', { name: 'Delete tag' })).toBeInTheDocument();
    });

    it('follows a controlled selection and closes to null', async () => {
        const onSelectedIdChange = vi.fn();
        const apiClient = vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, perPage: 10 });
        render(
            <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
                <ModelCrud config={tagsConfig} selectedId="new" onSelectedIdChange={onSelectedIdChange} />
            </OttaQueryProvider>,
        );

        expect(await screen.findByText('Creating')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toHaveTextContent('New tag');
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        await waitFor(() => expect(onSelectedIdChange).toHaveBeenCalledWith(null));
    });
});
