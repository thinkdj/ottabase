/**
 * Passkey Manager Component
 *
 * Lists, registers, and deletes WebAuthn passkeys.
 * Supports platform authenticators (Windows Hello, Touch ID, Face ID)
 * and cross-platform security keys.
 */

import { api } from '@/lib/api';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
} from '@ottabase/ui-shadcn';
import { Fingerprint, Loader2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface PasskeyInfo {
    id: string;
    credentialId: string;
    credentialDeviceType: string;
    credentialBackedUp: boolean;
    transports: string;
    createdAt: number;
}

interface PasskeyManagerProps {
    className?: string;
}

export function PasskeyManager({ className }: PasskeyManagerProps) {
    const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegistering, setIsRegistering] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PasskeyInfo | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [webauthnSupported] = useState(() =>
        typeof window !== 'undefined' && !!window.PublicKeyCredential,
    );

    const loadPasskeys = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await api<{ passkeys: PasskeyInfo[] }>('/api/auth/passkeys');
            setPasskeys(data.passkeys || []);
        } catch {
            // Silently fail - passkeys table might not exist yet
            setPasskeys([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPasskeys();
    }, [loadPasskeys]);

    async function handleRegister() {
        if (!webauthnSupported) {
            setError('WebAuthn is not supported in this browser');
            return;
        }

        setIsRegistering(true);
        setError(null);

        try {
            // Get registration options from server
            const { options } = await api<{ options: any }>('/api/auth/passkeys/register-options', {
                method: 'POST',
            });

            // Convert base64url strings to ArrayBuffers for the browser API
            const publicKeyOptions: PublicKeyCredentialCreationOptions = {
                challenge: base64UrlToBuffer(options.challenge),
                rp: options.rp,
                user: {
                    ...options.user,
                    id: base64UrlToBuffer(options.user.id),
                },
                pubKeyCredParams: options.pubKeyCredParams,
                timeout: options.timeout,
                attestation: options.attestation,
                authenticatorSelection: options.authenticatorSelection,
                excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
                    ...c,
                    id: base64UrlToBuffer(c.id),
                })),
            };

            // Call the browser WebAuthn API
            const credential = (await navigator.credentials.create({
                publicKey: publicKeyOptions,
            })) as PublicKeyCredential;

            if (!credential) {
                setError('Registration was cancelled');
                return;
            }

            const attestationResponse = credential.response as AuthenticatorAttestationResponse;

            // Send the response to the server for verification
            const verifyPayload = {
                id: credential.id,
                rawId: bufferToBase64Url(new Uint8Array(credential.rawId)),
                response: {
                    clientDataJSON: bufferToBase64Url(new Uint8Array(attestationResponse.clientDataJSON)),
                    attestationObject: bufferToBase64Url(new Uint8Array(attestationResponse.attestationObject)),
                },
                type: credential.type,
                authenticatorAttachment: (credential as any).authenticatorAttachment || undefined,
            };

            await api('/api/auth/passkeys/register-verify', {
                method: 'POST',
                body: verifyPayload,
            });

            // Reload passkeys list
            await loadPasskeys();
        } catch (err: any) {
            if (err?.name === 'NotAllowedError') {
                setError('Registration was cancelled or timed out');
            } else {
                setError(err?.message || 'Failed to register passkey');
            }
        } finally {
            setIsRegistering(false);
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;

        setIsDeleting(true);
        try {
            await api(`/api/auth/passkeys/${encodeURIComponent(deleteTarget.id)}`, {
                method: 'DELETE',
            });
            setPasskeys((prev) => prev.filter((p) => p.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (err: any) {
            setError(err?.message || 'Failed to delete passkey');
        } finally {
            setIsDeleting(false);
        }
    }

    if (!webauthnSupported) {
        return (
            <div className={className}>
                <p className="text-sm text-muted-foreground">
                    Passkeys are not supported in this browser.
                </p>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h4 className="font-medium">Passkeys</h4>
                    <p className="text-sm text-muted-foreground">
                        Sign in with Windows Hello, Touch ID, or a security key
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegister}
                    disabled={isRegistering || isLoading}
                >
                    {isRegistering ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add passkey
                </Button>
            </div>

            {error && (
                <p className="text-sm text-destructive mb-3">{error}</p>
            )}

            {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading passkeys…
                </div>
            ) : passkeys.length === 0 ? (
                <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground border border-dashed border-border rounded-lg px-4">
                    <Fingerprint className="h-5 w-5 shrink-0" />
                    <span>No passkeys registered. Add one for passwordless sign-in.</span>
                </div>
            ) : (
                <div className="space-y-2">
                    {passkeys.map((passkey) => (
                        <div
                            key={passkey.id}
                            className="flex items-center justify-between border border-border rounded-lg px-3 py-2"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {passkey.credentialDeviceType === 'multiDevice'
                                            ? 'Synced passkey'
                                            : 'Device-bound passkey'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Added{' '}
                                        {new Date(passkey.createdAt).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                        {passkey.transports && (
                                            <> · {passkey.transports.replace(/,/g, ', ')}</>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                onClick={() => setDeleteTarget(passkey)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove passkey?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This passkey will be removed from your account. You can add it again later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async (e) => {
                                e.preventDefault();
                                await handleDelete();
                            }}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ── Buffer conversion utilities ──────────────────────────────

function bufferToBase64Url(buffer: Uint8Array): string {
    let binary = '';
    for (const byte of buffer) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
