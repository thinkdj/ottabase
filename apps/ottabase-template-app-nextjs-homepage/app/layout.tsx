import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
    title: 'Ottabase Next.js Homepage Template',
    description: 'A barebone Next.js homepage template with OpenNext and Cloudflare Workers deployment',
    keywords: ['nextjs', 'cloudflare', 'workers', 'opennext', 'homepage', 'template', 'brand-engine'],
    robots: 'index, follow',
    authors: [{ name: 'Ottabase' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
