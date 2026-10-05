import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationSettings } from '../NotificationSettings';

const apiClient = vi.fn();
const scope = { appId: 'app', organizationId: null, principalId: 'u1' };

describe('NotificationSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        let comments = true;
        apiClient.mockImplementation(async (_url: string, options?: { method?: string; body?: unknown }) => {
            if (options?.method === 'PUT') {
                comments = (options.body as { categories: { comments: boolean } }).categories.comments;
            }
            return {
                categories: {
                    comments: { label: 'Replies to your comments', enabled: comments },
                    organizations: { label: 'Changes to your organizations', enabled: true },
                },
            };
        });
    });

    it('shows each kind with its switch and saves a change', async () => {
        render(
            <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
                <NotificationSettings />
            </OttaQueryProvider>,
        );
        const replies = await screen.findByRole('switch', { name: 'Replies to your comments' });
        expect(replies).toBeChecked();
        fireEvent.click(replies);
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/notifications/preferences',
                expect.objectContaining({ method: 'PUT', body: { categories: { comments: false } } }),
            ),
        );
        await waitFor(() => expect(screen.getByRole('switch', { name: 'Replies to your comments' })).not.toBeChecked());
    });
});
