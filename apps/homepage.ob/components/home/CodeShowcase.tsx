'use client';

import { AnimateOnView } from '@/components/core/AnimateOnView';
import {
    CODE_SHOWCASE_FILENAMES,
    CODE_SHOWCASE_PANELS,
    type CodeShowcaseTabId,
} from '@/components/home/code-showcase-panels';
import { useState } from 'react';

export function CodeShowcase() {
    const [tab, setTab] = useState<CodeShowcaseTabId>('model');

    return (
        <section className="code-showcase" aria-labelledby="code-heading">
            <div className="container code-showcase-inner">
                <AnimateOnView className="code-showcase-header">
                    <h2 id="code-heading">
                        Beautiful APIs.
                        <br />
                        Ugly problems, solved.
                    </h2>
                    <p>
                        OttaORM&apos;s fat models pattern keeps domain logic with the data — not scattered across
                        controllers, services, and repositories.
                    </p>

                    <div className="code-tabs" role="tablist" aria-label="Code examples">
                        {(
                            [
                                ['model', 'Model'],
                                ['hooks', 'Hooks'],
                                ['rls', 'RLS'],
                                ['deploy', 'Deploy'],
                            ] as const
                        ).map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                className={`code-tab${tab === id ? ' active' : ''}`}
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
                </AnimateOnView>

                <AnimateOnView delayClass="animate-delay-2">
                    <div className="code-window" role="tabpanel">
                        <div className="code-window-bar" aria-hidden="true">
                            <span className="code-window-dot" style={{ background: '#ef4444' }} />
                            <span className="code-window-dot" style={{ background: '#f59e0b' }} />
                            <span className="code-window-dot" style={{ background: '#10b981' }} />
                            <span className="code-window-filename" id="code-filename">
                                {CODE_SHOWCASE_FILENAMES[tab]}
                            </span>
                        </div>

                        {(Object.keys(CODE_SHOWCASE_PANELS) as CodeShowcaseTabId[]).map((id) => (
                            <div
                                key={id}
                                className={`code-panel${tab === id ? ' active' : ''}`}
                                id={`panel-${id}`}
                                hidden={tab !== id}
                                aria-label={`${id} example`}
                            >
                                <pre className="code-block">
                                    <code>{CODE_SHOWCASE_PANELS[id]}</code>
                                </pre>
                            </div>
                        ))}
                    </div>
                </AnimateOnView>
            </div>
        </section>
    );
}
