/**
 * Enhanced Member Offboarding Dialog
 *
 * Provides a comprehensive offboarding experience with:
 * - Member information display
 * - Reason selection
 * - Confirmation via typing member name
 * - Email notification option
 */

import type { OrganizationMemberRecord } from '@/types/rbac';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Checkbox,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@ottabase/ui-shadcn';
import { AlertTriangle, Mail, User as UserIcon } from 'lucide-react';
import { useState } from 'react';

export interface MemberOffboardingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: OrganizationMemberRecord | null;
    onConfirm: (options: { reason?: string; notifyMember: boolean }) => void;
    isPending?: boolean;
}

const OFFBOARDING_REASONS = [
    { value: 'left_company', label: 'Left the company' },
    { value: 'role_change', label: 'Role change' },
    { value: 'contract_ended', label: 'Contract ended' },
    { value: 'security_concern', label: 'Security concern' },
    { value: 'duplicate_account', label: 'Duplicate account' },
    { value: 'other', label: 'Other reason' },
] as const;

export function MemberOffboardingDialog({
    open,
    onOpenChange,
    member,
    onConfirm,
    isPending = false,
}: MemberOffboardingDialogProps) {
    const [confirmationText, setConfirmationText] = useState('');
    const [reason, setReason] = useState<string>('');
    const [notifyMember, setNotifyMember] = useState(true);

    const memberName = member?.user?.name || 'Unknown user';
    const memberEmail = member?.user?.email || member?.userId || '';
    const isConfirmationValid = confirmationText.trim().toLowerCase() === memberName.trim().toLowerCase();

    const handleConfirm = () => {
        if (!isConfirmationValid) return;
        onConfirm({ reason: reason || undefined, notifyMember });
        handleReset();
    };

    const handleCancel = () => {
        handleReset();
        onOpenChange(false);
    };

    const handleReset = () => {
        setConfirmationText('');
        setReason('');
        setNotifyMember(true);
    };

    if (!member) return null;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive dark:text-red-400">
                        <AlertTriangle className="h-5 w-5" />
                        Remove Member from Organization
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4 pt-2">
                        <div className="rounded-md border border-border bg-muted/50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground dark:text-slate-200">
                                <UserIcon className="h-4 w-4 text-muted-foreground" />
                                Member Details
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground dark:text-slate-400">Name:</span>
                                    <span className="font-medium dark:text-slate-200">{memberName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground dark:text-slate-400">Email:</span>
                                    <span className="font-medium dark:text-slate-200">{memberEmail}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground dark:text-slate-400">Role:</span>
                                    <span className="capitalize font-medium dark:text-slate-200">{member.role}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm">
                            <p className="font-medium text-foreground dark:text-slate-200">
                                This action will immediately:
                            </p>
                            <ul className="ml-4 list-disc space-y-1 text-muted-foreground dark:text-slate-400">
                                <li>Remove all access to this organization</li>
                                <li>Revoke all assigned permissions and roles</li>
                                <li>Remove from all organization resources</li>
                                <li>This action cannot be undone</li>
                            </ul>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">Reason for removal (optional)</Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger id="reason" className="dark:border-slate-700">
                                <SelectValue placeholder="Select a reason..." />
                            </SelectTrigger>
                            <SelectContent>
                                {OFFBOARDING_REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="notify-member"
                            checked={notifyMember}
                            onCheckedChange={(checked) => setNotifyMember(checked === true)}
                        />
                        <Label
                            htmlFor="notify-member"
                            className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                        >
                            <Mail className="h-4 w-4" />
                            Send notification email to member
                        </Label>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmation">
                            Type <span className="font-semibold">{memberName}</span> to confirm
                        </Label>
                        <Input
                            id="confirmation"
                            value={confirmationText}
                            onChange={(e) => setConfirmationText(e.target.value)}
                            placeholder={`Type "${memberName}" to confirm`}
                            className="dark:border-slate-700"
                            disabled={isPending}
                            autoComplete="off"
                        />
                    </div>
                </div>

                <AlertDialogFooter>
                    <Button variant="outline" onClick={handleCancel} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleConfirm} disabled={!isConfirmationValid || isPending}>
                        {isPending ? 'Removing...' : 'Remove Member'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
