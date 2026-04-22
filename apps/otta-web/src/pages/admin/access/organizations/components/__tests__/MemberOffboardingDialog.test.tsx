/**
 * Tests for MemberOffboardingDialog component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemberOffboardingDialog } from '../MemberOffboardingDialog';
import type { OrganizationMemberRecord } from '@/types/rbac';

const mockMember: OrganizationMemberRecord = {
    id: 'member-123',
    userId: 'user-123',
    organizationId: 'org-123',
    role: 'member',
    status: 'active',
    invitedBy: null,
    invitedAt: null,
    joinedAt: Date.now(),
    metadata: null,
    user: {
        id: 'user-123',
        email: 'john.doe@example.com',
        name: 'John Doe',
    },
};

describe('MemberOffboardingDialog', () => {
    it('should render member information correctly', () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <MemberOffboardingDialog
                open={true}
                onOpenChange={onOpenChange}
                member={mockMember}
                onConfirm={onConfirm}
            />,
        );

        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
        expect(screen.getByText('member')).toBeInTheDocument();
    });

    it('should disable confirm button when confirmation text does not match', () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <MemberOffboardingDialog
                open={true}
                onOpenChange={onOpenChange}
                member={mockMember}
                onConfirm={onConfirm}
            />,
        );

        const confirmButton = screen.getByRole('button', { name: /remove member/i });
        expect(confirmButton).toBeDisabled();
    });

    it('should enable confirm button when confirmation text matches member name', async () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <MemberOffboardingDialog
                open={true}
                onOpenChange={onOpenChange}
                member={mockMember}
                onConfirm={onConfirm}
            />,
        );

        const input = screen.getByPlaceholderText(/Type "John Doe" to confirm/i);
        fireEvent.change(input, { target: { value: 'John Doe' } });

        await waitFor(() => {
            const confirmButton = screen.getByRole('button', { name: /remove member/i });
            expect(confirmButton).not.toBeDisabled();
        });
    });

    it('should call onConfirm with correct options when confirmed', async () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <MemberOffboardingDialog
                open={true}
                onOpenChange={onOpenChange}
                member={mockMember}
                onConfirm={onConfirm}
            />,
        );

        // Type confirmation
        const input = screen.getByPlaceholderText(/Type "John Doe" to confirm/i);
        fireEvent.change(input, { target: { value: 'John Doe' } });

        // Select a reason
        const reasonSelect = screen.getByRole('combobox');
        fireEvent.click(reasonSelect);
        const leftCompanyOption = await screen.findByText('Left the company');
        fireEvent.click(leftCompanyOption);

        // Click confirm
        const confirmButton = screen.getByRole('button', { name: /remove member/i });
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledWith({
                reason: 'left_company',
                notifyMember: true, // default is true
            });
        });
    });

    it('should handle notification toggle correctly', async () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <MemberOffboardingDialog
                open={true}
                onOpenChange={onOpenChange}
                member={mockMember}
                onConfirm={onConfirm}
            />,
        );

        // Uncheck notification
        const notifyCheckbox = screen.getByRole('checkbox', { name: /send notification email/i });
        fireEvent.click(notifyCheckbox);

        // Type confirmation
        const input = screen.getByPlaceholderText(/Type "John Doe" to confirm/i);
        fireEvent.change(input, { target: { value: 'John Doe' } });

        // Click confirm
        const confirmButton = screen.getByRole('button', { name: /remove member/i });
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledWith({
                reason: undefined,
                notifyMember: false,
            });
        });
    });

    it('should not render when member is null', () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();

        const { container } = render(
            <MemberOffboardingDialog
                open={true}
                onOpenChange={onOpenChange}
                member={null}
                onConfirm={onConfirm}
            />,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should show pending state when isPending is true', () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <MemberOffboardingDialog
                open={true}
                onOpenChange={onOpenChange}
                member={mockMember}
                onConfirm={onConfirm}
                isPending={true}
            />,
        );

        const confirmButton = screen.getByRole('button', { name: /removing/i });
        expect(confirmButton).toBeDisabled();
    });
});
