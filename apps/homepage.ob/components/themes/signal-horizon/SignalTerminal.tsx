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
                    g.className = 'ob-hp-gap';
                    termBody.appendChild(g);
                    await sleep(140);
                    continue;
                }
                if (line.type === 'cmd') {
                    const row = document.createElement('div');
                    row.className = 'ob-hp-term-line';
                    const pr = document.createElement('span');
                    pr.className = 'ob-hp-prompt';
                    pr.textContent = line.prompt;
                    const cmd = document.createElement('span');
                    cmd.className = 'ob-hp-cmd';
                    row.appendChild(pr);
                    row.appendChild(cmd);
                    termBody.appendChild(row);
                    await typeChars(cmd, line.text, 22);
                    await sleep(200);
                } else if (line.type === 'out') {
                    const o = document.createElement('div');
                    o.className = 'ob-hp-out';
                    const check = /^(\s*✓\s+)(.*)$/.exec(line.text);
                    if (check) {
                        const mark = document.createElement('span');
                        mark.className = 'ob-hp-out-mark';
                        mark.textContent = check[1];
                        const rest = document.createElement('span');
                        rest.className = 'ob-hp-out-rest';
                        rest.textContent = check[2];
                        o.appendChild(mark);
                        o.appendChild(rest);
                    } else {
                        const plain = document.createElement('span');
                        plain.className = 'ob-hp-out-plain';
                        plain.textContent = line.text;
                        o.appendChild(plain);
                    }
                    termBody.appendChild(o);
                    await sleep(70);
                } else if (line.type === 'success') {
                    const o = document.createElement('div');
                    o.className = 'ob-hp-ok';
                    o.textContent = line.text;
                    termBody.appendChild(o);
                }
            }
            const last = document.createElement('div');
            last.className = 'ob-hp-term-line';
            const pr = document.createElement('span');
            pr.className = 'ob-hp-prompt';
            pr.textContent = '$';
            const cur = document.createElement('span');
            cur.className = 'ob-hp-cursor';
            last.appendChild(pr);
            last.appendChild(cur);
            termBody.appendChild(last);
        };

        void run();
    }, [started]);

    return (
        <div className="ob-hp-term ob-hp-reveal" role="region" aria-label="Terminal demo">
            <div className="ob-hp-term-bar" aria-hidden="true">
                <span className="ob-hp-window-dot" style={{ background: '#ff5f57' }} />
                <span className="ob-hp-window-dot" style={{ background: '#febc2e' }} />
                <span className="ob-hp-window-dot" style={{ background: '#28c840' }} />
                <span className="ob-hp-term-bar-title">bash</span>
            </div>
            <div ref={bodyRef} className="ob-hp-term-body" id="ob-hp-terminal-body" aria-live="polite" />
        </div>
    );
}
