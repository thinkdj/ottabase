import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@ottabase/ui-shadcn';
import { IconUpload } from '@tabler/icons-react';
import { toast } from 'sonner';
import { brandKitApi } from './brandApi';

type LogoType = 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo';

const LOGO_LABELS: Record<LogoType, string> = {
    logo: 'Primary logo',
    'logo-dark': 'Dark mode logo',
    icon: 'Favicon / Icon',
    'og-image': 'Social share image',
    'email-logo': 'Email header logo',
};

const LOGO_KEYS: Record<LogoType, 'logoKey' | 'logoDarkKey' | 'iconKey' | 'ogImageKey' | 'emailLogoKey'> = {
    logo: 'logoKey',
    'logo-dark': 'logoDarkKey',
    icon: 'iconKey',
    'og-image': 'ogImageKey',
    'email-logo': 'emailLogoKey',
};

interface BrandKitLogoTabProps {
    kitId: string;
    logos: {
        logoKey?: string | null;
        logoDarkKey?: string | null;
        iconKey?: string | null;
        ogImageKey?: string | null;
        emailLogoKey?: string | null;
    };
    /** Base URL for R2 assets (e.g. https://pub-xxx.r2.dev). Logos shown as base + key. */
    logoBaseUrl?: string;
    onUploaded: (logoType: LogoType, url: string) => void;
}

function getLogoUrl(key: string | null | undefined, base: string): string | undefined {
    if (!key) return undefined;
    if (!base) return undefined;
    return `${base.replace(/\/$/, '')}/${key}`;
}

export function BrandKitLogoTab({ kitId, logos, logoBaseUrl = '', onUploaded }: BrandKitLogoTabProps) {
    const [uploading, setUploading] = useState<LogoType | null>(null);

    const handleUpload = useCallback(
        async (logoType: LogoType, file: File) => {
            if (!file.type.startsWith('image/')) {
                toast.error('Please upload an image file');
                return;
            }
            setUploading(logoType);
            try {
                const res = await brandKitApi.uploadLogo(kitId, logoType, file);
                onUploaded(logoType, res.url);
                toast.success(`${LOGO_LABELS[logoType]} uploaded`);
            } catch {
                toast.error('Upload failed');
            } finally {
                setUploading(null);
            }
        },
        [kitId, onUploaded],
    );

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(LOGO_LABELS) as LogoType[]).map((logoType) => {
                const key = LOGO_KEYS[logoType];
                const currentUrl = key ? getLogoUrl(logos[key as keyof typeof logos], logoBaseUrl) : undefined;

                return (
                    <Card key={logoType}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{LOGO_LABELS[logoType]}</CardTitle>
                            <CardDescription>PNG, JPG, SVG. Icon: 200×200. Logo: 400×100.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div
                                className="rounded-lg border-2 border-dashed p-6 text-center transition-colors border-muted-foreground/25 hover:border-primary/50"
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const f = e.dataTransfer.files[0];
                                    if (f) handleUpload(logoType, f);
                                }}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                {currentUrl ? (
                                    <div className="space-y-2">
                                        <img
                                            src={currentUrl}
                                            alt={LOGO_LABELS[logoType]}
                                            className="mx-auto max-h-16 max-w-full object-contain"
                                        />
                                    </div>
                                ) : (
                                    <IconUpload className="mx-auto h-10 w-10 text-muted-foreground" />
                                )}
                                <div className="mt-2">
                                    <input
                                        id={`logo-${logoType}`}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        disabled={!!uploading}
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) handleUpload(logoType, f);
                                            e.target.value = '';
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={!!uploading}
                                        onClick={() => document.getElementById(`logo-${logoType}`)?.click()}
                                    >
                                        {uploading === logoType ? 'Uploading...' : 'Choose file'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
