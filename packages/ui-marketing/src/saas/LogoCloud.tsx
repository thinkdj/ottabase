import type { LogoCloudProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — LogoCloud
 *
 * Centered row of logos on a subtle muted background strip.
 * Grayscale with hover to full color. No borders.
 */
export function SaaSLogoCloud({ label, logos, className }: LogoCloudProps) {
    return (
        <section className={cn('bg-muted/30', className)}>
            <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
                {label && (
                    <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        {label}
                    </p>
                )}

                <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
                    {logos.map((logo) =>
                        logo.src ? (
                            <img
                                key={logo.name}
                                src={logo.src}
                                alt={logo.name}
                                width={logo.width ?? 120}
                                height={logo.height ?? 32}
                                className="h-7 w-auto object-contain grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                            />
                        ) : (
                            <span
                                key={logo.name}
                                className="text-sm font-semibold text-muted-foreground/60 hover:text-foreground transition-colors tracking-tight"
                            >
                                {logo.name}
                            </span>
                        ),
                    )}
                </div>
            </div>
        </section>
    );
}
