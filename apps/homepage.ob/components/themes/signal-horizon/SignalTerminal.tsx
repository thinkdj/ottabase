'use client';

import { TERMINAL_LINES } from '@/lib/terminal-lines';
import { useEffect, useRef, useState } from 'react';

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function typeChars(el: HTMLSpanElement, text: string, speed = 26) {
    for (const ch of text) {
        el.textContent += ch;
        await sleep(speed + Math.random() * 10);
    }
}

export function SignalTerminal() {
    const bodyRef = useRef<HTMLDivElement>(null);
    const [started, setStarted] = useState(false);
    const ran = useRef(false);

    useEffect(() => {
        const body = bodyRef.current;
        if (!body || ran.current) return;
        const obs = new IntersectionObserver(
            ([e]) => {
                if (e?.isIntersecting && !ran.current) {
                    ran.current = true;
                    setStarted(true);
                    obs.disconnect();
                }
            },
            { threshold: 0.25 },
        );
        obs.observe(body);
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        if (!started) return;
        const termBody = bodyRef.current;
        if (!termBody) return;

        const run = async () => {
            await sleep(500);
            for (const line of TERMINAL_LINES) {
                if (line.type === 'gap') {
                    const g = document.createElement('div');
                    g.className = 'hp-gap';
                    termBody.appendChild(g);
                    await sleep(140);
                    continue;
                }
                if (line.type === 'cmd') {
                    const row = document.createElement('div');
                    row.className = 'hp-term-line';
                    const pr = document.createElement('span');
                    pr.className = 'hp-prompt';
                    pr.textContent = line.prompt;
                    const cmd = document.createElement('span');
                    cmd.className = 'hp-cmd';
                    row.appendChild(pr);
                    row.appendChild(cmd);
                    termBody.appendChild(row);
                    await typeChars(cmd, line.text, 22);
                    await sleep(200);
                } else if (line.type === 'out') {
                    const o = document.createElement('div');
                    o.className = 'hp-out';
                    o.textContent = line.text;
                    termBody.appendChild(o);
                    await sleep(70);
                } else if (line.type === 'success') {
                    const o = document.createElement('div');
                    o.className = 'hp-ok';
                    o.textContent = line.text;
                    termBody.appendChild(o);
                }
            }
            const last = document.createElement('div');
            last.className = 'hp-term-line';
            const pr = document.createElement('span');
            pr.className = 'hp-prompt';
            pr.textContent = '$';
            const cur = document.createElement('span');
            cur.className = 'hp-cursor';
            last.appendChild(pr);
            last.appendChild(cur);
            termBody.appendChild(last);
        };

        void run();
    }, [started]);

    return (
        <div className="hp-term hp-reveal" role="region" aria-label="Terminal demo">
            <div className="hp-term-bar" aria-hidden="true">
                <span className="hp-window-dot" style={{ background: '#ff5f57' }} />
                <span className="hp-window-dot" style={{ background: '#febc2e' }} />
                <span className="hp-window-dot" style={{ background: '#28c840' }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--hp-dim)', marginLeft: '0.35rem' }}>bash</span>
            </div>
            <div ref={bodyRef} className="hp-term-body" id="hp-terminal-body" aria-live="polite" />
        </div>
    );
}
