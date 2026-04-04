'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

type Props = {
    children: ReactNode;
    className?: string;
    /** e.g. animate-delay-1 */
    delayClass?: string;
    style?: CSSProperties;
};

/**
 * Mirrors legacy IntersectionObserver: adds `.visible` when the element enters the viewport.
 */
export function AnimateOnView({ children, className = '', delayClass, style }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) setVisible(true);
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const cls = ['animate', delayClass, className, visible ? 'visible' : ''].filter(Boolean).join(' ').trim();

    return (
        <div ref={ref} className={cls} style={style}>
            {children}
        </div>
    );
}
