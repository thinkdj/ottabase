'use client';

import { SignalPackageCard } from '@/components/themes/signal-horizon/SignalPackageCard';
import { FILTER_ORDER, PACKAGE_SECTIONS, type PkgCat } from '@/data/package-sections';
import { useState } from 'react';

export function SignalPackagesView() {
    const [filter, setFilter] = useState<PkgCat | 'all'>('all');

    return (
        <div className="ob-hp-container">
            <div className="ob-hp-filter" role="toolbar" aria-label="Filter packages by category">
                {FILTER_ORDER.map((f) => (
                    <button
                        key={f.id}
                        type="button"
                        className={`ob-hp-filter-btn${filter === f.id ? ' is-active' : ''}`}
                        data-cat={f.id}
                        aria-pressed={filter === f.id}
                        onClick={() => setFilter(f.id)}
                    >
                        {f.id !== 'all' ? (
                            <span className="pkg-filter-dot" style={{ background: `var(--cat-${f.id})` as never }} />
                        ) : null}
                        {f.label} <span style={{ color: 'var(--ob-dim)', marginLeft: 4 }}>{f.count}</span>
                    </button>
                ))}
            </div>

            <div style={{ paddingBottom: '5rem' }}>
                {PACKAGE_SECTIONS.map((section) => {
                    if (filter !== 'all' && filter !== section.category) return null;
                    return (
                        <div key={section.category} data-cat={section.category}>
                            <h2 className="ob-hp-pkg-section-title ob-hp-reveal">
                                <span
                                    className="pkg-filter-dot"
                                    style={{ background: `var(--cat-${section.category})` as never }}
                                />
                                {section.title}
                            </h2>
                            <div className="ob-hp-pkg-grid ob-hp-reveal">
                                {section.packages.map((pkg) => (
                                    <SignalPackageCard
                                        key={pkg.name}
                                        category={section.category}
                                        name={pkg.name}
                                        description={pkg.description}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
