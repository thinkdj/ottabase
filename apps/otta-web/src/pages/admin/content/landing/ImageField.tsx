// An image value for landing content: pick from (or upload to) the media library, or use an
// address. A pick is stored as its `StoredFile`, never a URL: the URLs are built at render time
// on the public files base, which the landing site serves from the same bucket. An address
// someone types is kept as the trimmed string.

import { MediaLibraryBrowser } from '@/components/media-library/MediaLibraryBrowser';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from '@ottabase/ui';
import { fileUrl, type FileSource } from '@ottabase/utils/media';
import { ImageIcon, Link2 } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { toast } from 'sonner';

type ImageFieldProps = {
    id: string;
    value: FileSource | undefined;
    /** `alt` is the media library's description of the picked image, when it has one. */
    onChange: (value: FileSource, alt?: string) => void;
    label: string;
} & Pick<ComponentProps<typeof Input>, 'aria-invalid' | 'aria-describedby' | 'aria-required'>;

/** The last path segment, e.g. "3f9a….png": what the person recognises. */
function fileName(path: string): string {
    const last = path.split('?')[0].split('/').pop() || path;
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
    const [byUrl, setByUrl] = useState(() => typeof value === 'string' && Boolean(value));
    const name = typeof value === 'string' ? value : value?.key;

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
                        <img src={fileUrl(value, 'thumb')} alt="" className="h-full w-full object-contain" />
                    ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                </button>
                <span className={`min-w-0 flex-1 truncate text-sm ${name ? '' : 'text-muted-foreground'}`}>
                    {name ? fileName(name) : 'No image'}
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
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => onChange(e.target.value.trim())}
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
                            // A private file is served only after a check, so a public page can't show it.
                            if (!item.file) {
                                toast.error('That image is private. Pick a public one.');
                                return;
                            }
                            onChange(item.file, item.alt ?? undefined);
                            setPicking(false);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
