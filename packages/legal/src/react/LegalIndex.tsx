/**
 * Lists the policies enabled for a config, for a `/legal` landing page or a footer. Renders plain `<a>` links to
 * `{basePath}/{slug}`, or supply `renderItem` for a router `<Link>`.
 */

import { type ReactNode } from 'react';
import { listLegalDocuments } from '../assemble';
import { legalBaseOf } from '../interpolate';
import type { LegalConfig, LegalDocMeta } from '../types';

export interface LegalIndexProps {
    config: LegalConfig;
    /** Custom renderer for each policy, such as a framework `<Link>`. */
    renderItem?: (doc: LegalDocMeta) => ReactNode;
    /** Optional heading block above the list. */
    heading?: ReactNode;
    className?: string;
}

export function LegalIndex({ config, renderItem, heading, className }: LegalIndexProps) {
    const docs = listLegalDocuments(config);
    const base = legalBaseOf(config);

    return (
        <div className={['otta-legal', 'otta-legal-index', className].filter(Boolean).join(' ')}>
            {heading}
            {docs.map((doc) =>
                renderItem ? (
                    <div key={doc.id}>{renderItem(doc)}</div>
                ) : (
                    <a key={doc.id} className="otta-legal-index-item" href={`${base}/${doc.slug}`}>
                        <h3>{doc.title}</h3>
                    </a>
                ),
            )}
        </div>
    );
}
