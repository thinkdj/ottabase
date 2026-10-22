import { isPackageInstalled } from '@/ottabase/config/packages';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { DemoPageHeader } from '../DemoPageHeader';
import { DEMO_SCREENSHOT_BASE } from '../demoAccountGates';
import { PRO_PACKAGES, PRO_URL, type ProPackage } from './proPackages';

/**
 * A tour of Ottabase Pro. Where the Pro packages are installed (a Pro demo), the pages a visitor
 * can use link straight to them; the platform-admin consoles show as screenshots, because on a
 * shared demo they would hold every visitor's data.
 */
export function ProDemoPage() {
    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Ottabase Pro"
                description="Seven commercial packages for the Ottabase monorepo, sold as source. Install them with one command; no license keys, nothing gated."
                actions={
                    <Button asChild>
                        <a href={PRO_URL} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                            Pricing and details
                            <ArrowUpRight className="h-4 w-4" />
                        </a>
                    </Button>
                }
            />

            <div className="grid gap-4 lg:grid-cols-2">
                {PRO_PACKAGES.map((pkg) => (
                    <ProPackageCard key={pkg.key} pkg={pkg} />
                ))}
            </div>
        </div>
    );
}

function ProPackageCard({ pkg }: { pkg: ProPackage }) {
    const installed = isPackageInstalled(pkg.key);
    const shot = `${DEMO_SCREENSHOT_BASE}/pro/${pkg.key}`;
    return (
        <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/40">
                <img
                    src={`${shot}.webp`}
                    alt={`${pkg.name} screenshot`}
                    loading="lazy"
                    className="block w-full dark:hidden"
                />
                <img
                    src={`${shot}.dark.webp`}
                    alt={`${pkg.name} screenshot`}
                    loading="lazy"
                    className="hidden w-full dark:block"
                />
            </div>
            <CardHeader className="gap-1.5">
                <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                    {pkg.name}
                    <Badge variant="secondary" className="text-[0.625rem] font-medium uppercase tracking-wide">
                        Pro
                    </Badge>
                </CardTitle>
                <CardDescription className="leading-relaxed">{pkg.summary}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
                {installed && pkg.tryIt ? (
                    pkg.tryIt.map((link) => (
                        <Button key={link.path} asChild variant="outline" size="sm">
                            <Link to={link.path}>{link.label}</Link>
                        </Button>
                    ))
                ) : (
                    <p className="text-xs text-muted-foreground">
                        {installed
                            ? 'A platform-admin console, so this shared demo shows it as a screenshot.'
                            : 'Part of Ottabase Pro. Not installed in this deployment.'}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
