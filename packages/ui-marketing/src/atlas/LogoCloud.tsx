import type { LogoCloudProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Atlas — LogoCloud
 *
 * Centered horizontal row of company logos (grayscale, hover to full color).
 * Falls back to styled text if no image src is provided.
 */
export function AtlasLogoCloud({ label, logos, className }: LogoCloudProps) {
    return (
        <section className={cn('bg-background border-y border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
                {label && (
                    <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        {label}
                    </p>
                )}

                <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
                    {logos.map((logo) =>
                        logo.src ? (
                            <img
                                key={logo.name}
                                src={logo.src}
                                alt={logo.name}
                                width={logo.width ?? 120}
                                height={logo.height ?? 32}
                                className="h-7 w-auto object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-200"
                            />
                        ) : (
                            <span
                                key={logo.name}
                                className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors tracking-tight"
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
