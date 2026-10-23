import { listLegalDocuments, validateLegalConfig, type LegalDocId, type LegalFeatures } from '@ottabase/legal';
import { LegalDocument } from '@ottabase/legal/react';
import '@ottabase/legal/styles.css';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Switch } from '@ottabase/ui';
import { Link } from '@tanstack/react-router';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { legalConfig } from '../../../../ottabase/legal.config';
import { DemoPageHeader } from '../DemoPageHeader';

/** The clause toggles, in the order a founder thinks about them. */
const FEATURES: Array<{ key: keyof LegalFeatures; label: string }> = [
    { key: 'paidPlans', label: 'Paid plans' },
    { key: 'freeTrial', label: 'Free trial' },
    { key: 'lifetimePlans', label: 'Lifetime plans' },
    { key: 'userContent', label: 'User content' },
    { key: 'organizations', label: 'Organizations' },
    { key: 'api', label: 'Public API' },
    { key: 'ai', label: 'AI processing' },
    { key: 'cookies', label: 'Cookies' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'email', label: 'Marketing email' },
    { key: 'children', label: 'Made for children' },
    { key: 'eu', label: 'EU / UK users (GDPR)' },
    { key: 'california', label: 'California users (CCPA)' },
];

export function LegalDemoPage() {
    const [features, setFeatures] = useState<LegalFeatures>(legalConfig.features ?? {});
    const [selected, setSelected] = useState<LegalDocId>('terms');

    // Only the features change here; the rest is the app's real ottabase/legal.config.ts.
    const config = useMemo(() => ({ ...legalConfig, features }), [features]);
    const docs = listLegalDocuments(config);
    const gaps = validateLegalConfig(config);
    // Turning a feature off can unpublish the open document (Refunds without paid plans).
    const docId = docs.some((doc) => doc.id === selected) ? selected : (docs[0]?.id ?? 'terms');

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Legal Pages"
                description="@ottabase/legal: Terms, Privacy, Cookies, Acceptable Use, Refunds and Sub-processors from one config. Toggle what the app does and the clauses follow."
                actions={
                    <Button asChild variant="outline" size="sm">
                        <Link to={'/legal' as '/'}>
                            Live pages <ExternalLink className="size-3.5" />
                        </Link>
                    </Button>
                }
            />

            <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                            <div>
                                <CardTitle>What the app does</CardTitle>
                                <CardDescription>Each switch adds or drops clauses.</CardDescription>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Reset to the app's config"
                                onClick={() => setFeatures(legalConfig.features ?? {})}
                            >
                                <RotateCcw className="size-4" />
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {FEATURES.map(({ key, label }) => (
                                <div key={key} className="flex items-center justify-between gap-3">
                                    <Label htmlFor={`legal-${key}`} className="font-normal">
                                        {label}
                                    </Label>
                                    <Switch
                                        id={`legal-${key}`}
                                        checked={Boolean(features[key])}
                                        onCheckedChange={(on) => setFeatures((prev) => ({ ...prev, [key]: on }))}
                                    />
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Config gaps</CardTitle>
                            <CardDescription>
                                The package's health check reports these until they are fixed.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {gaps.length ? (
                                <ul className="list-disc space-y-1 pl-4 text-sm text-subtle-foreground">
                                    {gaps.map((gap) => (
                                        <li key={gap}>{gap}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">None. Have counsel read it anyway.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Also served as</CardTitle>
                            <CardDescription>The Worker renders the same documents.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-1 font-mono text-xs">
                            {['/api/legal', `/api/legal/${docs.find((d) => d.id === docId)?.slug ?? 'terms'}.md`].map(
                                (href) => (
                                    <a key={href} href={href} target="_blank" rel="noreferrer" className="block">
                                        {href}
                                    </a>
                                ),
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Documents">
                        {docs.map((doc) => (
                            <Button
                                key={doc.id}
                                role="tab"
                                aria-selected={doc.id === docId}
                                size="sm"
                                variant={doc.id === docId ? 'default' : 'outline'}
                                onClick={() => setSelected(doc.id)}
                            >
                                {doc.title}
                            </Button>
                        ))}
                    </div>
                    <Card className="overflow-hidden">
                        <LegalDocument docId={docId} config={config} />
                    </Card>
                    <p className="text-xs text-muted-foreground">
                        A conventional starting point, not legal advice. Edit ottabase/legal.config.ts to change the
                        real pages.
                    </p>
                </div>
            </div>
        </div>
    );
}
