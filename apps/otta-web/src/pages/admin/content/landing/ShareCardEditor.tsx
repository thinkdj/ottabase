// Edit a social image on a live canvas: the exact 1200×630 picture that will be uploaded.

import { SHARE_FIELDS, type ShareCard, type SiteSettings } from '@ottabase/ottalanding';
import { useEffect, useRef, useState } from 'react';
import { FieldsForm, type FieldErrors } from './FieldsForm';
import { cardColor, paintShareCard, type ShareDefaults } from './shareImage';

type ShareCardEditorProps = {
    value: ShareCard | undefined;
    onChange: (next: ShareCard) => void;
    /** The draft site settings: name, logo, theme and brand color all show in the card. */
    site: SiteSettings;
    defaults: ShareDefaults;
    errors?: FieldErrors;
    /** Prefix of the card's keys within `errors`, e.g. `share.` */
    path?: string;
};

export function ShareCardEditor({ value, onChange, site, defaults, errors, path }: ShareCardEditorProps) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const heading = value?.heading || defaults.heading;

    const { heading: defaultHeading, subtext: defaultSubtext } = defaults;
    useEffect(() => {
        let current = true;
        // Keep the same array when nothing changed, so a repaint never re-renders in a loop.
        const show = (next: string[]) =>
            current && setWarnings((prev) => (prev.join('|') === next.join('|') ? prev : next));
        if (canvas.current) {
            paintShareCard(canvas.current, value, site, { heading: defaultHeading, subtext: defaultSubtext }).then(
                show,
                () => show(['The preview couldn’t be drawn.']),
            );
        }
        return () => {
            current = false;
        };
    }, [value, site, defaultHeading, defaultSubtext]);

    return (
        <div className="space-y-5">
            <div className="max-w-2xl space-y-2">
                <canvas
                    ref={canvas}
                    width={1200}
                    height={630}
                    role="img"
                    aria-label={`Social image: ${heading}`}
                    className="aspect-[1200/630] w-full rounded-lg border border-border shadow-sm"
                />
                {warnings.map((w) => (
                    <p key={w} role="alert" className="text-sm text-destructive">
                        {w}
                    </p>
                ))}
                <p className="text-xs text-muted-foreground">
                    1200 × 630. Shown when a link is shared on X, LinkedIn, Slack, iMessage and more. Uploaded when you
                    save.
                </p>
            </div>
            <FieldsForm
                fields={SHARE_FIELDS}
                omit={['imageUrl']}
                value={value ?? {}}
                onChange={(next) => onChange(next as ShareCard)}
                errors={errors}
                path={path}
                placeholders={{
                    heading: defaults.heading,
                    subtext: defaults.subtext,
                    color: cardColor(undefined, site),
                }}
            />
        </div>
    );
}
