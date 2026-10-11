// An image value for landing content: pick from (or upload to) the media library, or paste an
// address. Uploads are stored as /api/upload/file/<key>, which the landing site serves too.

import { MediaLibraryBrowser } from '@/components/media-library/MediaLibraryBrowser';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from '@ottabase/ui-shadcn';
import { ImageIcon } from 'lucide-react';
import { useState, type ComponentProps } from 'react';

type ImageFieldProps = {
    id: string;
    value: string;
    /** `alt` is the media library's description of the picked image, when it has one. */
    onChange: (url: string, alt?: string) => void;
    label: string;
} & Pick<ComponentProps<typeof Input>, 'aria-invalid' | 'aria-describedby'>;

export function ImageField({ id, value, onChange, label, ...aria }: ImageFieldProps) {
    const [picking, setPicking] = useState(false);
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]">
                    {value ? (
                        <img src={value} alt="" className="h-full w-full object-contain" />
                    ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
                        {value ? 'Replace' : 'Choose image'}
                    </Button>
                    {value && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>
                            Remove
                        </Button>
                    )}
                </div>
            </div>
            <Input
                id={id}
                {...aria}
                inputMode="url"
                placeholder="…or paste an image address"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
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
