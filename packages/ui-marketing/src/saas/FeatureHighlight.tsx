import type { FeatureHighlightProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — FeatureHighlight
 *
 * Split layout with text and image. Rounded-2xl image container with
 * soft shadow. Checkmark bullets with primary tint circles.
 */
export function SaaSFeatureHighlight({ eyebrow, headline, description, image, imagePosition = 'right', bullets, cta, className }: FeatureHighlightProps) {
    const isLeft = imagePosition === 'left';
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
                <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-14 items-center', isLeft && 'md:[direction:rtl] md:[&>*]:direction-ltr')}>
                    <div>
                        {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>}
                        <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">{headline}</h2>
                        <p className="mt-5 text-base text-muted-foreground leading-relaxed">{description}</p>
                        {bullets && bullets.length > 0 && (
                            <ul className="mt-8 space-y-4">
                                {bullets.map((b, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs">&#10003;</span>
                                        {b.text}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {cta && (
                            <div className="mt-8">
                                <a href={cta.href} className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg transition-all hover:-translate-y-0.5">{cta.label}</a>
                            </div>
                        )}
                    </div>
                    {image && (
                        <div className="overflow-hidden rounded-2xl bg-muted shadow-lg">
                            <img src={image.src} alt={image.alt} className="h-auto w-full object-cover" />
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
