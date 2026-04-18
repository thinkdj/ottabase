import type { FeaturesData } from './types';

/**
 * List features — vertical stacked rows with alternating background.
 */
export function FeaturesList({ title, features }: FeaturesData) {
    return (
        <section className="mx-auto w-full max-w-3xl px-4 py-14">
            {title && <h2 className="mb-6 font-heading text-lg font-semibold text-foreground">{title}</h2>}
            <ul className="divide-y divide-border">
                {features.map((f, i) => (
                    <li key={f.title} className={`flex flex-col gap-1 px-4 py-4 ${i % 2 === 1 ? 'bg-muted/30' : ''}`}>
                        <span className="font-heading text-sm font-semibold text-foreground">{f.title}</span>
                        <span className="text-sm text-muted-foreground">{f.description}</span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
