import { MarketingLayout } from '@/components/core/MarketingLayout';
import { HpRevealScope } from '@/components/themes/signal-horizon/HpRevealScope';
import { SignalMarketingChrome } from '@/components/themes/signal-horizon/SignalMarketingChrome';
import { siteConfig } from '@/config';
import Link from 'next/link';

export default function NotFound() {
    if (siteConfig.theme === 'signalHorizon') {
        return (
            <SignalMarketingChrome active={null}>
                <HpRevealScope>
                    <main
                        id="main"
                        className="ob-hp-container"
                        style={{
                            padding: '6rem 0',
                            textAlign: 'center',
                            minHeight: '70vh',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            boxSizing: 'border-box',
                        }}
                    >
                        <h1
                            style={{
                                fontFamily: 'var(--ob-font-display)',
                                fontSize: '2rem',
                                marginBottom: '1rem',
                            }}
                        >
                            Page not found
                        </h1>
                        <p style={{ color: 'var(--ob-muted)', marginBottom: '1.5rem' }}>
                            The page you requested does not exist.
                        </p>
                        <Link href="/" className="ob-hp-btn ob-hp-btn--primary">
                            Back home
                        </Link>
                    </main>
                </HpRevealScope>
            </SignalMarketingChrome>
        );
    }

    return (
        <MarketingLayout>
            <div
                className="container"
                style={{
                    padding: '6rem 0',
                    textAlign: 'center',
                    minHeight: '70vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                }}
            >
                <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Page not found</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    The page you requested does not exist.
                </p>
                <Link href="/" className="btn btn-primary">
                    Back home
                </Link>
            </div>
        </MarketingLayout>
    );
}
