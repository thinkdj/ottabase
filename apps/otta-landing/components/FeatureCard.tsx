type FeatureItemProps = {
    /** Short label */
    title: string;
    /** One-liner explanation */
    description: string;
};

export function FeatureItem({ title, description }: FeatureItemProps) {
    return (
        <div className="border-l-2 border-primary/40 py-1 pl-4">
            <dt className="font-heading text-sm font-semibold text-foreground">{title}</dt>
            <dd className="mt-0.5 text-sm text-muted-foreground">{description}</dd>
        </div>
    );
}

type FeaturesGridProps = {
    /** Optional section heading */
    title?: string;
    /** Feature items */
    features: FeatureItemProps[];
};

export function FeaturesGrid({ title, features }: FeaturesGridProps) {
    return (
        <section className="mx-auto w-full max-w-3xl px-4 py-14">
            {title && <h2 className="mb-6 font-heading text-lg font-semibold text-foreground">{title}</h2>}
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {features.map((f) => (
                    <FeatureItem key={f.title} {...f} />
                ))}
            </dl>
        </section>
    );
}
