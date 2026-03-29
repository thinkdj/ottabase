import type { FeaturesData } from './types';

/**
 * Card-based features — each feature in a bordered card with hover lift.
 */
export function FeaturesCards({ title, features }: FeaturesData) {
    return (
        <section className="mx-auto w-full max-w-4xl px-4 py-14">
            {title && <h2 className="mb-8 text-center font-heading text-lg font-semibold text-foreground">{title}</h2>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((f) => (
                    <div
                        key={f.title}
                        className="rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
                    >
                        <h3 className="font-heading text-sm font-semibold text-card-foreground">{f.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
