import type { AboutSectionProps } from '../types';
import { cn } from '../lib/utils';

export function AtlasAboutSection({ eyebrow, headline, mission, story, values, team, className }: AboutSectionProps) {
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                {/* Header */}
                <div className="mb-12 max-w-2xl">
                    {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>}
                    <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">{headline}</h2>
                    {mission && <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{mission}</p>}
                </div>
                {story && (
                    <div className="mb-16 max-w-3xl">
                        <p className="text-base text-muted-foreground leading-relaxed">{story}</p>
                    </div>
                )}
                {/* Values */}
                {values && values.length > 0 && (
                    <div className="mb-16">
                        <h3 className="font-heading text-lg font-semibold text-foreground mb-6">Our values</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
                            {values.map((v, i) => (
                                <div key={i} className="bg-card p-6 flex flex-col gap-3">
                                    {v.icon && <div className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground shrink-0">{v.icon}</div>}
                                    <h4 className="font-heading text-sm font-semibold text-foreground">{v.title}</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* Team */}
                {team && team.length > 0 && (
                    <div>
                        <h3 className="font-heading text-lg font-semibold text-foreground mb-6">Meet the team</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {team.map((m, i) => (
                                <div key={i} className="rounded-xl border border-border bg-card p-5 text-center">
                                    {m.avatar && <img src={m.avatar} alt={m.name} className="mx-auto mb-3 h-16 w-16 rounded-full object-cover bg-muted" />}
                                    <h4 className="font-heading text-sm font-semibold text-foreground">{m.name}</h4>
                                    <p className="text-xs text-muted-foreground">{m.role}</p>
                                    {m.bio && <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{m.bio}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
