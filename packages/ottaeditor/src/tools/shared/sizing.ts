/**
 * Height / fit / focal-point controls shared by the image-stage blocks (Before/After, Hotspots).
 * Kept beside the tools rather than in the kit so it can be lifted there once a third block needs it.
 */
import { field, h, positionGrid, row, segment, textInput, type ImagePosition } from '../../ui/kit';

export type ImageFit = 'contain' | 'cover';

/** `"400"` → `"400px"`, `"50vh"` stays, nonsense or >5000px → `""` (auto). */
export function normalizeHeight(raw: string): string {
    const v = raw.trim();
    if (!v) return '';
    if (/^\d+(\.\d+)?$/.test(v)) return Number(v) <= 5000 ? `${Number(v)}px` : '';
    const m = v.match(/^(\d+(?:\.\d+)?)(px|em|rem|vh)$/i);
    if (!m) return '';
    return m[2]!.toLowerCase() === 'px' && Number(m[1]) > 5000 ? '' : v;
}

export interface SizingState {
    height?: string;
    imageFit?: ImageFit;
}

/**
 * One row: Height · Fit · (focal points, only when Cover). `positions` lists each focal point to edit
 * (one for a single image, two for before/after). Re-renders itself when fit changes.
 */
export function sizingControls<T extends SizingState>(
    data: T,
    positions: Array<{ key: keyof T; label: string }>,
    onChange: () => void,
): HTMLElement {
    const host = h('div', { className: 'oe-sizing' });
    const paint = () => {
        host.innerHTML = '';
        const height = textInput({
            value: data.height || '',
            placeholder: 'auto (e.g. 400px, 50vh)',
            ariaLabel: 'Height',
            onCommit: (v) => {
                data.height = normalizeHeight(v);
                height.value = data.height || '';
                onChange();
            },
        });
        const fit = segment<ImageFit>({
            value: data.imageFit === 'cover' ? 'cover' : 'contain',
            ariaLabel: 'Image fit',
            options: [
                { value: 'contain', label: 'Contain' },
                { value: 'cover', label: 'Cover' },
            ],
            onChange: (v) => {
                data.imageFit = v;
                onChange();
                paint();
            },
        });
        const controls = [field({ label: 'Height', control: height }), field({ label: 'Fit', control: fit })];
        if (data.imageFit === 'cover') {
            for (const p of positions) {
                controls.push(
                    field({
                        label: p.label,
                        control: positionGrid({
                            value: ((data[p.key] as unknown as ImagePosition | undefined) ?? 'center') as ImagePosition,
                            ariaLabel: p.label,
                            onChange: (pos) => {
                                (data as Record<keyof T, unknown>)[p.key] = pos;
                                onChange();
                            },
                        }),
                    }),
                );
            }
        }
        host.append(row(...controls));
    };
    paint();
    return host;
}
