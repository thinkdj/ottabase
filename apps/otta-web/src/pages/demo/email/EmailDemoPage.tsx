import { APP_EMAILS, appEmail, composeAppEmail, type AppEmailId } from '@/email/catalog';
import { renderEmail } from '@ottabase/email';
import {
    Badge,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

const sampleJson = (id: AppEmailId) => JSON.stringify(appEmail(id)?.sample ?? {}, null, 2);

/** The app's own email catalogue, rendered live: pick an email, change its values, see what goes out */
export function EmailDemoPage() {
    const [emailId, setEmailId] = useState<AppEmailId>(APP_EMAILS[0].id);
    const [valuesText, setValuesText] = useState(() => sampleJson(APP_EMAILS[0].id));
    const email = appEmail(emailId) ?? APP_EMAILS[0];

    const pick = (id: AppEmailId) => {
        setEmailId(id);
        setValuesText(sampleJson(id));
    };

    const { values, parseError } = useMemo(() => {
        try {
            const parsed = valuesText.trim() ? (JSON.parse(valuesText) as Record<string, string>) : {};
            return { values: parsed, parseError: null as string | null };
        } catch (error) {
            return { values: {}, parseError: error instanceof Error ? error.message : 'Invalid JSON' };
        }
    }, [valuesText]);

    // A missing value falls back to the sample, so a half-typed JSON still renders
    const rendered = useMemo(
        () => renderEmail(composeAppEmail(email.id, { ...email.sample, ...values })),
        [email, values],
    );

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Email"
                description={
                    <>
                        Every email this app sends lives in one catalogue and renders through{' '}
                        <code>@ottabase/email</code>. This page renders the catalogue with values you can change. To
                        send a test or check the provider, use{' '}
                        <Link to="/admin/infrastructure/email">Admin → Infrastructure → Email</Link>.
                    </>
                }
            />

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Email</CardTitle>
                        <CardDescription>Pick one and edit the values it is filled with.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Select value={emailId} onValueChange={(id) => pick(id as AppEmailId)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an email" />
                                </SelectTrigger>
                                <SelectContent>
                                    {APP_EMAILS.map((entry) => (
                                        <SelectItem key={entry.id} value={entry.id}>
                                            {entry.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{email.description}</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Values</Label>
                            <Textarea
                                value={valuesText}
                                onChange={(event) => setValuesText(event.target.value)}
                                className="min-h-[200px] font-mono text-xs"
                                aria-label="Values as JSON"
                            />
                            {parseError ? (
                                <Badge variant="destructive" className="text-xs">
                                    {parseError}
                                </Badge>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    {Object.keys(email.sample).length === 0
                                        ? 'This email takes no values.'
                                        : 'The same values the worker fills in when it sends this email.'}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Preview</CardTitle>
                        <CardDescription>Subject: {rendered.subject || '(no subject)'}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="overflow-hidden rounded-lg bg-background ring-1 ring-border">
                            <iframe
                                className="email-preview block min-h-[28rem] w-full bg-background"
                                title="Rendered email"
                                sandbox=""
                                srcDoc={rendered.html}
                            />
                        </div>
                        <div className="rounded-lg bg-background p-3 text-xs text-muted-foreground ring-1 ring-border">
                            <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Plain text
                            </div>
                            <pre className="whitespace-pre-wrap break-words">{rendered.text}</pre>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
