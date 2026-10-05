import { isApiError } from '@ottabase/api';
import { useApiMutation } from '@ottabase/ottaorm/client';
import { ShortlinkTypes, type ShortlinkRecord } from '@ottabase/shortlinks';
import {
    Alert,
    Button,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    toast,
} from '@ottabase/ui-shadcn';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from '@ottabase/utils/timezone';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

interface ShortlinkFormProps {
    link: ShortlinkRecord;
    onSaved: () => void;
    onCancel: () => void;
    onDelete: () => void;
}

/** The side panel editor. New links come from the paste bar on the page, so this only edits. */
export function ShortlinkForm({ link, onSaved, onCancel, onDelete }: ShortlinkFormProps) {
    const [draft, setDraft] = useState({
        fullUrl: link.fullUrl,
        shortCode: link.shortCode,
        type: link.type,
        expiryDate: toDateTimeLocalInput(link.expiryDate),
        interstitialEnabled: link.interstitialEnabled ?? false,
        interstitialSeconds: link.interstitialSeconds ?? 10,
    });
    const [error, setError] = useState<string | null>(null);
    const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
        setDraft((current) => ({ ...current, [key]: value }));

    const save = useApiMutation<unknown, Record<string, unknown>>({
        endpoint: `/api/shortlinks/${link.id}`,
        method: 'PATCH',
        invalidateEntities: ['shortlinks'],
        mutationOptions: { meta: { errorPresentation: 'local' } },
    });

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        const expiryMs = fromDateTimeLocalInput(draft.expiryDate);
        try {
            await save.mutateAsync({
                fullUrl: draft.fullUrl.trim(),
                shortCode: draft.shortCode.trim(),
                type: draft.type,
                // An absolute instant: the worker runs in UTC and would misread local wall time.
                expiryDate: expiryMs ? new Date(expiryMs).toISOString() : null,
                interstitialEnabled: draft.interstitialEnabled,
                interstitialSeconds: draft.interstitialEnabled ? draft.interstitialSeconds : null,
            });
            toast.success('Link saved');
            onSaved();
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Could not save the link');
        }
    };

    const busy = save.isPending;

    return (
        <form onSubmit={submit} className="flex flex-1 flex-col">
            <div className="space-y-5 px-6 py-5">
                {error && <Alert variant="destructive">{error}</Alert>}

                <div className="space-y-2">
                    <Label htmlFor="fullUrl">Destination</Label>
                    <Input
                        id="fullUrl"
                        type="url"
                        required
                        value={draft.fullUrl}
                        onChange={(e) => set('fullUrl', e.target.value)}
                        disabled={busy}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="shortCode">Short code</Label>
                    <Input
                        id="shortCode"
                        required
                        value={draft.shortCode}
                        onChange={(e) => set('shortCode', e.target.value)}
                        pattern="[a-zA-Z0-9_\-]{2,50}"
                        title="2 to 50 letters, numbers, hyphens or underscores"
                        className="font-mono"
                        disabled={busy}
                    />
                    <p className="text-xs text-muted-foreground">Changing it breaks copies already shared.</p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="type">Type</Label>
                        <Select value={draft.type} onValueChange={(value) => set('type', value)} disabled={busy}>
                            <SelectTrigger id="type">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(ShortlinkTypes).map((type) => (
                                    <SelectItem key={type} value={type} className="capitalize">
                                        {type}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="expiryDate">Expires</Label>
                        <Input
                            id="expiryDate"
                            type="datetime-local"
                            value={draft.expiryDate}
                            onChange={(e) => set('expiryDate', e.target.value)}
                            disabled={busy}
                        />
                        <p className="text-xs text-muted-foreground">Empty means never.</p>
                    </div>
                </div>

                <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="interstitial">Show a countdown page first</Label>
                        <Switch
                            id="interstitial"
                            checked={draft.interstitialEnabled}
                            onCheckedChange={(checked) => set('interstitialEnabled', checked)}
                            disabled={busy}
                        />
                    </div>
                    {draft.interstitialEnabled && (
                        <div className="flex items-center gap-3">
                            <Label htmlFor="interstitialSeconds" className="shrink-0">
                                Seconds
                            </Label>
                            <Input
                                id="interstitialSeconds"
                                type="number"
                                min={1}
                                max={60}
                                step={1}
                                value={draft.interstitialSeconds}
                                onChange={(e) => set('interstitialSeconds', Number(e.target.value))}
                                className="w-24"
                                disabled={busy}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-6 py-4">
                <Button type="button" variant="ghost" className="text-destructive" onClick={onDelete} disabled={busy}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </Button>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={busy}>
                        {busy ? 'Saving' : 'Save'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
