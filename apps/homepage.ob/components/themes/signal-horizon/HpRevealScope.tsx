'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

/**
 * Mirrors homepage.ob.1 `site.js`: IntersectionObserver + first-paint reveal for `.ob-hp-reveal`.
 */
export function HpRevealScope({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = ref.current;
        if (!root) return;

        const revealIfInView = (el: Element) => {
            const r = el.getBoundingClientRect();
            const vh = window.innerHeight || document.documentElement.clientHeight;
            if (r.top < vh + 80 && r.bottom > -80) {
                el.classList.add('is-visible');
            }
        };

        const els = root.querySelectorAll('.ob-hp-reveal');
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) e.target.classList.add('is-visible');
                });
            },
            { threshold: 0, rootMargin: '0px 0px 10% 0px' },
        );

        els.forEach((el) => {
            io.observe(el);
            revealIfInView(el);
        });

        requestAnimationFrame(() => {
            els.forEach(revealIfInView);
        });

        return () => io.disconnect();
    }, []);

    return <div ref={ref}>{children}</div>;
}
