import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { IconAlertTriangle, IconLoader2, IconPhotoUp, IconTrash } from '@tabler/icons-react';
import { useCallback, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { brandKitApi } from './brandApi';

type LogoType = 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo';

type LogoField = 'logoKey' | 'logoDarkKey' | 'iconKey' | 'ogImageKey' | 'emailLogoKey';

const LOGO_KEYS: Record<LogoType, LogoField> = {
    logo: 'logoKey',
    'logo-dark': 'logoDarkKey',
    icon: 'iconKey',
    'og-image': 'ogImageKey',
    'email-logo': 'emailLogoKey',
};

/** Maps upload endpoint logo types to Brand Kit draft fields (shared with the detail page) */
export const LOGO_DRAFT_FIELDS: Record<string, LogoField | undefined> = { ...LOGO_KEYS };

interface LogoSpec {
    label: string;
    description: string;
    /** Short format/size guidance shown under the dropzone */
    spec: string;
    accept: string;
    allowSvg: boolean;
    surface: 'checker' | 'dark' | 'plain';
}

const LOGO_SPECS: Record<LogoType, LogoSpec> = {
    logo: {
        label: 'Primary logo',
        description: 'Shown in headers, navigation, and other light surfaces.',
        spec: 'SVG or transparent PNG · at least 400×100',
        accept: 'image/svg+xml,image/png,image/webp,image/jpeg',
        allowSvg: true,
        surface: 'checker',
    },
    'logo-dark': {
        label: 'Dark mode logo',
        description: 'Replaces the primary logo on dark surfaces — light artwork reads best.',
        spec: 'SVG or transparent PNG · at least 400×100',
        accept: 'image/svg+xml,image/png,image/webp,image/jpeg',
        allowSvg: true,
        surface: 'dark',
    },
    icon: {
        label: 'App icon',
        description: 'Square mark used for the favicon, browser tabs, and app lists.',
        spec: 'SVG or PNG · square, at least 512×512',
        accept: 'image/svg+xml,image/png,image/webp',
        allowSvg: true,
        surface: 'checker',
    },
    'og-image': {
        label: 'Social share image',
        description: 'Shown in link previews on social platforms and chat apps.',
        spec: 'PNG or JPG · 1200×630',
        accept: 'image/png,image/jpeg,image/webp',
        allowSvg: false,
        surface: 'plain',
    },
    'email-logo': {
        label: 'Email logo',
        description: 'Header artwork for transactional email — most clients cannot render SVG.',
        spec: 'PNG or JPG · about 400px wide',
        accept: 'image/png,image/jpeg,image/webp',
        allowSvg: false,
        surface: 'plain',
    },
};

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** Subtle checkerboard so transparent artwork edges stay visible */
const CHECKER_STYLE: CSSProperties = {
    backgroundImage:
        'conic-gradient(hsl(var(--muted)) 0 25%, transparent 0 50%, hsl(var(--muted)) 0 75%, transparent 0)',
    backgroundSize: '14px 14px',
};

interface BrandKitLogoTabProps {
    kitId: string;
    logos: Partial<Record<LogoField, string | null>>;
    /** Base URL for R2 assets (e.g. https://pub-xxx.r2.dev). Logos shown as base + key. */
    logoBaseUrl?: string;
    /** Fired after an upload (key set) or removal (key null); parent merges into its draft */
    onChanged: (logoType: LogoType, key: string | null) => void;
}

function getLogoUrl(key: string | null | undefined, base: string): string | undefined {
    if (!key || !base) return undefined;
    return `${base.replace(/\/$/, '')}/${key}`;
}

export function BrandKitLogoTab({ kitId, logos, logoBaseUrl = '', onChanged }: BrandKitLogoTabProps) {
    const [uploading, setUploading] = useState<LogoType | null>(null);
    const [removing, setRemoving] = useState<LogoType | null>(null);
    const [dragOver, setDragOver] = useState<LogoType | null>(null);
    const busy = uploading ?? removing;

    const handleUpload = useCallback(
        async (logoType: LogoType, file: File) => {
            const spec = LOGO_SPECS[logoType];
            if (!file.type.startsWith('image/')) {
                toast.error('That file is not an image', { description: spec.spec });
                return;
            }
            if (!spec.allowSvg && file.type === 'image/svg+xml') {
                toast.error(`SVG is not supported for the ${spec.label.toLowerCase()}`, { description: spec.spec });
                return;
            }
            if (file.size > MAX_LOGO_BYTES) {
                toast.error('Image is larger than 5 MB', { description: 'Compress or resize it, then try again.' });
                return;
            }
            setUploading(logoType);
            try {
                const res = await brandKitApi.uploadLogo(kitId, logoType, file);
                onChanged(logoType, res.key);
                toast.success(`${spec.label} updated`);
            } catch (error) {
                let message = 'Upload failed — please try again';
                if (error instanceof Response) {
                    const text = await error.text();
                    if (text) message = text;
                } else if (error instanceof Error && error.message) {
                    message = error.message;
                }
                toast.error(message);
            } finally {
                setUploading(null);
            }
        },
        [kitId, onChanged],
    );

    const handleRemove = useCallback(
        async (logoType: LogoType) => {
            setRemoving(logoType);
            try {
                await brandKitApi.update(kitId, { [LOGO_KEYS[logoType]]: null });
                onChanged(logoType, null);
                toast.success(`${LOGO_SPECS[logoType].label} removed`);
            } catch {
                toast.error('Could not remove the image — please try again');
            } finally {
                setRemoving(null);
            }
        },
        [kitId, onChanged],
    );

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Uploads apply to this Brand Kit immediately — no need to press Save. Prefer SVG where supported; it
                stays crisp at every size.
            </p>

            {!logoBaseUrl && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                    <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <p>
                        Previews are unavailable because no public asset URL is configured. Set{' '}
                        <code className="font-mono text-xs">R2_PUBLIC_URL</code> to display uploaded assets here.
                    </p>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(LOGO_SPECS) as LogoType[]).map((logoType) => {
                    const spec = LOGO_SPECS[logoType];
                    const currentUrl = getLogoUrl(logos[LOGO_KEYS[logoType]], logoBaseUrl);
                    const hasAsset = Boolean(logos[LOGO_KEYS[logoType]]);
                    const isBusy = busy === logoType;
                    const isDragTarget = dragOver === logoType;

                    return (
                        <Card key={logoType}>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm">{spec.label}</CardTitle>
                                <CardDescription className="text-xs leading-relaxed">
                                    {spec.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <input
                                    id={`logo-${logoType}`}
                                    type="file"
                                    accept={spec.accept}
                                    className="hidden"
                                    disabled={!!busy}
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleUpload(logoType, f);
                                        e.target.value = '';
                                    }}
                                />
                                <button
                                    type="button"
                                    disabled={!!busy}
                                    onClick={() => document.getElementById(`logo-${logoType}`)?.click()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOver(null);
                                        const f = e.dataTransfer.files[0];
                                        if (f && !busy) handleUpload(logoType, f);
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDragEnter={() => setDragOver(logoType)}
                                    onDragLeave={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                                    }}
                                    className={`relative flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        isDragTarget
                                            ? 'border-primary bg-primary/5'
                                            : hasAsset
                                              ? 'border-border'
                                              : 'border-dashed border-muted-foreground/30 hover:border-primary/50'
                                    } ${spec.surface === 'dark' ? 'bg-neutral-900' : spec.surface === 'plain' ? 'bg-muted/30' : ''}`}
                                    style={spec.surface === 'checker' ? CHECKER_STYLE : undefined}
                                    title={hasAsset ? 'Replace image' : 'Upload image'}
                                >
                                    {currentUrl ? (
                                        <img
                                            src={currentUrl}
                                            alt={spec.label}
                                            className="max-h-20 max-w-[85%] object-contain"
                                        />
                                    ) : (
                                        <span
                                            className={`flex flex-col items-center gap-1 text-xs ${
                                                spec.surface === 'dark' ? 'text-neutral-400' : 'text-muted-foreground'
                                            }`}
                                        >
                                            <IconPhotoUp className="h-6 w-6" stroke={1.5} />
                                            {hasAsset
                                                ? 'Uploaded — preview unavailable'
                                                : 'Drop image or click to browse'}
                                        </span>
                                    )}
                                    {isBusy && (
                                        <span className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-xs font-medium backdrop-blur-[1px]">
                                            <IconLoader2 className="h-4 w-4 animate-spin" />
                                            {uploading === logoType ? 'Uploading…' : 'Removing…'}
                                        </span>
                                    )}
                                </button>
                                <div className="flex min-h-7 items-center justify-between gap-2">
                                    <span className="text-[11px] text-muted-foreground">{spec.spec}</span>
                                    {hasAsset && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-muted-foreground hover:text-destructive"
                                            disabled={!!busy}
                                            onClick={() => handleRemove(logoType)}
                                        >
                                            <IconTrash className="mr-1 h-3.5 w-3.5" />
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
