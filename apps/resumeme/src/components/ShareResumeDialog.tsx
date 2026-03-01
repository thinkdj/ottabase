import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
} from '@ottabase/ui-shadcn';
import { IconCheck, IconCopy, IconLink, IconLoader2 } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ShareResumeDialogProps {
    resumeId: string;
    resumeName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ShareResumeDialog({ resumeId, resumeName, open, onOpenChange }: ShareResumeDialogProps) {
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open) {
            // Reset state when dialog closes
            setShareUrl(null);
            setLoading(false);
            setError(null);
            setCopied(false);
            return;
        }

        // Create share link when dialog opens
        setLoading(true);
        setError(null);

        fetch('/api/resume/share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumeId }),
        })
            .then(async (res) => {
                const json = (await res.json()) as { error?: { message?: string }; data?: { shortCode?: string } };
                if (!res.ok) throw new Error(json?.error?.message || 'Failed to create share link');
                // Build the share URL from the shortCode
                const shortCode = json.data?.shortCode;
                if (shortCode) {
                    setShareUrl(`${window.location.origin}/r/${shortCode}`);
                } else {
                    throw new Error('No short code returned');
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [open, resumeId]);

    const handleCopy = useCallback(() => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopied(true);
            toast.success('Link copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        });
    }, [shareUrl]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconLink className="h-5 w-5" />
                        Share Resume
                    </DialogTitle>
                    <DialogDescription>
                        Anyone with this link can view <strong>{resumeName}</strong> — no sign-in required.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-3">
                    {loading && (
                        <div className="flex items-center justify-center py-6">
                            <IconLoader2 className="h-5 w-5 animate-spin text-gray-400" />
                            <span className="ml-2 text-sm text-gray-500">Creating share link…</span>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    {shareUrl && !loading && (
                        <div className="flex items-center gap-2">
                            <Input value={shareUrl} readOnly className="flex-1 text-sm" />
                            <Button variant="outline" size="icon" onClick={handleCopy} title="Copy link">
                                {copied ? (
                                    <IconCheck className="h-4 w-4 text-green-600" />
                                ) : (
                                    <IconCopy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
