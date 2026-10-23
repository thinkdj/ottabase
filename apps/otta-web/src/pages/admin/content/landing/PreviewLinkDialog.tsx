// "Share preview": a private link to a draft on the live site, for teammates or a client to see
// before it is published. Anyone with the link can view the draft until the link is reset.

import { getErrorMessage } from '@/lib/api';
import type { SiteSettings } from '@ottabase/ottalanding';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
} from '@ottabase/ui';
import { useMutation } from '@tanstack/react-query';
import { Copy, Link2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { landingApi, publicUrl } from './landingApi';

export function PreviewLinkDialog({ site, pageId, path }: { site: SiteSettings; pageId: string; path: string }) {
    const [open, setOpen] = useState(false);
    const base = publicUrl(site, path);
    const token = useMutation({
        mutationFn: (reset: boolean) => landingApi.previewToken(pageId, reset),
        onSuccess: (_data, reset) => reset && toast.success('New link created. The old one no longer works.'),
        onError: (err) => toast.error(getErrorMessage(err)),
    });
    const link = base && token.data ? `${base}?preview=${token.data.token}` : undefined;

    const copy = async () => {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            toast.success('Preview link copied');
        } catch {
            toast.error('Couldn’t copy. Select the link and copy it instead.');
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button
                type="button"
                variant="outline"
                onClick={() => {
                    setOpen(true);
                    if (base && !token.data) token.mutate(false);
                }}
            >
                <Link2 className="mr-2 h-4 w-4" aria-hidden />
                Share preview
            </Button>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share a preview</DialogTitle>
                    <DialogDescription>
                        Anyone with this link can see the saved draft on the live site, marked as a preview and hidden
                        from search engines. Unsaved changes aren’t included.
                    </DialogDescription>
                </DialogHeader>
                {base ? (
                    <div className="space-y-1.5">
                        <Label htmlFor="preview-link">Preview link</Label>
                        <div className="flex gap-2">
                            <Input
                                id="preview-link"
                                readOnly
                                value={link ?? 'Creating link…'}
                                onFocus={(e) => e.currentTarget.select()}
                            />
                            <Button type="button" onClick={copy} disabled={!link} aria-label="Copy preview link">
                                <Copy className="h-4 w-4" aria-hidden />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                        Set the site’s <strong>Public URL</strong> in the site settings first, so the link can point at
                        your live site.
                    </p>
                )}
                <DialogFooter className="gap-2 sm:justify-between">
                    {base && (
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={token.isPending}
                            onClick={() => token.mutate(true)}
                        >
                            Reset link
                        </Button>
                    )}
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
