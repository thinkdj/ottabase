import type { ContactSectionProps } from '../types';
import { cn } from '../lib/utils';

export function MonoContactSection({ eyebrow, headline, subheadline, contactInfo, showForm, className }: ContactSectionProps) {
    return (
        <section className={cn('bg-background border-t border-border', className)}>
            <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
                <div className="mb-12">
                    {eyebrow && <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">— {eyebrow}</p>}
                    <h2 className="font-heading text-3xl md:text-4xl font-semibold text-foreground tracking-tight">{headline}</h2>
                    {subheadline && <p className="mt-3 max-w-2xl text-muted-foreground">{subheadline}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                    {contactInfo && contactInfo.length > 0 && (
                        <div className="divide-y divide-border">
                            {contactInfo.map((item, i) => (
                                <div key={i} className="py-5">
                                    <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">{item.label}</p>
                                    {item.href ? (
                                        <a href={item.href} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">{item.value}</a>
                                    ) : (
                                        <p className="text-sm font-semibold text-foreground">{item.value}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {showForm !== false && (
                        <div className="border border-border p-6">
                            <p className="font-mono text-xs font-medium uppercase tracking-widest text-muted-foreground mb-6">— Send a message</p>
                            <form className="space-y-5">
                                <div>
                                    <label className="block font-mono text-xs font-medium text-muted-foreground mb-1.5">Name</label>
                                    <input type="text" className="w-full border-b border-border bg-transparent px-0 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors" placeholder="Your name" />
                                </div>
                                <div>
                                    <label className="block font-mono text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                                    <input type="email" className="w-full border-b border-border bg-transparent px-0 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors" placeholder="you@company.com" />
                                </div>
                                <div>
                                    <label className="block font-mono text-xs font-medium text-muted-foreground mb-1.5">Message</label>
                                    <textarea rows={4} className="w-full border-b border-border bg-transparent px-0 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors resize-none" placeholder="How can we help?" />
                                </div>
                                <button type="submit" className="border-b-2 border-foreground pb-1 text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-colors">Send message →</button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
