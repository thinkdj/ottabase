import Link from 'next/link';

export function SignalFooter() {
    return (
        <footer className="hp-footer">
            <div className="hp-container hp-footer-inner">
                <div>
                    <div className="hp-mark" style={{ marginBottom: '0.35rem' }}>
                        <span className="hp-mark-ot">otta</span>
                        <span className="hp-mark-base">base</span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--hp-dim)' }}>Edge-native SaaS framework</p>
                </div>
                <nav aria-label="Footer">
                    <Link href="/packages">Packages</Link>
                    <Link href="/philosophy">Philosophy</Link>
                    <Link href="/docs">Docs</Link>
                    <a href="https://github.com/thinkdj/ottabase" target="_blank" rel="noopener noreferrer">
                        GitHub
                    </a>
                    <a href="https://discord.gg/ottabase" target="_blank" rel="noopener noreferrer">
                        Discord
                    </a>
                    <a href="https://twitter.com/ottabase" target="_blank" rel="noopener noreferrer">
                        Twitter
                    </a>
                </nav>
                <div className="hp-footer-meta">
                    MIT License
                    <br />
                    Built for Cloudflare Workers
                </div>
            </div>
        </footer>
    );
}
