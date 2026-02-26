import type { LogoCloudProps } from '../types';
import { cn } from '../lib/utils';

/**
 * Mono — LogoCloud
 *
 * Minimal horizontal rule with company names in monospace.
 * Supports logo images (grayscale) or text-only fallback.
 * Single row, flush with content edges.
 */
export function MonoLogoCloud({ label, logos, className }: LogoCloudProps) {
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
                {/* Label */}
                <div className="flex items-center gap-4 mb-8">
                    {label && (
                        <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                            {label}
                        </p>
                    )}
                    <div className="h-px flex-1 bg-border" />
                </div>

                {/* Logos */}
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                    {logos.map((logo) =>
                        logo.src ? (
                            <img
                                key={logo.name}
                                src={logo.src}
                                alt={logo.name}
                                width={logo.width ?? 100}
                                height={logo.height ?? 28}
                                className="h-6 w-auto object-contain grayscale opacity-50 hover:opacity-100 hover:grayscale-0 transition-all duration-150"
                            />
                        ) : (
                            <span
                                key={logo.name}
                                className="font-mono text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors tracking-tight"
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
