import type { ContactSectionProps } from '../types';
import { cn } from '../lib/utils';

export function AtlasContactSection({ eyebrow, headline, subheadline, contactInfo, showForm, className }: ContactSectionProps) {
    return (
        <section className={cn('bg-background', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                <div className="mb-12 max-w-2xl">
                    {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>}
                    <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">{headline}</h2>
                    {subheadline && <p className="mt-3 text-base text-muted-foreground leading-relaxed">{subheadline}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Contact info */}
                    {contactInfo && contactInfo.length > 0 && (
                        <div className="space-y-4">
                            {contactInfo.map((item, i) => (
                                <div key={i} className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
                                    {item.icon && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground">{item.icon}</div>}
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
                    {/* Form */}
                    {showForm !== false && (
                        <div className="rounded-xl border border-border bg-card p-6">
                            <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Send a message</h3>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                                    <input type="text" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Your name" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                                    <input type="email" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="you@company.com" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Message</label>
                                    <textarea rows={4} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" placeholder="How can we help?" />
                                </div>
                                <button type="submit" className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Send message</button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
