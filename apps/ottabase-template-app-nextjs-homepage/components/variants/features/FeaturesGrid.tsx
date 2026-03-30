import type { FeaturesData } from './types';

/**
 * Grid features — two-column bordered list (the original default).
 */
export function FeaturesGrid({ title, features }: FeaturesData) {
    return (
        <section className="mx-auto w-full max-w-3xl px-4 py-14">
            {title && <h2 className="mb-6 font-heading text-lg font-semibold text-foreground">{title}</h2>}
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {features.map((f) => (
                    <div key={f.title} className="border-l-2 border-primary/40 py-1 pl-4">
                        <dt className="font-heading text-sm font-semibold text-foreground">{f.title}</dt>
                        <dd className="mt-0.5 text-sm text-muted-foreground">{f.description}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
