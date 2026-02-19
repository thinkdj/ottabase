import type { FeatureHighlightProps } from '../types';
import { cn } from '../lib/utils';

export function MonoFeatureHighlight({ eyebrow, headline, description, image, imagePosition = 'right', bullets, cta, className }: FeatureHighlightProps) {
    const isLeft = imagePosition === 'left';
    return (
        <section className={cn('bg-background border-t border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-16 items-start', isLeft && 'md:[direction:rtl] md:[&>*]:direction-ltr')}>
                    <div>
                        {eyebrow && <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">— {eyebrow}</p>}
                        <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">{headline}</h2>
                        <p className="mt-6 text-base text-muted-foreground leading-relaxed">{description}</p>
                        {bullets && bullets.length > 0 && (
                            <ul className="mt-8 space-y-4 border-t border-border pt-6">
                                {bullets.map((b, i) => (
                                    <li key={i} className="flex items-start gap-4 text-sm text-muted-foreground">
                                        <span className="font-mono text-xs font-bold text-foreground tabular-nums mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                                        {b.text}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {cta && (
                            <div className="mt-8">
                                <a href={cta.href} className="inline-flex items-center border-b-2 border-foreground pb-1 text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors">{cta.label} →</a>
                            </div>
                        )}
                    </div>
                    {image && (
                        <div className="border border-border bg-muted">
                            <img src={image.src} alt={image.alt} className="h-auto w-full object-cover" />
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
