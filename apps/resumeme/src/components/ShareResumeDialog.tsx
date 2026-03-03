import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Switch,
} from '@ottabase/ui-shadcn';
import { IconCheck, IconCopy, IconExternalLink, IconLink, IconLoader2 } from '@tabler/icons-react';
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
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shareEnabled, setShareEnabled] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open) {
            // Reset state when dialog closes
            setShareUrl(null);
            setLoading(false);
            setToggling(false);
            setError(null);
            setShareEnabled(true);
            setCopied(false);
            return;
        }

        // Load share state when dialog opens
        setLoading(true);
        setError(null);

        fetch(`/api/resume/share?resumeId=${encodeURIComponent(resumeId)}`, {
            method: 'GET',
        })
            .then(async (res) => {
                const json = (await res.json()) as {
                    error?: { message?: string };
                    data?: { shareUrl?: string; shareEnabled?: boolean };
                };
                if (!res.ok) throw new Error(json?.error?.message || 'Failed to load share settings');

                setShareUrl(json.data?.shareUrl ?? null);
                setShareEnabled(json.data?.shareEnabled ?? true);
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

    const handleToggle = useCallback(
        (enabled: boolean) => {
            setToggling(true);
            setError(null);

            fetch('/api/resume/share', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resumeId, shareEnabled: enabled }),
            })
                .then(async (res) => {
                    const json = (await res.json()) as {
                        error?: { message?: string };
                        data?: { shareEnabled?: boolean; shareUrl?: string };
                    };
                    if (!res.ok) throw new Error(json?.error?.message || 'Failed to update sharing');

                    setShareEnabled(json.data?.shareEnabled ?? enabled);
                    if (json.data?.shareUrl) setShareUrl(json.data.shareUrl);

                    toast.success(enabled ? 'Sharing enabled' : 'Sharing disabled');
                })
                .catch((err) => setError(err.message))
                .finally(() => setToggling(false));
        },
        [resumeId],
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconLink className="h-5 w-5" />
                        Share Resume
                    </DialogTitle>
                    <DialogDescription className="space-y-1">
                        <span>Anyone with this link can view — no sign-in required when sharing is on.</span>
                        <div className="text-foreground/80">
                            Resume: <strong>{resumeName}</strong>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-3">
                    {loading && (
                        <div className="flex items-center justify-center py-6">
                            <IconLoader2 className="h-5 w-5 animate-spin text-gray-400" />
                            <span className="ml-2 text-sm text-gray-500">Loading share settings…</span>
                        </div>
                    )}

                    {error && (
                        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    {!loading && (
                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                            <div>
                                <div className="text-sm font-medium">Public sharing</div>
                                <div className="text-xs text-muted-foreground">Turn off to hide the public link.</div>
                            </div>
                            <Switch
                                checked={shareEnabled}
                                disabled={toggling}
                                onCheckedChange={handleToggle}
                                aria-label="Toggle resume sharing"
                            />
                        </div>
                    )}

                    {shareUrl && !loading && (
                        <div className="flex items-center gap-2">
                            <Input value={shareUrl} readOnly className="flex-1 text-sm" />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
                                title="Open link in new tab"
                            >
                                <IconExternalLink className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={handleCopy} title="Copy link">
                                {copied ? (
                                    <IconCheck className="h-4 w-4 text-green-600" />
                                ) : (
                                    <IconCopy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    )}

                    {!loading && shareUrl && !shareEnabled && (
                        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            Sharing is currently disabled. The link stays private, but you can still preview or copy it.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
