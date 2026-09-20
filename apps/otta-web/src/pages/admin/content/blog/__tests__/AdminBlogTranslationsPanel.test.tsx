import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
        Select: ({ children }: any) => <div>{children}</div>,
        SelectContent: ({ children }: any) => <div>{children}</div>,
        SelectItem: ({ children }: any) => <div>{children}</div>,
        SelectTrigger: ({ children, ...props }: any) => (
            <button type="button" {...props}>
                {children}
            </button>
        ),
        SelectValue: () => <span />,
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
    Eye: () => null,
}));

import { AdminBlogTranslationsPanel } from '../AdminBlogTranslationsPanel';

describe('AdminBlogTranslationsPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mutationOptions.clear();
    });

    it('keeps the header save scoped to the translation when shared settings refresh', async () => {
        const header = document.createElement('div');
        document.body.appendChild(header);
        const basePost = {
            id: 'post-1',
            language: 'en',
            title: 'Hello',
            slug: 'hello',
            excerpt: null,
            content: null,
            contentType: 'blog' as const,
            status: 'draft' as const,
        };
        const view = render(
            <AdminBlogTranslationsPanel
                postId="post-1"
                basePost={basePost}
                selectedLanguage="hi"
                actionsTarget={header}
            />,
        );
        try {
            const save = await within(header).findByRole('button', { name: /save translation/i });
            expect(within(view.container).queryByRole('button', { name: /save translation/i })).toBeNull();
            fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My translation draft' } });
            view.rerender(
                <AdminBlogTranslationsPanel
                    postId="post-1"
                    basePost={{ ...basePost, title: 'Updated original', excerpt: 'Updated summary' }}
                    selectedLanguage="hi"
                    actionsTarget={header}
                />,
            );
            expect(screen.getByLabelText('Title')).toHaveValue('My translation draft');
            fireEvent.click(save);
            await waitFor(() =>
                expect(mutateAsync).toHaveBeenCalledWith(
                    expect.objectContaining({
                        language: 'hi',
                        title: 'My translation draft',
                        slug: 'hello-hi',
                        status: 'draft',
                    }),
                ),
            );
        } finally {
            view.unmount();
            header.remove();
        }
    });

    it('uses the workspace language and reports unsaved edits to the page guard', async () => {
        const onDirtyChange = vi.fn();
        render(
            <AdminBlogTranslationsPanel
                postId="post-1"
                selectedLanguage="hi"
                onDirtyChange={onDirtyChange}
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
        expect(await screen.findByText('Add Hindi translation')).toBeTruthy();
        expect(screen.queryByLabelText('Language')).toBeNull();
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Hindi draft' } });
        await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
        fireEvent.click(screen.getByRole('button', { name: /save translation/i }));
        await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ language: 'hi' })));
        await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
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

    it('keeps the original slug as a fixed prefix while allowing a custom suffix', async () => {
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

        expect(await screen.findByLabelText('Translation slug suffix')).toHaveValue('ml');
        fireEvent.change(screen.getByLabelText('Translation slug suffix'), { target: { value: 'malayalam' } });
        fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Malayalam title' } });
        fireEvent.click(screen.getByRole('button', { name: /save translation/i }));

        await waitFor(() =>
            expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ slug: 'hello-malayalam' })),
        );
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
