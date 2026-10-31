import { api, isApiError } from '@/lib/api';
import { TURNSTILE_TEST_KEYS } from '@ottabase/cf/turnstile';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    NativeSelect,
    NativeSelectOption,
    StatusChip,
} from '@ottabase/ui';
import { turnstileSiteKey, useTurnstile } from '@ottabase/ui/turnstile';
import { useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

type Mode = 'app' | 'pass' | 'block' | 'interactive';

/** Each mode's site key; the demo route pairs it with the matching secret. */
const MODES: Array<{ value: Mode; label: string; siteKey: string | null; hint: string }> = [
    {
        value: 'pass',
        label: 'Test key: always passes',
        siteKey: TURNSTILE_TEST_KEYS.site.pass,
        hint: 'What a person sees on a form: the check passes on its own.',
    },
    {
        value: 'interactive',
        label: 'Test key: asks for a click',
        siteKey: TURNSTILE_TEST_KEYS.site.interactive,
        hint: 'The challenge Cloudflare shows when it is unsure about a visitor.',
    },
    {
        value: 'block',
        label: 'Test key: always blocked',
        siteKey: TURNSTILE_TEST_KEYS.site.block,
        hint: 'What a bot gets: no usable token, so the form is refused.',
    },
];

/** What the server said about the token, as a form's route would decide. */
interface Verdict {
    mode: Mode;
    ok: boolean;
    reason?: string;
    codes?: string[];
}

const REASONS: Record<string, string> = {
    missing: 'No token was sent: the widget had not finished or could not run.',
    invalid: 'Cloudflare refused the token.',
    spent: 'The token was already used. Each one works once.',
    action: 'The token was made for another form.',
    hostname: 'The token was made on another site.',
    unavailable: 'Cloudflare could not be reached.',
};

/** The forms the check guards, for the "where it runs" list. */
const GUARDED = [
    'Sign in (password and magic link)',
    'Create an account',
    'Reset a password',
    'Resend the verification mail',
    'Unlock a protected post',
    'Comment without an account',
    'Landing page lead form',
    'Newsletter and status page subscribe (Pro)',
];

export function CloudflareTurnstileDemoPage() {
    const appKey = turnstileSiteKey();
    const modes = appKey
        ? [
              {
                  value: 'app' as Mode,
                  label: "This app's keys",
                  siteKey: appKey,
                  hint: 'The real widget, checked with TURNSTILE_SECRET_KEY.',
              },
              ...MODES,
          ]
        : MODES;
    const [mode, setMode] = useState<Mode>(modes[0].value);
    const current = modes.find((entry) => entry.value === mode) ?? modes[0];

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Turnstile"
                description="Cloudflare's bot check on every form a stranger can submit, checked on the server."
                backTo="/demo/cloudflare"
                backLabel="Back to Cloudflare Features"
                actions={
                    appKey ? (
                        <StatusChip tone="green">On in this app</StatusChip>
                    ) : (
                        <StatusChip tone="smoke">Off in this app</StatusChip>
                    )
                }
            />

            <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                    {appKey
                        ? 'Public forms here check for bots. Most people never see the widget; Cloudflare shows a challenge only when it is unsure.'
                        : 'Bot checks turn on when both TURNSTILE_SITE_KEY (a var in wrangler.jsonc) and TURNSTILE_SECRET_KEY (a secret) are set. Until then every form works without them. The test keys below work anywhere, localhost included.'}
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Try the check</CardTitle>
                    <CardDescription>
                        Pick a key, let the widget run, then submit. The server verifies the token the way a form&apos;s
                        route does.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="turnstile-mode" className="text-sm font-medium">
                            Key
                        </label>
                        <NativeSelect
                            id="turnstile-mode"
                            value={mode}
                            onChange={(event) => setMode(event.target.value as Mode)}
                        >
                            {modes.map((entry) => (
                                <NativeSelectOption key={entry.value} value={entry.value}>
                                    {entry.label}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                        <p className="text-xs text-muted-foreground">{current.hint}</p>
                    </div>
                    {/* Keyed by mode: a new key is a new widget. */}
                    <DemoForm key={current.value} mode={current.value} siteKey={current.siteKey} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Where it runs</CardTitle>
                    <CardDescription>
                        Each form has its own action, so a token made on one is refused by every other. Signed-in
                        visitors skip the check where a form allows them.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="grid gap-2 text-sm sm:grid-cols-2">
                        {GUARDED.map((form) => (
                            <li key={form} className="rounded-lg bg-muted/40 px-3 py-2">
                                {form}
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Add it to a form</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-x-auto rounded-lg bg-muted/40 p-4 text-xs leading-relaxed">
                        <code>{`// The page
const human = useTurnstile('contact');            // @ottabase/ui/turnstile
{human.widget}                                    // above the submit button
await fetch('/api/contact', { method: 'POST', headers: await human.headers(), body });

// The route
const denied = await guardPublicForm(request, env, {
    action: 'contact', key: \`contact:\${ip}\`, unreachable: 'refuse',
});
if (denied) return denied;`}</code>
                    </pre>
                </CardContent>
            </Card>
        </div>
    );
}

function DemoForm({ mode, siteKey }: { mode: Mode; siteKey: string | null }) {
    const human = useTurnstile('demo', { siteKey, appearance: 'always', waitMs: 5000 });
    const [verdict, setVerdict] = useState<Verdict | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        setError(null);
        setVerdict(null);
        try {
            const { data } = await api<{ data: Verdict }>('/api/cloudflare/turnstile', {
                method: 'POST',
                headers: await human.headers(),
                body: { mode },
            });
            setVerdict(data);
        } catch (err) {
            setError(isApiError(err) ? err.message : 'The request failed. Check your connection.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-4">
            {human.widget}
            <Button onClick={submit} disabled={busy} className="w-full">
                {busy ? 'Checking...' : 'Submit'}
            </Button>
            {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </div>
            ) : null}
            {verdict ? (
                <div className="space-y-2 rounded-lg bg-background p-4 ring-1 ring-border">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                            {verdict.ok ? 'A person: the form would go through' : 'Refused: the form would answer 403'}
                        </span>
                        <StatusChip tone={verdict.ok ? 'green' : 'red'}>{verdict.ok ? 'Passed' : 'Failed'}</StatusChip>
                    </div>
                    {!verdict.ok && verdict.reason ? (
                        <p className="text-sm text-muted-foreground">{REASONS[verdict.reason] ?? verdict.reason}</p>
                    ) : null}
                    {verdict.codes?.length ? (
                        <p className="font-mono text-xs text-muted-foreground">{verdict.codes.join(', ')}</p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
