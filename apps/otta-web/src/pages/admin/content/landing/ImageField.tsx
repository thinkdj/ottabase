// An image value for landing content: pick from (or upload to) the media library, or use an
// address. Uploads are stored as /api/upload/file/<key>, which the landing site serves too.

import { MediaLibraryBrowser } from '@/components/media-library/MediaLibraryBrowser';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from '@ottabase/ui-shadcn';
import { ImageIcon, Link2 } from 'lucide-react';
import { useState, type ComponentProps } from 'react';

type ImageFieldProps = {
    id: string;
    value: string;
    /** `alt` is the media library's description of the picked image, when it has one. */
    onChange: (url: string, alt?: string) => void;
    label: string;
} & Pick<ComponentProps<typeof Input>, 'aria-invalid' | 'aria-describedby' | 'aria-required'>;

/** "logo-1760…-x1y2.png" from "/api/upload/file/logo-1760…-x1y2.png?v=2" — what the person recognises. */
function fileName(url: string): string {
    const last = url.split('?')[0].split('/').pop() || url;
    try {
        return decodeURIComponent(last);
    } catch {
        return last; // a stray % in a pasted address must not break the form
    }
}

export function ImageField({ id, value, onChange, label, ...aria }: ImageFieldProps) {
    const [picking, setPicking] = useState(false);
    const noun = label.toLowerCase();
    // An address someone typed stays editable; uploads only need the picker.
    const [byUrl, setByUrl] = useState(() => Boolean(value) && !value.startsWith('/api/upload/file/'));

    return (
        <div className="space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <button
                    type="button"
                    onClick={() => setPicking(true)}
                    // A bigger click target for the button beside it; one control is enough for keyboards and screen readers.
                    tabIndex={-1}
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:10px_10px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {value ? (
                        <img src={value} alt="" className="h-full w-full object-contain" />
                    ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                </button>
                <span className={`min-w-0 flex-1 truncate text-sm ${value ? '' : 'text-muted-foreground'}`}>
                    {value ? fileName(value) : 'No image'}
                </span>
                <div className="flex shrink-0 items-center">
                    {/* Carries the field's id while the address input is hidden, so its <label> still points
                        somewhere. aria-label keeps the action in the name (the label alone would say just "Logo"). */}
                    <Button
                        id={byUrl ? undefined : id}
                        {...(byUrl ? {} : aria)}
                        aria-label={value ? `Replace ${noun}` : `Choose ${noun}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPicking(true)}
                    >
                        {value ? 'Replace' : `Choose ${noun}`}
                    </Button>
                    {value && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${noun}`}
                            onClick={() => onChange('')}
                        >
                            Remove
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        aria-pressed={byUrl}
                        aria-label="Use an image address"
                        title="Use an image address"
                        onClick={() => setByUrl((v) => !v)}
                    >
                        <Link2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            {byUrl && (
                <Input
                    id={id}
                    {...aria}
                    inputMode="url"
                    placeholder="https://… or /path"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
            <Dialog open={picking} onOpenChange={setPicking}>
                <DialogContent className="max-h-[95vh] max-w-6xl overflow-y-auto">
                    <DialogTitle className="sr-only">{label}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Pick an image from your library, or upload a new one.
                    </DialogDescription>
                    <MediaLibraryBrowser
                        title={label}
                        description="Pick an image from your library, or upload a new one."
                        emptyTitle="No images yet"
                        emptyDescription="Upload one here and it is ready to use."
                        acceptKinds={['image']}
                        mode="picker"
                        allowDelete={false}
                        confirmLabel="Use this image"
                        onSelectItem={(item) => {
                            onChange(item.url, item.alt ?? undefined);
                            setPicking(false);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
