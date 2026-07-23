import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api } = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('@/lib/api', () => ({
    api,
    isApiError: () => false,
}));

vi.mock('@ottabase/email', () => ({
    listEmailTemplates: () => ['default'],
}));

vi.mock('lucide-react', () => ({
    AlertCircle: () => null,
    Mail: () => null,
}));

vi.mock('@ottabase/ui-shadcn', () => ({
    Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button {...props}>{children}</button>
    ),
    Card: ({ children }: { children: ReactNode }) => <section>{children}</section>,
    CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
    Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
    Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SelectValue: () => null,
    Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

import { AdminEmailPage } from '../EmailPage';

describe('AdminEmailPage', () => {
    beforeEach(() => {
        api.mockReset();
        api.mockResolvedValueOnce({}).mockResolvedValueOnce({ results: [] });
    });

    it('passes an object body to the API client so it is serialized exactly once', async () => {
        render(<AdminEmailPage />);

        fireEvent.change(screen.getByLabelText('Recipients'), {
            target: { value: 'first@example.com, second@example.com' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Send test email' }));

        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/email/test', {
                method: 'POST',
                body: {
                    recipients: ['first@example.com', 'second@example.com'],
                    template: 'default',
                    subject: 'Ottabase test email',
                    provider: 'auto',
                },
            }),
        );
    });
});
