import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ModelForm } from '../components/ModelForm';
import type { ModelConfig } from '../types';

interface TestRecord extends Record<string, unknown> {
    id: string;
    name: string;
}

const config: ModelConfig<TestRecord> = {
    entity: 'records',
    fields: {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
        },
        name: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Name' },
            formConfig: { visible: true, fieldType: 'input' },
        },
    },
    zodCreateSchema: z.object({
        name: z.string().transform((value) => value.trim().toUpperCase()),
    }),
};
const visibilityScope = {
    appId: 'test-app',
    organizationId: 'org-1',
    principalId: 'user-1',
};

describe('ModelForm submission', () => {
    it('submits the parsed Zod DTO through the provider client', async () => {
        const apiClient = vi.fn().mockResolvedValue({ id: 'record-1', name: 'ALICE' });
        const onSuccess = vi.fn();

        render(
            <OttaQueryProvider apiClient={apiClient} visibilityScope={visibilityScope}>
                <ModelForm config={config} mode="create" action="/api/records" onSuccess={onSuccess} />
            </OttaQueryProvider>,
        );

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Alice  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith('/api/records', {
                method: 'POST',
                body: { name: 'ALICE' },
            }),
        );
        expect(onSuccess).toHaveBeenCalledWith({ id: 'record-1', name: 'ALICE' });
    });

    it('asks the parent to clear a server field error as soon as that field changes', () => {
        const onServerErrorClear = vi.fn();

        render(
            <OttaQueryProvider apiClient={vi.fn()} visibilityScope={visibilityScope}>
                <ModelForm
                    config={config}
                    mode="create"
                    onSubmit={vi.fn()}
                    serverErrors={{ name: 'Name is already in use' }}
                    onServerErrorClear={onServerErrorClear}
                />
            </OttaQueryProvider>,
        );

        expect(screen.getByText('Name is already in use')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bob' } });
        expect(onServerErrorClear).toHaveBeenCalledWith('name');
    });
});
