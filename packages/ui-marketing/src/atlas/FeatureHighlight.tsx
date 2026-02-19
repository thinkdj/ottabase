import type { FeatureHighlightProps } from '../types';
import { cn } from '../lib/utils';

export function AtlasFeatureHighlight({ eyebrow, headline, description, image, imagePosition = 'right', bullets, cta, className }: FeatureHighlightProps) {
    const isLeft = imagePosition === 'left';
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-12 items-center', isLeft && 'md:[direction:rtl] md:[&>*]:direction-ltr')}>
                    <div>
                        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>}
                        <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">{headline}</h2>
                        <p className="mt-4 text-base text-muted-foreground leading-relaxed">{description}</p>
                        {bullets && bullets.length > 0 && (
                            <ul className="mt-6 space-y-3">
                                {bullets.map((b, i) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">✓</span>
                                        {b.text}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {cta && (
                            <div className="mt-8">
                                <a href={cta.href} className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">{cta.label}</a>
                            </div>
                        )}
                    </div>
                    {image && (
                        <div className="overflow-hidden rounded-xl border border-border bg-muted">
                            <img src={image.src} alt={image.alt} className="h-auto w-full object-cover" />
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
