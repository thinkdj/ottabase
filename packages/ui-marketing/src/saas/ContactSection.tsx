import type { ContactSectionProps } from '../types';
import { cn } from '../lib/utils';

/**
 * SaaS — ContactSection
 *
 * Contact info cards + form in a rounded-2xl container.
 * Pill submit button. Soft shadow everything.
 */
export function SaaSContactSection({ eyebrow, headline, subheadline, contactInfo, showForm, className }: ContactSectionProps) {
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
                <div className="mb-12 max-w-2xl">
                    {eyebrow && <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>}
                    <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">{headline}</h2>
                    {subheadline && <p className="mt-4 text-base text-muted-foreground leading-relaxed">{subheadline}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {contactInfo && contactInfo.length > 0 && (
                        <div className="space-y-4">
                            {contactInfo.map((item, i) => (
                                <div key={i} className="flex items-start gap-4 rounded-2xl bg-muted/50 p-5">
                                    {item.icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{item.icon}</div>}
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{item.label}</p>
                                        {item.href ? (
                                            <a href={item.href} className="text-sm font-medium text-foreground hover:text-primary transition-colors">{item.value}</a>
                                        ) : (
                                            <p className="text-sm font-medium text-foreground">{item.value}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {showForm !== false && (
                        <div className="rounded-2xl bg-card p-7 shadow-sm">
                            <h3 className="font-heading text-lg font-semibold text-foreground mb-5">Send a message</h3>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
                                    <input type="text" className="w-full rounded-xl border-0 bg-muted/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Your name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                                    <input type="email" className="w-full rounded-xl border-0 bg-muted/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="you@company.com" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Message</label>
                                    <textarea rows={4} className="w-full rounded-xl border-0 bg-muted/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="How can we help?" />
                                </div>
                                <button type="submit" className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/25 hover:shadow-lg transition-all">Send message</button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
