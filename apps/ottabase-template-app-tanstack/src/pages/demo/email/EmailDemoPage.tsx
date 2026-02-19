import { registerAppEmailTemplates } from '@/email/templates';
import { listEmailTemplates, renderEmail } from '@ottabase/email';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { AlertCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

registerAppEmailTemplates();

const EMAIL_TYPES = [
    {
        id: 'login',
        label: 'Login Link',
        description: 'Magic link sign-in email',
        subject: 'Sign in to {{appName}}',
        content: {
            header: 'Sign in to {{appName}}',
            body:
                '<p>Hi {{name}},</p>' +
                '<p>Click the link below to sign in:</p>' +
                '<p><a href="{{url}}">Sign in to {{appName}}</a></p>',
            footer: '<p>This link expires at {{expiresAt}}.</p>',
        },
        variables: {
            appName: 'Ottabase',
            name: 'Ada Lovelace',
            url: 'https://example.com/magic-login',
            expiresAt: '2026-01-18T12:00:00Z',
        },
    },
    {
        id: 'welcome',
        label: 'Welcome',
        description: 'New account welcome email',
        subject: 'Welcome to {{appName}}',
        content: {
            header: 'Welcome to {{appName}}',
            body: '<p>Hey {{name}},</p>' + '<p>Your account is ready. You can now explore your dashboard.</p>',
            footer: '<p>Need help? Reply to this email anytime.</p>',
        },
        variables: {
            appName: 'Ottabase',
            name: 'Ada Lovelace',
        },
    },
    {
        id: 'reset',
        label: 'Password Reset',
        description: 'Password reset email',
        subject: 'Reset your {{appName}} password',
        content: {
            header: 'Reset your password',
            body:
                '<p>We received a request to reset your password.</p>' + '<p><a href="{{url}}">Reset password</a></p>',
            footer: '<p>If you didn’t request this, you can ignore this email.</p>',
        },
        variables: {
            appName: 'Ottabase',
            url: 'https://example.com/reset-password',
        },
    },
] as const;

export function EmailDemoPage() {
    const templateOptions = useMemo(() => listEmailTemplates(), []);
    const [templateName, setTemplateName] = useState(templateOptions[0] || 'default');
    const [emailType, setEmailType] = useState<string>(EMAIL_TYPES[0].id);
    const [variablesText, setVariablesText] = useState(JSON.stringify(EMAIL_TYPES[0].variables, null, 2));
    const [subjectText, setSubjectText] = useState<string>(EMAIL_TYPES[0].subject);
    const [headerText, setHeaderText] = useState<string>(EMAIL_TYPES[0].content.header || '');
    const [bodyText, setBodyText] = useState<string>(EMAIL_TYPES[0].content.body);
    const [footerText, setFooterText] = useState<string>(EMAIL_TYPES[0].content.footer || '');
    const [recipientCsv, setRecipientCsv] = useState('test1@example.com, test2@example.com');
    const [sendStatus, setSendStatus] = useState<
        | { state: 'idle' }
        | { state: 'sending' }
        | { state: 'success'; results: Array<{ email: string; ok: boolean }> }
        | { state: 'error'; message: string }
    >({ state: 'idle' });
    const [selectedProvider, setSelectedProvider] = useState<'auto' | 'resend' | 'ses' | 'nodemailer'>('auto');
    const [providers, setProviders] = useState<{
        resend?: { available: boolean; required: string[]; optional: string[] };
        ses?: { available: boolean; required: string[]; optional: string[] };
        nodemailer?: {
            available: boolean;
            required: string[];
            optional: string[];
        };
    }>({});

    const selectedType = useMemo(
        () => EMAIL_TYPES.find((type) => type.id === emailType) || EMAIL_TYPES[0],
        [emailType],
    );

    useEffect(() => {
        setVariablesText(JSON.stringify(selectedType.variables, null, 2));
        setSubjectText(selectedType.subject);
        setHeaderText(selectedType.content.header || '');
        setBodyText(selectedType.content.body);
        setFooterText(selectedType.content.footer || '');
    }, [selectedType]);

    useEffect(() => {
        fetch('/api/email/providers')
            .then((res) => res.json())
            .then((data) => setProviders(data))
            .catch(() => {});
    }, []);

    const contentDraft = useMemo(
        () => ({
            header: headerText,
            body: bodyText,
            footer: footerText,
        }),
        [headerText, bodyText, footerText],
    );

    const { parsedVariables, parseError } = useMemo(() => {
        try {
            const parsed = variablesText ? JSON.parse(variablesText) : {};
            return {
                parsedVariables: parsed as Record<string, unknown>,
                parseError: null as string | null,
            };
        } catch (error) {
            return {
                parsedVariables: {},
                parseError: error instanceof Error ? error.message : 'Invalid JSON in variables',
            };
        }
    }, [variablesText]);

    const rendered = useMemo(() => {
        return renderEmail({
            template: templateName,
            variables: parsedVariables,
            content: contentDraft,
            subject: subjectText,
        });
    }, [templateName, parsedVariables, contentDraft, subjectText]);

    const handleSendTest = async () => {
        if (parseError) {
            setSendStatus({
                state: 'error',
                message: 'Fix JSON errors before sending.',
            });
            return;
        }

        const recipients = recipientCsv
            .split(/[\s,;]+/)
            .map((value) => value.trim())
            .filter(Boolean);

        if (!recipients.length) {
            setSendStatus({
                state: 'error',
                message: 'Provide at least one email address.',
            });
            return;
        }

        setSendStatus({ state: 'sending' });

        try {
            const response = await fetch('/api/email/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients,
                    template: templateName,
                    emailType,
                    subject: subjectText,
                    content: contentDraft,
                    variables: parsedVariables,
                    provider: selectedProvider,
                }),
            });

            const json = (await response.json().catch(() => null)) as {
                error?: string;
                results?: Array<{ email: string; ok: boolean }>;
            } | null;

            if (!response.ok) {
                throw new Error(json?.error || 'Failed to send test emails');
            }

            setSendStatus({
                state: 'success',
                results: json?.results || [],
            });
        } catch (error) {
            setSendStatus({
                state: 'error',
                message: error instanceof Error ? error.message : 'Failed to send emails',
            });
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
                <Button asChild variant="ghost" className="w-fit">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>
                <h1 className="text-3xl font-semibold">Email Templates</h1>
                <p className="text-muted-foreground">
                    Preview how @ottabase/email renders templates with replacement data.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <Card>
                    <CardHeader>
                        <CardTitle>Template Settings</CardTitle>
                        <CardDescription>Choose a template + email type and adjust the variables JSON.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label>Template</Label>
                            <Select value={templateName} onValueChange={setTemplateName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {templateOptions.map((name) => (
                                        <SelectItem key={name} value={name}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Email Type</Label>
                            <Select value={emailType} onValueChange={setEmailType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an email type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {EMAIL_TYPES.map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{selectedType.description}</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input
                                value={subjectText}
                                onChange={(event) => setSubjectText(event.target.value)}
                                className="text-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Header</Label>
                            <Textarea
                                value={headerText}
                                onChange={(event) => setHeaderText(event.target.value)}
                                className="min-h-[80px] font-mono text-xs"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Body</Label>
                            <Textarea
                                value={bodyText}
                                onChange={(event) => setBodyText(event.target.value)}
                                className="min-h-[180px] font-mono text-xs"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Footer</Label>
                            <Textarea
                                value={footerText}
                                onChange={(event) => setFooterText(event.target.value)}
                                className="min-h-[100px] font-mono text-xs"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Replacement JSON</Label>
                            <Textarea
                                value={variablesText}
                                onChange={(event) => setVariablesText(event.target.value)}
                                className="min-h-[220px] font-mono text-xs"
                            />
                            {parseError ? (
                                <Badge variant="destructive" className="text-xs">
                                    {parseError}
                                </Badge>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Parsed replacements are used by Handlebars.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Rendered Preview</CardTitle>
                        <CardDescription>Subject: {rendered.subject || '(no subject)'}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                            <div className="email-preview" dangerouslySetInnerHTML={{ __html: rendered.html }} />
                        </div>
                        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                            <div className="font-semibold text-foreground">Plain Text</div>
                            <pre className="whitespace-pre-wrap break-words">{rendered.text}</pre>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Send Test Emails</CardTitle>
                    <CardDescription>
                        Enter comma-separated email addresses to send the current template.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Email Provider</Label>
                        <Select
                            value={selectedProvider}
                            onValueChange={(value) =>
                                setSelectedProvider(value as 'auto' | 'resend' | 'ses' | 'nodemailer')
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">Auto (use first available)</SelectItem>
                                <SelectItem value="resend">Resend</SelectItem>
                                <SelectItem value="ses">AWS SES</SelectItem>
                                <SelectItem value="nodemailer">Nodemailer (SMTP)</SelectItem>
                            </SelectContent>
                        </Select>
                        {selectedProvider !== 'auto' &&
                            providers[selectedProvider] &&
                            !providers[selectedProvider]?.available && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Provider not configured</AlertTitle>
                                    <AlertDescription className="text-xs">
                                        Missing required environment variables:{' '}
                                        {providers[selectedProvider]?.required.join(', ')}
                                    </AlertDescription>
                                </Alert>
                            )}
                        {selectedProvider !== 'auto' && providers[selectedProvider]?.available && (
                            <Badge variant="outline" className="text-xs">
                                ✓ Configured and ready
                            </Badge>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Recipients (CSV)</Label>
                        <Textarea
                            value={recipientCsv}
                            onChange={(event) => setRecipientCsv(event.target.value)}
                            className="min-h-[100px] font-mono text-xs"
                        />
                    </div>

                    <Button
                        onClick={handleSendTest}
                        disabled={
                            sendStatus.state === 'sending' ||
                            (selectedProvider !== 'auto' &&
                                providers[selectedProvider] &&
                                !providers[selectedProvider]?.available)
                        }
                    >
                        {sendStatus.state === 'sending' ? 'Sending…' : 'Send Test Email'}
                    </Button>

                    {sendStatus.state === 'error' && <Badge variant="destructive">{sendStatus.message}</Badge>}

                    {sendStatus.state === 'success' && (
                        <div className="rounded-md border p-3 text-sm">
                            <div className="font-semibold">Results</div>
                            <ul className="mt-2 space-y-1">
                                {sendStatus.results.map((result) => (
                                    <li key={result.email}>
                                        {result.email}: {result.ok ? 'Sent' : 'Failed'}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Email Provider Configuration</CardTitle>
                    <CardDescription>Configure one or more email providers via environment variables.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <strong>Resend</strong> (HTTP API - Edge Compatible)
                            </div>
                            {providers.resend?.available ? (
                                <Badge variant="outline">✓ Configured</Badge>
                            ) : (
                                <Badge variant="destructive">Not configured</Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                            Required: <code>EMAIL_RESEND_API_KEY</code>
                            <br />
                            Optional: <code>EMAIL_FROM</code>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <strong>AWS SES</strong> (HTTP API - Edge Compatible)
                            </div>
                            {providers.ses?.available ? (
                                <Badge variant="outline">✓ Configured</Badge>
                            ) : (
                                <Badge variant="destructive">Not configured</Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                            Required: <code>AWS_ACCESS_KEY_ID</code>, <code>AWS_SECRET_ACCESS_KEY</code>
                            <br />
                            Optional: <code>AWS_REGION</code>, <code>EMAIL_FROM</code>
                        </p>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <strong>Nodemailer</strong> (SMTP - Node.js only)
                            </div>
                            {providers.nodemailer?.available ? (
                                <Badge variant="outline">✓ Configured</Badge>
                            ) : (
                                <Badge variant="destructive">Not configured</Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground text-xs">
                            Required: <code>EMAIL_SERVER</code> (SMTP URL)
                            <br />
                            Optional: <code>EMAIL_FROM</code>
                            <br />
                            <span className="text-yellow-600 dark:text-yellow-400">
                                ⚠️ Note: Nodemailer requires Node.js and won't work in Cloudflare Workers
                            </span>
                        </p>
                    </div>

                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-800 dark:bg-blue-950">
                        <p className="font-semibold text-blue-900 dark:text-blue-100">Edge Compatibility</p>
                        <p className="mt-1 text-blue-700 dark:text-blue-300">
                            Resend and AWS SES use HTTP APIs and work perfectly in Cloudflare Workers. Nodemailer uses
                            SMTP (TCP sockets) and only works in Node.js environments.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
