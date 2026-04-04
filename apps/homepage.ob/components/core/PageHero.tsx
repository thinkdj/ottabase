import type { ReactNode } from 'react';
import { AnimateOnView } from './AnimateOnView';

type Props = {
    label: string;
    title: ReactNode;
    description: ReactNode;
};

export function PageHero({ label, title, description }: Props) {
    return (
        <AnimateOnView className="page-hero">
            <div className="container page-hero-inner">
                <span className="page-label">{label}</span>
                <h1>{title}</h1>
                <p>{description}</p>
            </div>
        </AnimateOnView>
    );
}
