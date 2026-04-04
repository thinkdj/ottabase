'use client';

import {
    CODE_SHOWCASE_FILENAMES,
    CODE_SHOWCASE_PANELS,
    type CodeShowcaseTabId,
} from '@/components/home/code-showcase-panels';
import { useState } from 'react';

const TABS: { id: CodeShowcaseTabId; label: string }[] = [
    { id: 'model', label: 'Model' },
    { id: 'hooks', label: 'Hooks' },
    { id: 'rls', label: 'RLS' },
    { id: 'deploy', label: 'Ship' },
];

export function SignalCodeShowcase() {
    const [tab, setTab] = useState<CodeShowcaseTabId>('model');

    return (
        <section className="ob-hp-code-zone" aria-labelledby="ob-hp-code-title">
            <div className="ob-hp-container ob-hp-code-layout">
                <div className="ob-hp-reveal">
                    <h2 id="ob-hp-code-title">APIs you want to read.</h2>
                    <p style={{ color: 'var(--ob-muted)', marginTop: '0.75rem', maxWidth: '42ch' }}>
                        Domain logic lives on the model — not spread across controllers and &quot;service layers&quot;
                        that only forward calls.
                    </p>
                    <div className="ob-hp-code-tabs" role="tablist" aria-label="Code examples">
                        {TABS.map(({ id, label }) => (
                            <button
                                key={id}
                                type="button"
                                className={`ob-hp-code-tab${tab === id ? ' is-active' : ''}`}
                                role="tab"
                                aria-selected={tab === id}
                                aria-controls={`panel-${id}`}
                                id={`tab-${id}`}
                                onClick={() => setTab(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="ob-hp-reveal">
                    <div className="ob-hp-window" role="tabpanel">
                        <div className="ob-hp-window-bar" aria-hidden="true">
                            <span className="ob-hp-window-dot" style={{ background: '#ff5f57' }} />
                            <span className="ob-hp-window-dot" style={{ background: '#febc2e' }} />
                            <span className="ob-hp-window-dot" style={{ background: '#28c840' }} />
                            <span className="ob-hp-window-name" id="ob-hp-code-filename">
                                {CODE_SHOWCASE_FILENAMES[tab]}
                            </span>
                        </div>
                        {(Object.keys(CODE_SHOWCASE_PANELS) as CodeShowcaseTabId[]).map((id) => (
                            <div
                                key={id}
                                className={`ob-hp-code-panel${tab === id ? ' is-active' : ''}`}
                                data-panel={id}
                                id={`panel-${id}`}
                                hidden={tab !== id}
                                aria-label={`${id} example`}
                            >
                                <pre className="ob-hp-code-block">
                                    <code>{CODE_SHOWCASE_PANELS[id]}</code>
                                </pre>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
