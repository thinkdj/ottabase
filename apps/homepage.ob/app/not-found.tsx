import Link from 'next/link';
import { MarketingLayout } from '@/components/core/MarketingLayout';

export default function NotFound() {
    return (
        <MarketingLayout>
            <div className="container" style={{ padding: '6rem 0', textAlign: 'center' }}>
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
