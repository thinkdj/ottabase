import Link from 'next/link';
import { AnimateOnView } from '@/components/core/AnimateOnView';

export function CtaBanner() {
    return (
        <AnimateOnView className="cta-banner" aria-labelledby="cta-heading">
            <div className="container cta-inner">
                <h2 id="cta-heading">
                    Stop rebuilding.
                    <br />
                    <span>Start shipping.</span>
                </h2>
                <p>Open source. MIT license. Yours to own, fork, and extend.</p>

                <div className="cta-actions">
                    <a
                        href="https://github.com/thinkdj/ottabase"
                        className="btn btn-primary btn-lg"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        ⭐ Star on GitHub
                    </a>
                    <Link href="/docs" className="btn btn-ghost btn-lg">
                        Get Started →
                    </Link>
                    <a
                        href="https://discord.gg/ottabase"
                        className="btn btn-ghost btn-lg"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Join Discord
                    </a>
                </div>

                <p className="cta-note">MIT License · Cloudflare Workers · TypeScript · No vendor lock-in</p>
            </div>
        </AnimateOnView>
    );
}
