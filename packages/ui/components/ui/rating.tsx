'use client';

import * as React from 'react';
import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { Star } from 'lucide-react';

import { cn } from '@ottabase/ui/lib/utils';

/*
 * A star rating. Interactive, it is one slider (the WAI-ARIA rating-slider
 * pattern): a single tab stop, arrows step by `step`, Home clears, End is the
 * top mark, a digit jumps to that many stars, and the pointer previews before
 * it commits. With `step={0.5}` the pointer picks the half of a star it is on.
 * Read-only, it is an image whose label carries the value and it shows
 * fractions as they are (an average of 4.3 fills 30% of the fifth star).
 *
 * Any SVG can be the mark: a Lucide icon, your own SVG component, or an
 * element (`icon={<svg>…</svg>}`). A part is filled by clipping a filled copy
 * over the empty one, so halves and fractions work for every shape. Draw with
 * `currentColor` (or no fill) to take the theme's colours; fixed fills are
 * kept, for a multicolour mark. `emptyIcon` draws empty marks with a shape
 * of their own (an outline set beside a solid one).
 *
 * Stars take --rating-color (amber by default) so a theme can re-colour them
 * without touching the status tones. Theming hooks: data-slot on the root and
 * each star, data-state="full|partial|empty" on each star.
 */

const STAR_SIZES = {
    sm: 'size-4',
    default: 'size-5',
    lg: 'size-6',
} as const;

/** An SVG component (Lucide or your own, taking `className`) or a ready element. */
export type RatingIcon = React.ElementType<{ className?: string }> | React.ReactElement<{ className?: string }>;

/** Renders a mark at the rating's size, keeping any class the element already has. */
function renderMark(icon: RatingIcon, className: string) {
    if (React.isValidElement<{ className?: string }>(icon)) {
        return React.cloneElement(icon, { className: cn(className, icon.props.className) });
    }
    const Mark = icon;
    return <Mark className={className} />;
}

const defaultValueText = (value: number, max: number) => `${value} of ${max} star${max === 1 ? '' : 's'}`;

export interface RatingProps extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'defaultValue' | 'onChange' | 'role' | 'children'
> {
    value?: number;
    defaultValue?: number;
    onValueChange?: (value: number) => void;
    /** Number of stars. */
    max?: number;
    /** What one pointer click or arrow press is worth: whole stars or halves. */
    step?: 1 | 0.5;
    readOnly?: boolean;
    disabled?: boolean;
    /** Choosing the current value again clears the rating to 0. */
    allowClear?: boolean;
    size?: keyof typeof STAR_SIZES;
    /** The mark: a Lucide icon (the default is Star), an SVG component or an `<svg>` element. */
    icon?: RatingIcon;
    /** A different mark for the empty part; the filled part still uses `icon`. */
    emptyIcon?: RatingIcon;
    /** Submits the value with a form under this name. */
    name?: string;
    /** What a screen reader hears for a value; "3.5 of 5 stars" by default. */
    getValueText?: (value: number, max: number) => string;
}

const Rating = React.forwardRef<HTMLDivElement, RatingProps>(
    (
        {
            value: valueProp,
            defaultValue = 0,
            onValueChange,
            max = 5,
            step = 1,
            readOnly = false,
            disabled = false,
            allowClear = true,
            size = 'default',
            icon = Star,
            emptyIcon,
            name,
            getValueText = defaultValueText,
            className,
            onKeyDown,
            onPointerLeave,
            'aria-label': ariaLabel,
            ...props
        },
        forwardedRef,
    ) => {
        const [value = 0, setValue] = useControllableState({
            prop: valueProp,
            defaultProp: defaultValue,
            onChange: onValueChange,
        });
        const [hover, setHover] = React.useState<number | null>(null);
        const rootRef = React.useRef<HTMLDivElement>(null);
        React.useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement);

        const interactive = !readOnly && !disabled;
        const snap = (next: number) => Math.min(max, Math.max(0, Math.round(next / step) * step));
        const isRtl = () => !!rootRef.current && getComputedStyle(rootRef.current).direction === 'rtl';

        const commit = (next: number) => {
            setHover(null);
            setValue(snap(next));
        };

        /** The value under the pointer: the half a star when `step` is 0.5, else the whole star. */
        const valueAt = (event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>, index: number) => {
            if (step === 1) return index + 1;
            const rect = event.currentTarget.getBoundingClientRect();
            const offset = isRtl() ? rect.right - event.clientX : event.clientX - rect.left;
            return rect.width > 0 && offset / rect.width <= 0.5 ? index + 0.5 : index + 1;
        };

        const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || !interactive) return;

            const forward = isRtl() ? 'ArrowLeft' : 'ArrowRight';
            const back = isRtl() ? 'ArrowRight' : 'ArrowLeft';
            let next: number | null = null;

            if (event.key === forward || event.key === 'ArrowUp') next = value + step;
            else if (event.key === back || event.key === 'ArrowDown') next = value - step;
            else if (event.key === 'PageUp') next = value + 1;
            else if (event.key === 'PageDown') next = value - 1;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = max;
            else if (/^[0-9]$/.test(event.key) && Number(event.key) <= max) next = Number(event.key);

            if (next !== null) {
                event.preventDefault();
                commit(next);
            }
        };

        const shown = interactive && hover !== null ? hover : value;
        const valueText = getValueText(value, max);

        return (
            <div
                ref={rootRef}
                data-slot="rating"
                data-size={size}
                data-disabled={disabled ? '' : undefined}
                data-readonly={readOnly ? '' : undefined}
                {...(readOnly
                    ? { role: 'img', 'aria-label': ariaLabel ? `${ariaLabel}: ${valueText}` : valueText }
                    : {
                          role: 'slider',
                          tabIndex: disabled ? -1 : 0,
                          'aria-label': ariaLabel,
                          'aria-valuemin': 0,
                          'aria-valuemax': max,
                          'aria-valuenow': value,
                          'aria-valuetext': valueText,
                          'aria-disabled': disabled || undefined,
                          'aria-orientation': 'horizontal' as const,
                      })}
                className={cn(
                    'inline-flex w-fit items-center rounded-sm [--rating-fill:var(--rating-color,hsl(var(--warning)))]',
                    size === 'lg' ? 'gap-1' : 'gap-0.5',
                    disabled && 'cursor-not-allowed opacity-50',
                    className,
                )}
                onKeyDown={handleKeyDown}
                onPointerLeave={(event) => {
                    onPointerLeave?.(event);
                    setHover(null);
                }}
                {...props}
            >
                {Array.from({ length: max }, (_, index) => {
                    const fill = Math.min(1, Math.max(0, shown - index));
                    return (
                        <span
                            key={index}
                            aria-hidden="true"
                            data-slot="rating-item"
                            data-state={fill === 1 ? 'full' : fill > 0 ? 'partial' : 'empty'}
                            className={cn(
                                'relative shrink-0',
                                interactive &&
                                    'cursor-pointer transition-transform duration-fast ease-theme hover:scale-110',
                            )}
                            onPointerMove={interactive ? (event) => setHover(valueAt(event, index)) : undefined}
                            onClick={
                                interactive
                                    ? (event) => {
                                          const next = valueAt(event, index);
                                          commit(allowClear && next === value ? 0 : next);
                                      }
                                    : undefined
                            }
                        >
                            {renderMark(
                                emptyIcon ?? icon,
                                cn(STAR_SIZES[size], 'block fill-muted text-input [stroke-width:1.75]'),
                            )}
                            {fill > 0 ? (
                                <span
                                    data-slot="rating-fill"
                                    className="absolute inset-y-0 start-0 overflow-hidden"
                                    style={{ width: `${fill * 100}%` }}
                                >
                                    {renderMark(
                                        icon,
                                        cn(
                                            STAR_SIZES[size],
                                            'block max-w-none shrink-0 fill-[color:var(--rating-fill)] text-[color:var(--rating-fill)] [stroke-width:1.75]',
                                        ),
                                    )}
                                </span>
                            ) : null}
                        </span>
                    );
                })}
                {name ? <input type="hidden" name={name} value={value} disabled={disabled} /> : null}
            </div>
        );
    },
);
Rating.displayName = 'Rating';

export { Rating };
