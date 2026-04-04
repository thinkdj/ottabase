'use client';

import { siteConfig } from '@/config';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const NAV: { label: string; items: { href: string; label: string; external?: boolean }[] }[] = [
    {
        label: 'Getting Started',
        items: [
            { href: '#prerequisites', label: 'Prerequisites' },
            { href: '#clone', label: 'Clone & Install' },
            { href: '#cloudflare', label: 'Cloudflare Setup' },
            { href: '#dev', label: 'Local Development' },
            { href: '#bootstrap', label: 'Bootstrap' },
            { href: '#deploy', label: 'Deploy' },
        ],
    },
    {
        label: 'Core Concepts',
        items: [
            { href: '#models', label: 'Fat Models' },
            { href: '#crud', label: 'Auto CRUD' },
            { href: '#rls', label: 'Row-Level Security' },
            { href: '#rbac', label: 'RBAC' },
            { href: '#migrations', label: 'Auto-Migrations' },
        ],
    },
    {
        label: 'Resources',
        items: [
            { href: 'https://github.com/thinkdj/ottabase', label: 'GitHub ↗', external: true },
            { href: '/packages', label: 'Package List' },
            { href: '/philosophy', label: 'Philosophy' },
            { href: 'https://discord.gg/ottabase', label: 'Discord ↗', external: true },
        ],
    },
];

export function DocsSidebar() {
    const sh = siteConfig.theme === 'signalHorizon';
    const [active, setActive] = useState('prerequisites');

    useEffect(() => {
        const sections = document.querySelectorAll('section[id]');
        const updateActive = () => {
            let current = 'prerequisites';
            sections.forEach((s) => {
                const el = s as HTMLElement;
                if (window.scrollY >= el.offsetTop - 120) current = el.id;
            });
            setActive(current);
        };
        window.addEventListener('scroll', updateActive, { passive: true });
        updateActive();
        return () => window.removeEventListener('scroll', updateActive);
    }, []);

    return (
        <aside
            className={sh ? 'docs-sidebar ob-hp-docs-nav ob-hp-reveal' : 'docs-sidebar animate'}
            aria-label="Documentation navigation"
        >
            {NAV.map((group) => (
                <div key={group.label} className="docs-nav-group">
                    <div className="docs-nav-label">{group.label}</div>
                    {group.items.map((item) => {
                        const isHash = item.href.startsWith('#');
                        const sectionId = isHash ? item.href.slice(1) : '';
                        const isActive = isHash && active === sectionId;
                        const className = `docs-nav-item${isActive ? ' active' : ''}`;
                        if (item.external) {
                            return (
                                <a
                                    key={item.href}
                                    href={item.href}
                                    className={className}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {item.label}
                                </a>
                            );
                        }
                        if (isHash) {
                            return (
                                <a key={item.href} href={item.href} className={className}>
                                    {item.label}
                                </a>
                            );
                        }
                        return (
                            <Link key={item.href} href={item.href} className={className}>
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            ))}
        </aside>
    );
}
