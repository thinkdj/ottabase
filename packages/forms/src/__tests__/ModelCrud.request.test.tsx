import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelCrud } from '../components/ModelCrud';
import type { ModelConfig } from '../types';

const { modelFormSpy } = vi.hoisted(() => ({
    modelFormSpy: vi.fn(),
}));

vi.mock('../components/ModelTable', () => ({
    ModelTable: ({ onCreate }: { onCreate?: () => void }) => (
        <div>
            <div>Users table</div>
            <button type="button" onClick={onCreate}>
                Add user
            </button>
        </div>
    ),
}));

vi.mock('../components/ModelDetail', () => ({
    ModelDetail: () => <div>User detail</div>,
}));

vi.mock('../components/ModelForm', () => ({
    ModelForm: (props: { onSubmit?: (data: Record<string, unknown>) => Promise<void> }) => {
        modelFormSpy(props);
        return <div>User form</div>;
    },
}));

const usersConfig: ModelConfig = {
    entity: 'users',
    primaryKey: 'id',
    fields: {
        id: {
            type: 'id',
            primaryKey: true,
        },
    },
};
const visibilityScope = {
    appId: 'test-app',
    organizationId: 'org-1',
    principalId: 'user-1',
};

afterEach(() => {
    vi.restoreAllMocks();
    modelFormSpy.mockClear();
});

describe('ModelCrud request integration', () => {
    it('uses the provider API client and does not retry a 403 response', async () => {
        const forbidden = Object.assign(new Error('Forbidden'), {
            name: 'ApiError',
            status: 403,
            messages: ['Forbidden'],
            retryable: false,
        });
        const apiClient = vi.fn().mockRejectedValue(forbidden);
        const errorReporter = vi.fn();

        render(
            <StrictMode>
                <OttaQueryProvider
                    apiClient={apiClient}
                    visibilityScope={visibilityScope}
                    errorReporter={errorReporter}
                >
                    <ModelCrud config={usersConfig} />
                </OttaQueryProvider>
            </StrictMode>,
        );

        expect(await screen.findByText('Access denied')).toBeInTheDocument();
        expect(screen.getByText(/server blocked the request/i)).toBeInTheDocument();
        await waitFor(() => expect(apiClient).toHaveBeenCalledTimes(1));
        expect(apiClient).toHaveBeenCalledWith(
            '/api/ottaorm/users?page=1&perPage=10',
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
        expect(errorReporter).toHaveBeenCalledTimes(1);
        expect(errorReporter).toHaveBeenCalledWith(forbidden, {
            source: 'query',
            meta: undefined,
        });
    });

    it('returns an async submission promise that settles with the create mutation', async () => {
        let resolveCreate!: (record: Record<string, unknown>) => void;
        const pendingCreate = new Promise<Record<string, unknown>>((resolve) => {
            resolveCreate = resolve;
        });
        const createdUser = { id: 'user-1' };
        const apiClient = vi
            .fn()
            .mockResolvedValueOnce({ data: [], total: 0, page: 1, perPage: 10, totalPages: 1 })
            .mockReturnValueOnce(pendingCreate)
            .mockResolvedValue(createdUser);

        render(
            <OttaQueryProvider apiClient={apiClient} visibilityScope={visibilityScope}>
                <ModelCrud config={usersConfig} />
            </OttaQueryProvider>,
        );

        await screen.findByText('Users table');
        fireEvent.click(screen.getByRole('button', { name: 'Add user' }));
        expect(await screen.findByText('User form')).toBeInTheDocument();

        const formProps = modelFormSpy.mock.calls.at(-1)?.[0];
        expect(formProps?.onSubmit).toBeTypeOf('function');
        const submission = formProps!.onSubmit!({});
        let settled = false;
        void submission.then(() => {
            settled = true;
        });

        await waitFor(() => expect(apiClient).toHaveBeenCalledTimes(2));
        expect(settled).toBe(false);

        await act(async () => {
            resolveCreate(createdUser);
            await submission;
        });
        expect(settled).toBe(true);
    });
});
