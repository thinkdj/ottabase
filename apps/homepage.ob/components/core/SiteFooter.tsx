import Link from 'next/link';

export function SiteFooter() {
    return (
        <footer className="site-footer" role="contentinfo">
            <div className="container footer-inner">
                <div>
                    <div className="footer-brand">
                        otta<span>base</span>
                    </div>
                    <div className="footer-sub">The edge-native SaaS framework.</div>
                </div>

                <nav className="footer-links" aria-label="Footer navigation">
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

                <div className="footer-right" aria-label="License and copyright">
                    MIT License
                    <br />
                    Built on Cloudflare Workers
                </div>
            </div>
        </footer>
    );
}
