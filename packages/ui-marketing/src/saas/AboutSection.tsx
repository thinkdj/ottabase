import type { AboutSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — AboutSection
 *
 * Mission statement with values as soft shadow cards and team grid
 * with rounded avatars. Generous spacing, no hard borders.
 */
export function SaaSAboutSection({ eyebrow, headline, mission, story, values, team, className }: AboutSectionProps) {
    return (
        <section className={cn('bg-muted/30', className)}>
            <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
                <div className="mb-14 max-w-2xl mx-auto text-center">
                    {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>}
                    <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">{headline}</h2>
                    {mission && <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{mission}</p>}
                </div>
                {story && (
                    <div className="mb-16 max-w-3xl mx-auto text-center">
                        <p className="text-base text-muted-foreground leading-relaxed">{story}</p>
                    </div>
                )}
                {values && values.length > 0 && (
                    <div className="mb-16">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {values.map((v, i) => (
                                <div key={i} className="rounded-2xl bg-card p-7 shadow-sm">
                                    {v.icon && <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">{v.icon}</div>}
                                    <h4 className="font-heading text-base font-semibold text-foreground mb-2">{v.title}</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {team && team.length > 0 && (
                    <div>
                        <h3 className="text-center font-heading text-lg font-semibold text-foreground mb-8">Meet the team</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {team.map((m, i) => (
                                <div key={i} className="rounded-2xl bg-card p-6 text-center shadow-sm">
                                    {m.avatar && <img src={m.avatar} alt={m.name} className="mx-auto mb-4 h-16 w-16 rounded-full object-cover" />}
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
