'use client';

import type { PkgCat } from '@/data/package-sections';
import { useState } from 'react';

type Props = {
    category: PkgCat;
    name: string;
    description: string;
};

export function PackageCard({ category, name, description }: Props) {
    const [copied, setCopied] = useState(false);
    const install = `pnpm add ${name}`;

    const onCopy = () => {
        void navigator.clipboard?.writeText(install).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
        });
    };

    return (
        <div className="pkg-card" data-cat={category}>
            <div className="pkg-card-head">
                <span className="pkg-dot" style={{ background: `var(--cat-${category})` as never }} />
                <span className="pkg-name">{name}</span>
            </div>
            <p className="pkg-desc">{description}</p>
            <button type="button" className="pkg-install" title="Click to copy" onClick={onCopy}>
                {copied ? 'copied!' : install}
            </button>
        </div>
    );
}
