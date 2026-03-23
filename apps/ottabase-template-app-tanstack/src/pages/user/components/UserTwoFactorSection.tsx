import { useSession } from '@/lib/auth';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Separator,
} from '@ottabase/ui-shadcn';
import { startRegistration } from '@simplewebauthn/browser';
import { IconKey, IconQrcode } from '@tabler/icons-react';
import { QRCodeSVG } from 'react-qr-code';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type Status = {
    totpEnabled: boolean;
    passkeyCount: number;
    passkeys: Array<{ id: string; credentialId: string; createdAt?: unknown; deviceType?: string }>;
};

export function UserTwoFactorSection() {
    const { isAuthenticated } = useSession();
    const [status, setStatus] = useState<Status | null>(null);
    const [loading, setLoading] = useState(false);

    const [totpOpen, setTotpOpen] = useState(false);
    const [totpSecret, setTotpSecret] = useState('');
    const [otpauthUrl, setOtpauthUrl] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

    const [disableOpen, setDisableOpen] = useState(false);
    const [disablePassword, setDisablePassword] = useState('');
    const [disableTotp, setDisableTotp] = useState('');

    const [removeCred, setRemoveCred] = useState<{ credentialId: string } | null>(null);
    const [removePassword, setRemovePassword] = useState('');

    const load = useCallback(async () => {
        if (!isAuthenticated) return;
        const r = await fetch('/api/auth/two-factor/status', { credentials: 'include' });
        if (!r.ok) return;
        const d = (await r.json()) as Status;
        setStatus(d);
    }, [isAuthenticated]);

    useEffect(() => {
        void load();
    }, [load]);

    const startTotpSetup = async () => {
        setLoading(true);
        setBackupCodes(null);
        try {
            const r = await fetch('/api/auth/two-factor/totp/setup', {
                method: 'POST',
                credentials: 'include',
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d?.message || 'Could not start setup');
            setTotpSecret(d.secret);
            setOtpauthUrl(d.otpauthUrl);
            setTotpCode('');
            setTotpOpen(true);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Setup failed');
        } finally {
            setLoading(false);
        }
    };

    const enableTotp = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/auth/two-factor/totp/enable', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: totpCode.replace(/\s/g, '') }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d?.message || 'Invalid code');
            setBackupCodes(d.backupCodes || []);
            toast.success('Authenticator app enabled');
            setTotpOpen(false);
            setTotpSecret('');
            setOtpauthUrl('');
            await load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not enable');
        } finally {
            setLoading(false);
        }
    };

    const submitTotpDisable = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/auth/two-factor/totp/disable', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: disablePassword, totpCode: disableTotp.replace(/\s/g, '') }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d?.message || 'Could not disable');
            toast.success('Authenticator app removed');
            setDisableOpen(false);
            setDisablePassword('');
            setDisableTotp('');
            await load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not disable');
        } finally {
            setLoading(false);
        }
    };

    const registerPasskey = async () => {
        setLoading(true);
        try {
            const optRes = await fetch('/api/auth/webauthn/register/options', {
                method: 'POST',
                credentials: 'include',
            });
            const options = await optRes.json();
            if (!optRes.ok) throw new Error(options?.message || 'Could not start passkey registration');

            const att = await startRegistration({ optionsJSON: options });
            const verifyRes = await fetch('/api/auth/webauthn/register/verify', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: att }),
            });
            const d = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(d?.message || 'Verification failed');
            toast.success('Passkey registered (Windows Hello, Touch ID, or security key)');
            await load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Passkey registration failed');
        } finally {
            setLoading(false);
        }
    };

    const removePasskey = async () => {
        if (!removeCred) return;
        setLoading(true);
        try {
            const r = await fetch('/api/auth/webauthn/credential/remove', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentialId: removeCred.credentialId, password: removePassword }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d?.message || 'Could not remove');
            toast.success('Passkey removed');
            setRemoveCred(null);
            setRemovePassword('');
            await load();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Could not remove');
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) return null;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Two-factor authentication and passkeys</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 font-medium">
                                <IconQrcode className="h-4 w-4 text-muted-foreground" />
                                Authenticator app (TOTP)
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Use Google Authenticator, 1Password, or another TOTP app.
                            </p>
                            {status?.totpEnabled && (
                                <p className="text-xs text-green-600 dark:text-green-400">Enabled</p>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                            {!status?.totpEnabled ? (
                                <Button onClick={startTotpSetup} disabled={loading} size="sm" variant="outline">
                                    Set up
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => setDisableOpen(true)}
                                    disabled={loading}
                                    size="sm"
                                    variant="outline"
                                >
                                    Disable
                                </Button>
                            )}
                        </div>
                    </div>

                    <Separator />

                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 font-medium">
                                <IconKey className="h-4 w-4 text-muted-foreground" />
                                Passkeys (Windows Hello, Touch ID, security key)
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Sign in faster with a device-bound key or roaming security key.
                            </p>
                            {status && status.passkeyCount > 0 && (
                                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                                    {status.passkeys.map((p) => (
                                        <li key={p.id} className="flex flex-wrap items-center gap-2">
                                            <span>{p.deviceType || 'Passkey'}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-destructive"
                                                onClick={() => setRemoveCred({ credentialId: p.credentialId })}
                                            >
                                                Remove
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <Button onClick={registerPasskey} disabled={loading} size="sm" variant="outline">
                            Add passkey
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={totpOpen} onOpenChange={setTotpOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Set up authenticator</DialogTitle>
                        <DialogDescription>
                            Scan the QR code with your app, then enter the 6-digit code to confirm.
                        </DialogDescription>
                    </DialogHeader>
                    {otpauthUrl && (
                        <div className="flex justify-center p-4 bg-background rounded-lg border border-border">
                            <QRCodeSVG value={otpauthUrl} size={180} />
                        </div>
                    )}
                    {totpSecret && (
                        <p className="text-xs text-muted-foreground break-all">
                            Manual entry secret: <span className="font-mono">{totpSecret}</span>
                        </p>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="totp-verify">Code</Label>
                        <Input
                            id="totp-verify"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={totpCode}
                            onChange={(e) => setTotpCode(e.target.value)}
                            placeholder="000000"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTotpOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={enableTotp} disabled={loading || totpCode.length < 6}>
                            {loading ? 'Verifying…' : 'Enable'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {backupCodes && backupCodes.length > 0 && (
                <Dialog open onOpenChange={() => setBackupCodes(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Save your backup codes</DialogTitle>
                            <DialogDescription>
                                Each code works once. Store them in a safe place — they won&apos;t be shown again.
                            </DialogDescription>
                        </DialogHeader>
                        <ul className="font-mono text-sm grid grid-cols-2 gap-2">
                            {backupCodes.map((c) => (
                                <li key={c}>{c}</li>
                            ))}
                        </ul>
                        <DialogFooter>
                            <Button onClick={() => setBackupCodes(null)}>Done</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Disable authenticator</DialogTitle>
                        <DialogDescription>Confirm with your password and a current 6-digit code.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                            type="password"
                            value={disablePassword}
                            onChange={(e) => setDisablePassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Authenticator code</Label>
                        <Input
                            id="totp-disable"
                            inputMode="numeric"
                            value={disableTotp}
                            onChange={(e) => setDisableTotp(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDisableOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={submitTotpDisable} disabled={loading}>
                            Disable
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!removeCred} onOpenChange={() => setRemoveCred(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove passkey</DialogTitle>
                        <DialogDescription>Enter your password to confirm.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                            type="password"
                            value={removePassword}
                            onChange={(e) => setRemovePassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRemoveCred(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={removePasskey} disabled={loading}>
                            Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
