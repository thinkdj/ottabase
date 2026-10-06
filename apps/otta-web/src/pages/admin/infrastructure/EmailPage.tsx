/**
 * Email (admin): every email this app sends, rendered as it goes out, with a test send for each,
 * and the state of the delivery providers.
 */
import { APP_EMAIL_TEMPLATE, APP_EMAILS, composeAppEmail, type AppEmail } from '@/email/catalog';
import { api, isApiError } from '@/lib/api';
import { useSession } from '@/lib/auth';
import { renderEmail } from '@ottabase/email';
import { Chip } from '@ottabase/ui-components';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    NativeSelect,
    NativeSelectOption,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Inbox, Mail, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type ProviderKey = 'devTrap' | 'resend' | 'ses' | 'nodemailer';
type ProviderInfo = { available: boolean; required: string[]; optional: string[] };
type Providers = Partial<Record<ProviderKey, ProviderInfo>>;
type SendProvider = 'auto' | 'dev-trap' | 'resend' | 'ses' | 'nodemailer';

const PROVIDERS: Array<{ key: ProviderKey; send: SendProvider; label: string; note: string }> = [
    { key: 'devTrap', send: 'dev-trap', label: 'Dev Trap', note: 'A local inbox in KV; read it on the Dev mail page.' },
    { key: 'resend', send: 'resend', label: 'Resend', note: 'HTTP API, runs on the edge.' },
    { key: 'ses', send: 'ses', label: 'AWS SES', note: 'HTTP API, runs on the edge.' },
    {
        key: 'nodemailer',
        send: 'nodemailer',
        label: 'Nodemailer (SMTP)',
        note: 'SMTP over TCP; Node only, not Workers.',
    },
];
const EYEBROW = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

export function AdminEmailPage() {
    const { user } = useSession();
    const [providers, setProviders] = useState<Providers>({});
    const [provider, setProvider] = useState<SendProvider>('auto');
    const [recipients, setRecipients] = useState('');
    const [sending, setSending] = useState<string | null>(null);

    // Sends go to the signed-in admin unless they say otherwise
    useEffect(() => {
        if (user?.email) setRecipients((current) => current || user.email!);
    }, [user?.email]);
    useEffect(() => {
        api<Providers>('/api/email/providers')
            .then(setProviders)
            .catch(() => {});
    }, []);

    const previews = useMemo(
        () => APP_EMAILS.map((email) => ({ email, rendered: renderEmail(composeAppEmail(email.id, email.sample)) })),
        [],
    );
    const list = recipients
        .split(/[\s,;]+/)
        .map((v) => v.trim())
        .filter(Boolean);

    const send = async (email: AppEmail) => {
        if (!list.length) {
            toast.error('Add a recipient first.');
            return;
        }
        setSending(email.id);
        try {
            const res = await api<{ results: Array<{ email: string; ok: boolean; provider?: string }> }>(
                '/api/email/test',
                { method: 'POST', body: { recipients: list, email: email.id, provider } },
            );
            const failed = res.results.filter((r) => !r.ok).map((r) => r.email);
            if (failed.length) toast.error(`Could not send "${email.label}" to ${failed.join(', ')}`);
            else {
                const via = res.results[0]?.provider;
                toast.success(`Sent "${email.label}" to ${list.join(', ')}${via ? ` via ${via}` : ''}`);
            }
        } catch (err) {
            toast.error(isApiError(err) ? err.message : err instanceof Error ? err.message : 'Could not send');
        } finally {
            setSending(null);
        }
    };

    return (
        <div className="space-y-8">
            <header className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <Mail className="h-7 w-7 text-primary" />
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Email</h1>
                </div>
                <p className="max-w-3xl text-muted-foreground">
                    Every email this app sends, rendered as it goes out. Send any of them to yourself to check delivery.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Delivery</CardTitle>
                    <CardDescription>
                        Test sends use the same path as real mail. Providers come from secrets.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr),14rem]">
                        <div className="space-y-2">
                            <Label htmlFor="recipients">Recipients</Label>
                            <Input
                                id="recipients"
                                value={recipients}
                                onChange={(e) => setRecipients(e.target.value)}
                                placeholder="you@example.com, teammate@example.com"
                                className="bg-background font-mono text-xs"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="provider">Provider</Label>
                            <NativeSelect
                                id="provider"
                                value={provider}
                                onChange={(e) => setProvider(e.target.value as SendProvider)}
                                wrapperClassName="w-full"
                            >
                                <NativeSelectOption value="auto">Auto (first configured)</NativeSelectOption>
                                {PROVIDERS.map((p) => (
                                    <NativeSelectOption
                                        key={p.key}
                                        value={p.send}
                                        disabled={!providers[p.key]?.available}
                                    >
                                        {p.label}
                                        {providers[p.key]?.available ? '' : ' (not configured)'}
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {PROVIDERS.map((p) => {
                            const info = providers[p.key];
                            const needs = info?.required?.length ? `Needs ${info.required.join(', ')}.` : '';
                            return (
                                <span key={p.key} title={`${p.note} ${needs}`.trim()}>
                                    <Chip dot={info?.available ? 'success' : 'muted'}>{p.label}</Chip>
                                </span>
                            );
                        })}
                        {providers.devTrap?.available && (
                            <Button asChild variant="ghost" size="sm" className="ml-auto text-muted-foreground">
                                <Link to="/admin/infrastructure/dev-mail">
                                    <Inbox className="mr-1.5 h-4 w-4" />
                                    Open Dev mail
                                </Link>
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <section className="space-y-4">
                <h2 className={EYEBROW}>What goes out</h2>
                <div className="grid gap-6 lg:grid-cols-2">
                    {previews.map(({ email, rendered }) => (
                        <Card key={email.id}>
                            <CardHeader>
                                <CardTitle className="text-[0.9375rem] font-semibold">{email.label}</CardTitle>
                                <CardDescription>{email.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm">
                                    <span className="text-muted-foreground">Subject: </span>
                                    {rendered.subject}
                                </p>
                                <iframe
                                    title={`${email.label} preview`}
                                    srcDoc={rendered.html}
                                    sandbox=""
                                    className="h-[22rem] w-full rounded-lg bg-white ring-1 ring-border"
                                />
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        {email.id}, {APP_EMAIL_TEMPLATE.name} template
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => send(email)}
                                        disabled={sending !== null}
                                        className="gap-1.5"
                                    >
                                        <Send className="h-3.5 w-3.5" />
                                        {sending === email.id ? 'Sending' : 'Send test'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}
