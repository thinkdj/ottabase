import { useState, useCallback } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { IconUpload } from '@tabler/icons-react';
import { toast } from 'sonner';
import { brandApi } from './brandApi';

type LogoType = 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo';

const LOGO_LABELS: Record<LogoType, string> = {
    logo: 'Primary logo',
    'logo-dark': 'Dark mode logo',
    icon: 'Favicon / Icon',
    'og-image': 'Social share image',
    'email-logo': 'Email header logo',
};

interface LogoUploaderProps {
    logoType: LogoType;
    currentUrl?: string | null;
    onUploaded?: (url: string) => void;
    params?: { organizationId?: string | null; appId?: string | null };
}

export function LogoUploader({ logoType, currentUrl, onUploaded, params }: LogoUploaderProps) {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleUpload = useCallback(
        async (file: File) => {
            if (!file.type.startsWith('image/')) {
                toast.error('Please upload an image file');
                return;
            }
            setUploading(true);
            try {
                const res = (await brandApi.uploadLogo(logoType, file, params)) as { url?: string };
                onUploaded?.(res.url ?? '');
                toast.success(`${LOGO_LABELS[logoType]} uploaded`);
            } catch {
                toast.error('Upload failed');
            } finally {
                setUploading(false);
            }
        },
        [logoType, onUploaded, params],
    );

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleUpload(file);
        },
        [handleUpload],
    );

    const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
        e.target.value = '';
    };

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">{LOGO_LABELS[logoType]}</CardTitle>
                <CardDescription>PNG, JPG, SVG. Recommended: 200×200 for icon, 400×100 for logo.</CardDescription>
            </CardHeader>
            <CardContent>
                <div
                    onDrop={onDrop}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                        dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                    }`}
                >
                    {currentUrl ? (
                        <div className="space-y-2">
                            <img
                                src={currentUrl}
                                alt={LOGO_LABELS[logoType]}
                                className="mx-auto max-h-16 max-w-full object-contain"
                            />
                            <p className="text-xs text-muted-foreground truncate">{currentUrl}</p>
                        </div>
                    ) : (
                        <IconUpload className="mx-auto h-10 w-10 text-muted-foreground" />
                    )}
                    <div className="mt-2">
                        <input
                            id={`logo-upload-${logoType}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploading}
                            onChange={onFileInput}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploading}
                            onClick={() => document.getElementById(`logo-upload-${logoType}`)?.click()}
                        >
                            {uploading ? 'Uploading...' : 'Choose file'}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
