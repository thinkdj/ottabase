import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { editorSave, mutateAsync, mutationOptions } = vi.hoisted(() => ({
    editorSave: vi.fn(async () => ({ blocks: [] })),
    mutateAsync: vi.fn(async () => ({})),
    mutationOptions: new Map<string, any>(),
}));

vi.mock('@ottabase/ottaeditor', () => ({
    useOttaEditor: () => ({ editorRef: { current: null }, save: editorSave, hasUnsavedChanges: false }),
}));

vi.mock('@ottabase/ottaorm/client', () => ({
    useApiQuery: () => ({
        data: {
            baseLanguage: 'en',
            languageConfig: {
                defaultLanguage: 'en',
                supportedLanguages: [
                    { code: 'en', name: 'English' },
                    { code: 'ml', name: 'Malayalam' },
                    { code: 'hi', name: 'Hindi' },
                ],
                fallbackToDefault: true,
            },
            translations: [],
        },
        isLoading: false,
        isError: false,
    }),
    useApiMutation: (options: any) => {
        mutationOptions.set(options.endpoint, options);
        return { mutateAsync, isPending: false };
    },
}));

vi.mock('@ottabase/ui-shadcn', () => {
    const Box = ({ children, ...props }: any) => <div {...props}>{children}</div>;
    return {
        AlertDialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
        AlertDialogAction: (props: any) => <button {...props} />,
        AlertDialogCancel: (props: any) => <button {...props} />,
        AlertDialogContent: ({ children, ...props }: any) => (
            <div role="dialog" {...props}>
                {children}
            </div>
        ),
        AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
        AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
        AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
        AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
        buttonVariants: () => '',
        Button: (props: any) => <button {...props} />,
        Card: Box,
        CardContent: Box,
        CardDescription: Box,
        CardHeader: Box,
        CardTitle: Box,
        Input: (props: any) => <input {...props} />,
        Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
        NativeSelect: (props: any) => <select {...props} />,
        NativeSelectOption: (props: any) => <option {...props} />,
        Textarea: (props: any) => <textarea {...props} />,
        cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
    };
});

vi.mock('@ottabase/ui-components', () => ({
    ConfirmDialog: ({ open, title, description, primaryActionText, secondaryActionText, onConfirm, onCancel }: any) =>
        open ? (
            <div role="dialog">
                <h2>{title}</h2>
                <p>{description}</p>
                <button onClick={onConfirm}>{primaryActionText}</button>
                <button onClick={onCancel}>{secondaryActionText}</button>
            </div>
        ) : null,
}));

vi.mock('lucide-react', () => ({
    Languages: () => null,
    Loader2: () => null,
    Save: () => null,
    Trash2: () => null,
}));

import { AdminBlogTranslationsPanel } from '../AdminBlogTranslationsPanel';

describe('AdminBlogTranslationsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mutationOptions.clear();
    });

    it('includes the selected language when creating a translation', async () => {
        render(
            <AdminBlogTranslationsPanel
                postId="post-1"
                basePost={{
                    id: 'post-1',
                    language: 'en',
                    title: 'Hello',
                    slug: 'hello',
                    excerpt: null,
                    content: null,
                    contentType: 'blog',
                    status: 'draft',
                }}
            />,
        );

        const saveButton = await screen.findByRole('button', { name: /save translation/i });
        expect(saveButton).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Edited title' } });
        await waitFor(() => expect(saveButton).toBeEnabled());
        fireEvent.click(saveButton);

        await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
        expect(mutateAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                language: 'ml',
                title: 'Edited title',
                slug: 'hello-ml',
            }),
        );
        expect(mutationOptions.get('/api/blog/posts/post-1/translations')?.method).toBe('POST');
        expect(mutationOptions.get('/api/blog/posts/post-1/translations')?.invalidateEntities).toEqual([
            'blog_translations',
            'blog_translation_detail',
        ]);
        await waitFor(() => expect(saveButton).toBeDisabled());
    });

    it('asks before switching languages when the current translation is dirty', async () => {
        render(
            <AdminBlogTranslationsPanel
                postId="post-1"
                basePost={{
                    id: 'post-1',
                    language: 'en',
                    title: 'Hello',
                    slug: 'hello',
                    excerpt: null,
                    content: null,
                    contentType: 'blog',
                    status: 'draft',
                }}
            />,
        );

        await waitFor(() => expect(screen.getByRole('button', { name: /save translation/i })).toBeTruthy());
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Edited Malayalam title' } });
        fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'hi' } });

        expect(await screen.findByRole('dialog')).toBeTruthy();
        expect(screen.getByRole('button', { name: /stay and keep editing/i })).toBeTruthy();
        expect(screen.getByLabelText('Language')).toHaveValue('ml');

        fireEvent.click(screen.getByRole('button', { name: /leave without saving/i }));
        await waitFor(() => expect(screen.getByLabelText('Language')).toHaveValue('hi'));
    });
});
