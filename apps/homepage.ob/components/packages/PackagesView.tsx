'use client';

import { AnimateOnView } from '@/components/core/AnimateOnView';
import { FILTER_ORDER, PACKAGE_SECTIONS, type PkgCat } from '@/data/package-sections';
import { useState } from 'react';
import { PackageCard } from './PackageCard';

export function PackagesView() {
    const [filter, setFilter] = useState<PkgCat | 'all'>('all');

    return (
        <div className="container">
            <div className="pkg-filter" role="toolbar" aria-label="Filter packages by category">
                {FILTER_ORDER.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        className={`pkg-filter-btn${filter === f.id ? ' active' : ''}`}
                        data-cat={f.id}
                        aria-pressed={filter === f.id}
                        onClick={() => setFilter(f.id)}
                    >
                        {f.id !== 'all' ? (
                            <span className="pkg-filter-dot" style={{ background: `var(--cat-${f.id})` as never }} />
                        ) : null}
                        {f.label} <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>{f.count}</span>
                    </button>
                ))}
            </div>

            <div style={{ paddingBottom: '5rem' }}>
                {PACKAGE_SECTIONS.map((section) => {
                    if (filter !== 'all' && filter !== section.category) return null;
                    return (
                        <div key={section.category} className="pkg-section" data-cat={section.category}>
                            <AnimateOnView>
                                <h2 className="pkg-section-title">
                                    <span
                                        className="pkg-filter-dot"
                                        style={{ background: `var(--cat-${section.category})` as never }}
                                    />
                                    {section.title}
                                </h2>
                            </AnimateOnView>
                            <AnimateOnView className="pkg-grid">
                                {section.packages.map((pkg) => (
                                    <PackageCard
                                        key={pkg.name}
                                        category={section.category}
                                        name={pkg.name}
                                        description={pkg.description}
                                    />
                                ))}
                            </AnimateOnView>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
