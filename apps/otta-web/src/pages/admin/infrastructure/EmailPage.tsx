import { api, isApiError } from '@/lib/api';
import {
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
import { listEmailTemplates } from '@ottabase/email';
import { AlertCircle, Mail } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type ProviderKey = 'devTrap' | 'resend' | 'ses' | 'nodemailer';
type ProviderInfo = { available: boolean; required: string[]; optional: string[] };
type Providers = Partial<Record<ProviderKey, ProviderInfo>>;

const PROVIDER_META: Array<{ key: ProviderKey; label: string; note: string }> = [
    { key: 'devTrap', label: 'Dev Trap', note: 'KV-backed local inbox — view at /admin/infrastructure/dev-mail.' },
    { key: 'resend', label: 'Resend', note: 'HTTP API — edge compatible.' },
    { key: 'ses', label: 'AWS SES', note: 'HTTP API — edge compatible.' },
    { key: 'nodemailer', label: 'Nodemailer (SMTP)', note: 'SMTP over TCP — Node.js only, not Cloudflare Workers.' },
];

const SEND_PROVIDERS = [
    { id: 'auto', label: 'Auto (first available)' },
    { id: 'dev-trap', label: 'Dev Trap' },
    { id: 'resend', label: 'Resend' },
    { id: 'ses', label: 'AWS SES' },
    { id: 'nodemailer', label: 'Nodemailer (SMTP)' },
] as const;

type SendProvider = (typeof SEND_PROVIDERS)[number]['id'];

/**
 * Admin > Infrastructure > Email — platform-admin surface over /api/email/{providers,test}.
 * Shows which providers are configured and sends a test email to verify delivery. Template
 * authoring/preview lives in the (non-privileged) email demo; this page is the operational test.
 */
export function AdminEmailPage() {
    const templates = useMemo(() => listEmailTemplates(), []);
    const [providers, setProviders] = useState<Providers>({});
    const [recipients, setRecipients] = useState('');
    const [template, setTemplate] = useState(templates[0] || 'default');
    const [subject, setSubject] = useState('Ottabase test email');
    const [provider, setProvider] = useState<SendProvider>('auto');
    const [status, setStatus] = useState<
        | { state: 'idle' }
        | { state: 'sending' }
        | { state: 'success'; results: Array<{ email: string; ok: boolean; provider?: string }> }
        | { state: 'error'; message: string }
    >({ state: 'idle' });

    useEffect(() => {
        api<Providers>('/api/email/providers')
            .then(setProviders)
            .catch(() => {});
    }, []);

    const handleSend = async () => {
        const list = recipients
            .split(/[\s,;]+/)
            .map((v) => v.trim())
            .filter(Boolean);
        if (!list.length) {
            setStatus({ state: 'error', message: 'Provide at least one recipient email.' });
            return;
        }
        setStatus({ state: 'sending' });
        try {
            const res = await api<{ results: Array<{ email: string; ok: boolean; provider?: string }> }>(
                '/api/email/test',
                { method: 'POST', body: { recipients: list, template, subject, provider } },
            );
            setStatus({ state: 'success', results: res.results || [] });
        } catch (err) {
            const message = isApiError(err) ? err.message : err instanceof Error ? err.message : 'Failed to send';
            setStatus({ state: 'error', message });
        }
    };

    return (
        <div className="space-y-8">
            <div className="space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Email</h1>
                <p className="max-w-3xl text-muted-foreground">
                    Check which email providers are configured and send a test email to verify delivery.
                </p>
            </div>

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Send a test email</CardTitle>
                    <CardDescription>
                        Uses the same delivery path as transactional mail (magic links, resets).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2 md:col-span-1">
                            <Label>Provider</Label>
                            <Select value={provider} onValueChange={(v) => setProvider(v as SendProvider)}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SEND_PROVIDERS.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 md:col-span-1">
                            <Label>Template</Label>
                            <Select value={template} onValueChange={setTemplate}>
                                <SelectTrigger className="bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {templates.map((name) => (
                                        <SelectItem key={name} value={name}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 md:col-span-1">
                            <Label htmlFor="subject">Subject</Label>
                            <Input
                                id="subject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="bg-background"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="recipients">Recipients</Label>
                        <Textarea
                            id="recipients"
                            value={recipients}
                            onChange={(e) => setRecipients(e.target.value)}
                            placeholder="you@example.com, teammate@example.com"
                            className="min-h-[80px] bg-background font-mono text-xs"
                        />
                    </div>

                    <Button onClick={handleSend} disabled={status.state === 'sending'} className="gap-2">
                        <Mail className="h-4 w-4" />
                        {status.state === 'sending' ? 'Sending…' : 'Send test email'}
                    </Button>

                    {status.state === 'error' && (
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            {status.message}
                        </div>
                    )}
                    {status.state === 'success' && (
                        <div className="rounded-lg bg-background p-3 text-sm ring-1 ring-border">
                            <div className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Results
                            </div>
                            <ul className="space-y-1">
                                {status.results.map((r) => (
                                    <li key={r.email}>
                                        {r.email}: {r.ok ? 'Sent' : 'Failed'}
                                        {r.provider ? ` (${r.provider})` : ''}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Provider configuration</CardTitle>
                    <CardDescription>Providers are configured via environment variables / secrets.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    {PROVIDER_META.map(({ key, label, note }) => {
                        const info = providers[key];
                        return (
                            <div key={key} className="space-y-1.5">
                                <div className="flex items-center justify-between gap-3">
                                    <strong>{label}</strong>
                                    <Badge
                                        variant="outline"
                                        className={`rounded-full border-transparent bg-background ring-1 ring-border ${
                                            info?.available ? 'text-success' : 'text-muted-foreground'
                                        }`}
                                    >
                                        {info?.available ? 'Configured' : 'Not configured'}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {note}
                                    {info?.required?.length ? (
                                        <>
                                            {' '}
                                            Required:{' '}
                                            {info.required.map((r) => (
                                                <code key={r}>{r} </code>
                                            ))}
                                        </>
                                    ) : null}
                                </p>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
