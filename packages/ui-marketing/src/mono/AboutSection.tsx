import type { AboutSectionProps } from '../types';
import { cn } from '../lib/utils';

export function MonoAboutSection({ eyebrow, headline, mission, story, values, team, className }: AboutSectionProps) {
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                <div className="mb-12 grid grid-cols-1 md:grid-cols-2 gap-8 pb-12 border-b border-border">
                    <div>
                        {eyebrow && <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">— {eyebrow}</p>}
                        <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">{headline}</h2>
                    </div>
                    {mission && <p className="text-base text-muted-foreground leading-relaxed self-end">{mission}</p>}
                </div>
                {story && (
                    <div className="mb-16 max-w-3xl py-8 border-b border-border">
                        <p className="text-base text-muted-foreground leading-relaxed">{story}</p>
                    </div>
                )}
                {values && values.length > 0 && (
                    <div className="mb-16">
                        <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground mb-6">— Values</p>
                        <div className="divide-y divide-border">
                            {values.map((v, i) => (
                                <div key={i} className="grid grid-cols-1 md:grid-cols-[80px_1fr_2fr] gap-4 md:gap-8 py-8">
                                    <span className="font-mono text-sm font-medium text-muted-foreground tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                                    <h4 className="font-heading text-sm font-semibold text-foreground">{v.title}</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {team && team.length > 0 && (
                    <div>
                        <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground mb-6">— Team</p>
                        <div className="divide-y divide-border">
                            {team.map((m, i) => (
                                <div key={i} className="flex items-center gap-4 py-5">
                                    {m.avatar && <img src={m.avatar} alt={m.name} className="h-10 w-10 rounded-full object-cover bg-muted" />}
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-foreground">{m.name}</p>
                                        <p className="text-xs text-muted-foreground">{m.role}</p>
                                    </div>
                                    {m.bio && <p className="hidden md:block text-xs text-muted-foreground max-w-xs">{m.bio}</p>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
