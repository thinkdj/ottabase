'use client';

import { TERMINAL_LINES } from '@/lib/terminal-lines';
import { useEffect, useRef, useState } from 'react';

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function typeChars(el: HTMLSpanElement, text: string, speed = 28) {
    for (const ch of text) {
        el.textContent += ch;
        await sleep(speed + Math.random() * 12);
    }
}

export function TerminalDemo() {
    const bodyRef = useRef<HTMLDivElement>(null);
    const [started, setStarted] = useState(false);
    const ran = useRef(false);

    useEffect(() => {
        const body = bodyRef.current;
        if (!body || ran.current) return;

        const obs = new IntersectionObserver(
            ([entry]) => {
                if (!entry?.isIntersecting || ran.current) return;
                ran.current = true;
                setStarted(true);
                obs.disconnect();
            },
            { threshold: 0.3 },
        );
        obs.observe(body);
        return () => obs.disconnect();
    }, []);

    useEffect(() => {
        if (!started) return;
        const terminalBody = bodyRef.current;
        if (!terminalBody) return;

        const run = async () => {
            await sleep(600);
            for (const line of TERMINAL_LINES) {
                const row = document.createElement('div');

                if (line.type === 'gap') {
                    row.className = 'terminal-gap';
                    terminalBody.appendChild(row);
                    await sleep(160);
                    continue;
                }

                if (line.type === 'cmd') {
                    row.className = 'terminal-line';
                    const prompt = document.createElement('span');
                    prompt.className = 'terminal-prompt';
                    prompt.textContent = line.prompt;
                    const cmd = document.createElement('span');
                    cmd.className = 'terminal-cmd';
                    row.appendChild(prompt);
                    row.appendChild(cmd);
                    terminalBody.appendChild(row);
                    await typeChars(cmd, line.text, 24);
                    await sleep(220);
                } else if (line.type === 'out') {
                    const out = document.createElement('div');
                    out.className = 'terminal-out';
                    out.textContent = line.text;
                    terminalBody.appendChild(out);
                    await sleep(80);
                } else if (line.type === 'success') {
                    const s = document.createElement('div');
                    s.className = 'terminal-success';
                    s.textContent = line.text;
                    terminalBody.appendChild(s);
                }
            }

            const cursor = document.createElement('span');
            cursor.className = 'cursor';
            const lastLine = document.createElement('div');
            lastLine.className = 'terminal-line';
            const prompt = document.createElement('span');
            prompt.className = 'terminal-prompt';
            prompt.textContent = '$';
            lastLine.appendChild(prompt);
            lastLine.appendChild(cursor);
            terminalBody.appendChild(lastLine);
        };

        void run();
    }, [started]);

    return (
        <div className="terminal" role="region" aria-label="Interactive terminal demo">
            <div className="terminal-bar" aria-hidden="true">
                <span className="code-window-dot" style={{ background: '#ef4444' }} />
                <span className="code-window-dot" style={{ background: '#f59e0b' }} />
                <span className="code-window-dot" style={{ background: '#10b981' }} />
                <span className="terminal-title">bash</span>
            </div>
            <div
                ref={bodyRef}
                className="terminal-body"
                id="terminal-body"
                aria-live="polite"
                aria-label="Terminal output"
            />
        </div>
    );
}
