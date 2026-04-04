'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

/**
 * Matches legacy `main.js`: observes `.animate` descendants and adds `.visible` when in view.
 */
export function LegacyAnimateScope({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = ref.current;
        if (!root) return;
        const els = root.querySelectorAll('.animate');
        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) e.target.classList.add('visible');
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
        );
        els.forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, []);

    return <div ref={ref}>{children}</div>;
}
