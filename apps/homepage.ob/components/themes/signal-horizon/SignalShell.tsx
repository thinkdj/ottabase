import type { ReactNode } from 'react';

export function SignalShell({ children }: { children: ReactNode }) {
    return (
        <>
            <a className="hp-skip" href="#main">
                Skip to content
            </a>
            <div className="hp-shell">{children}</div>
        </>
    );
}
