import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '../index';

describe('ConfirmDialog', () => {
    it('renders dialog copy and uses destructive tone classes', () => {
        render(
            <ConfirmDialog
                open
                onOpenChange={vi.fn()}
                title="Delete post?"
                description="This action cannot be undone."
                tone="destructive"
                confirmLabel="Delete"
            />,
        );

        const confirmButton = screen.getByRole('button', { name: 'Delete' });
        expect(screen.getByText('Delete post?')).toBeTruthy();
        expect(screen.getByText('This action cannot be undone.')).toBeTruthy();
        expect(confirmButton.className).toContain('bg-destructive');
    });

    it('uses default tone classes and forwards basic button props', () => {
        const onConfirm = vi.fn();

        render(
            <ConfirmDialog
                open
                onOpenChange={vi.fn()}
                title="Publish changes?"
                description="Confirm publishing the latest edits."
                confirmLabel="Publish"
                onConfirm={onConfirm}
                confirmProps={{ disabled: true, 'data-testid': 'confirm-action' }}
            />,
        );

        const confirmButton = screen.getByTestId('confirm-action');
        confirmButton.click();

        expect(confirmButton.className).toContain('bg-primary');
        expect(confirmButton).toBeDisabled();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('uses unsaved-changes defaults and renders the leave action first', () => {
        render(
            <ConfirmDialog
                open
                onOpenChange={vi.fn()}
                title="Unsaved changes"
                description="You have unsaved changes that will be lost if you leave this page."
                tone="unsaved-changes"
            />,
        );

        const buttons = screen.getAllByRole('button');

        expect(buttons[0].textContent).toBe('Leave without saving');
        expect(buttons[1].textContent).toBe('Stay and keep editing');
        expect(buttons[0].className).toContain('bg-destructive');
    });

    it('lets primary and secondary action text override the default labels', () => {
        render(
            <ConfirmDialog
                open
                onOpenChange={vi.fn()}
                title="Custom actions"
                description="Choose one of the custom actions."
                primaryActionText="Proceed now"
                secondaryActionText="Not yet"
            />,
        );

        expect(screen.getByRole('button', { name: 'Proceed now' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Not yet' })).toBeTruthy();
    });

    it('renders an optional trigger', () => {
        render(<ConfirmDialog title="Triggered dialog" trigger={<button type="button">Open dialog</button>} />);

        expect(screen.getByRole('button', { name: 'Open dialog' })).toBeTruthy();
    });

    it('opens and closes when using the optional trigger in uncontrolled mode', async () => {
        render(
            <ConfirmDialog
                title="Triggered dialog"
                description="Dialog opened from trigger"
                trigger={<button type="button">Open dialog</button>}
            />,
        );

        expect(screen.queryByText('Dialog opened from trigger')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
        expect(screen.getByText('Dialog opened from trigger')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => {
            expect(screen.queryByText('Dialog opened from trigger')).toBeNull();
        });
    });

    it('emits onOpenChange when trigger is used in controlled mode', () => {
        const onOpenChange = vi.fn();

        render(
            <ConfirmDialog
                open={false}
                onOpenChange={onOpenChange}
                title="Controlled dialog"
                trigger={<button type="button">Open controlled dialog</button>}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Open controlled dialog' }));
        expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('supports visually hidden titles for accessibility', () => {
        render(
            <ConfirmDialog
                open
                onOpenChange={vi.fn()}
                title="Delete media item"
                hideTitle
                description="This permanently removes the media file."
            />,
        );

        const hiddenTitle = screen.getByText('Delete media item');
        expect(hiddenTitle.className).toContain('sr-only');
        expect(screen.getByText('This permanently removes the media file.')).toBeTruthy();
    });

    it('renders an accessible fallback title when title is omitted', () => {
        render(
            <ConfirmDialog
                open
                onOpenChange={vi.fn()}
                a11yTitle="Confirm media deletion"
                description="Continue to remove this item."
            />,
        );

        const fallbackTitle = screen.getByText('Confirm media deletion');
        expect(fallbackTitle.className).toContain('sr-only');
        expect(screen.getByText('Continue to remove this item.')).toBeTruthy();
    });
});
