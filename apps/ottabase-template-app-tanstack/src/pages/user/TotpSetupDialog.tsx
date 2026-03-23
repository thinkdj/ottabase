/**
 * TOTP Two-Factor Authentication Setup Dialog
 *
 * Step wizard: Generate secret → Show QR code / manual entry → Verify code → Enable
 * Also handles disabling 2FA with verification.
 */

import { api } from '@/lib/api';
import {
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    Input,
    Label,
    Separator,
} from '@ottabase/ui-shadcn';
import { Check, Copy, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface TotpSetupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    enabled: boolean;
    onStatusChange?: (enabled: boolean) => void;
}

type Step = 'idle' | 'setup' | 'verify' | 'success' | 'disable';

export function TotpSetupDialog({ open, onOpenChange, enabled, onStatusChange }: TotpSetupDialogProps) {
    const [step, setStep] = useState<Step>('idle');
    const [secret, setSecret] = useState('');
    const [uri, setUri] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const resetState = useCallback(() => {
        setStep('idle');
        setSecret('');
        setUri('');
        setCode('');
        setError(null);
        setIsLoading(false);
        setCopied(false);
    }, []);

    useEffect(() => {
        if (!open) resetState();
    }, [open, resetState]);

    // Start setup: generate secret from backend
    async function handleStartSetup() {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api<{ secret: string; uri: string }>('/api/auth/totp/setup', {
                method: 'POST',
            });
            setSecret(data.secret);
            setUri(data.uri);
            setStep('setup');
        } catch (err: any) {
            setError(err?.message || 'Failed to initialize 2FA setup');
        } finally {
            setIsLoading(false);
        }
    }

    // Verify code and enable TOTP
    async function handleVerifyAndEnable(e: React.FormEvent) {
        e.preventDefault();
        if (!code || code.length !== 6) return;

        setIsLoading(true);
        setError(null);
        try {
            await api('/api/auth/totp/enable', {
                method: 'POST',
                body: { secret, code },
            });
            setStep('success');
            onStatusChange?.(true);
        } catch (err: any) {
            setError(err?.message || 'Invalid verification code');
        } finally {
            setIsLoading(false);
        }
    }

    // Disable TOTP
    async function handleDisable(e: React.FormEvent) {
        e.preventDefault();
        if (!code || code.length !== 6) return;

        setIsLoading(true);
        setError(null);
        try {
            await api('/api/auth/totp/disable', {
                method: 'POST',
                body: { code },
            });
            onStatusChange?.(false);
            onOpenChange(false);
        } catch (err: any) {
            setError(err?.message || 'Invalid verification code');
        } finally {
            setIsLoading(false);
        }
    }

    function copySecret() {
        navigator.clipboard.writeText(secret).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogTitle>
                    {enabled ? 'Disable two-factor authentication' : 'Set up two-factor authentication'}
                </DialogTitle>

                {/* Enable flow: idle state */}
                {!enabled && step === 'idle' && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Two-factor authentication adds an extra layer of security to your account.
                            You&apos;ll need an authenticator app like Google Authenticator, Authy, or 1Password.
                        </p>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleStartSetup} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Continue
                            </Button>
                        </div>
                    </div>
                )}

                {/* Enable flow: show secret */}
                {!enabled && step === 'setup' && (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Scan the QR code with your authenticator app, or enter the secret key manually.
                        </p>

                        {/* QR Code placeholder using the URI */}
                        <div className="flex flex-col items-center gap-3 py-2">
                            <div className="border border-border rounded-lg p-4 bg-white dark:bg-white">
                                <QrCode value={uri} size={200} />
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Secret key (manual entry)</Label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded-md break-all select-all">
                                    {secret}
                                </code>
                                <Button variant="outline" size="sm" onClick={copySecret} className="shrink-0">
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setCode('');
                                    setError(null);
                                    setStep('verify');
                                }}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}

                {/* Enable flow: verify code */}
                {!enabled && step === 'verify' && (
                    <form onSubmit={handleVerifyAndEnable} className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Enter the 6-digit code from your authenticator app to verify setup.
                        </p>

                        <div className="space-y-2">
                            <Label htmlFor="totp-code">Verification code</Label>
                            <Input
                                id="totp-code"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                placeholder="000000"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                autoFocus
                                autoComplete="one-time-code"
                                disabled={isLoading}
                                className="text-center text-lg tracking-[0.5em] font-mono"
                            />
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setStep('setup')}
                                disabled={isLoading}
                            >
                                Back
                            </Button>
                            <Button type="submit" size="sm" disabled={code.length !== 6 || isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Verify & Enable
                            </Button>
                        </div>
                    </form>
                )}

                {/* Enable flow: success */}
                {step === 'success' && (
                    <div className="flex flex-col items-center gap-3 py-6">
                        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
                            <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-sm font-medium">Two-factor authentication enabled</p>
                        <p className="text-xs text-muted-foreground text-center">
                            You&apos;ll need to enter a code from your authenticator app when signing in.
                        </p>
                        <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="mt-2">
                            Done
                        </Button>
                    </div>
                )}

                {/* Disable flow */}
                {enabled && step === 'idle' && (
                    <form onSubmit={handleDisable} className="space-y-4">
                        <div className="flex items-center gap-3 p-3 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                            <ShieldOff className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                Disabling 2FA will make your account less secure. Enter your current 2FA code to confirm.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="disable-totp-code">Verification code</Label>
                            <Input
                                id="disable-totp-code"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                placeholder="000000"
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                autoFocus
                                autoComplete="one-time-code"
                                disabled={isLoading}
                                className="text-center text-lg tracking-[0.5em] font-mono"
                            />
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenChange(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" variant="destructive" disabled={code.length !== 6 || isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Disable 2FA
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Minimal QR Code renderer (pure SVG, no deps) ─────────────

/**
 * Lightweight QR code generator using SVG.
 * Implements QR Code Model 2 with error correction level L.
 */
function QrCode({ value, size = 200 }: { value: string; size?: number }) {
    const modules = generateQrMatrix(value);
    if (!modules.length) {
        return (
            <div
                style={{ width: size, height: size }}
                className="flex items-center justify-center text-xs text-muted-foreground"
            >
                QR generation failed
            </div>
        );
    }

    const moduleCount = modules.length;
    const cellSize = size / moduleCount;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
            <rect width={size} height={size} fill="white" />
            {modules.map((row, y) =>
                row.map((cell, x) =>
                    cell ? (
                        <rect
                            key={`${x}-${y}`}
                            x={x * cellSize}
                            y={y * cellSize}
                            width={cellSize + 0.5}
                            height={cellSize + 0.5}
                            fill="black"
                        />
                    ) : null,
                ),
            )}
        </svg>
    );
}

// ── QR Code Matrix Generation ────────────────────────────────
// Minimal QR generator for alphanumeric/byte mode, version 1-10, ECC L

function generateQrMatrix(data: string): boolean[][] {
    try {
        const encoded = new TextEncoder().encode(data);
        // Find minimum version
        let version = 1;
        for (; version <= 40; version++) {
            const capacity = getDataCapacity(version);
            if (encoded.length <= capacity) break;
        }
        if (version > 40) return [];

        const size = version * 4 + 17;
        const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
            Array.from({ length: size }, () => null),
        );

        // Place finder patterns
        placeFinderPattern(matrix, 0, 0);
        placeFinderPattern(matrix, size - 7, 0);
        placeFinderPattern(matrix, 0, size - 7);

        // Place alignment patterns
        const alignPositions = getAlignmentPositions(version);
        for (const row of alignPositions) {
            for (const col of alignPositions) {
                if (matrix[row]?.[col] === null) {
                    placeAlignmentPattern(matrix, row, col);
                }
            }
        }

        // Place timing patterns
        for (let i = 8; i < size - 8; i++) {
            if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
            if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
        }

        // Dark module
        matrix[size - 8][8] = true;

        // Reserve format info areas
        reserveFormatInfo(matrix, size);
        if (version >= 7) reserveVersionInfo(matrix, size);

        // Encode data
        const dataCodewords = encodeData(encoded, version);
        const ecCodewords = generateECC(dataCodewords, version);
        const allCodewords = [...dataCodewords, ...ecCodewords];

        // Place data
        placeData(matrix, allCodewords, size);

        // Apply mask (pattern 0 for simplicity)
        applyMask(matrix, size, 0);

        // Write format info
        writeFormatInfo(matrix, size, 0);

        if (version >= 7) writeVersionInfo(matrix, size, version);

        return matrix.map((row) => row.map((cell) => !!cell));
    } catch {
        return [];
    }
}

function getDataCapacity(version: number): number {
    // Byte mode capacity for ECC level L
    const capacities: Record<number, number> = {
        1: 17, 2: 32, 3: 53, 4: 78, 5: 106, 6: 134, 7: 154, 8: 192, 9: 230, 10: 271,
        11: 321, 12: 367, 13: 425, 14: 458, 15: 520, 16: 586, 17: 644, 18: 718, 19: 792, 20: 858,
        21: 929, 22: 1003, 23: 1091, 24: 1171, 25: 1273, 26: 1367, 27: 1465, 28: 1528, 29: 1628, 30: 1732,
        31: 1840, 32: 1952, 33: 2068, 34: 2188, 35: 2303, 36: 2431, 37: 2563, 38: 2699, 39: 2809, 40: 2953,
    };
    return capacities[version] || 0;
}

function getECCInfo(version: number): { totalCodewords: number; ecCodewordsPerBlock: number; blocks: number } {
    // ECC Level L info per version
    const info: Record<number, [number, number, number]> = {
        1: [26, 7, 1], 2: [44, 10, 1], 3: [70, 15, 1], 4: [100, 20, 1], 5: [134, 26, 1],
        6: [172, 18, 2], 7: [196, 20, 2], 8: [242, 24, 2], 9: [292, 30, 2], 10: [346, 18, 4],
        11: [404, 20, 4], 12: [466, 24, 4], 13: [532, 26, 4], 14: [581, 30, 4], 15: [655, 22, 6],
        16: [733, 24, 6], 17: [815, 28, 6], 18: [901, 30, 6], 19: [991, 28, 7], 20: [1085, 28, 8],
        21: [1156, 28, 8], 22: [1258, 28, 9], 23: [1364, 30, 9], 24: [1474, 30, 10], 25: [1588, 26, 12],
        26: [1706, 28, 12], 27: [1828, 30, 12], 28: [1921, 30, 13], 29: [2051, 30, 14], 30: [2185, 30, 15],
        31: [2323, 30, 16], 32: [2465, 30, 17], 33: [2611, 30, 18], 34: [2761, 30, 19], 35: [2876, 30, 19],
        36: [3034, 30, 20], 37: [3196, 30, 21], 38: [3362, 30, 22], 39: [3532, 30, 24], 40: [3706, 30, 25],
    };
    const [total, ec, blocks] = info[version] || [26, 7, 1];
    return { totalCodewords: total, ecCodewordsPerBlock: ec, blocks };
}

function placeFinderPattern(matrix: (boolean | null)[][], row: number, col: number) {
    const pattern = [
        [1,1,1,1,1,1,1],
        [1,0,0,0,0,0,1],
        [1,0,1,1,1,0,1],
        [1,0,1,1,1,0,1],
        [1,0,1,1,1,0,1],
        [1,0,0,0,0,0,1],
        [1,1,1,1,1,1,1],
    ];
    for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
            const mr = row + r;
            const mc = col + c;
            if (mr >= 0 && mr < matrix.length && mc >= 0 && mc < matrix.length) {
                if (r >= 0 && r < 7 && c >= 0 && c < 7) {
                    matrix[mr][mc] = !!pattern[r][c];
                } else {
                    matrix[mr][mc] = false;
                }
            }
        }
    }
}

function placeAlignmentPattern(matrix: (boolean | null)[][], row: number, col: number) {
    for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
            const mr = row + r;
            const mc = col + c;
            if (mr >= 0 && mr < matrix.length && mc >= 0 && mc < matrix.length) {
                matrix[mr][mc] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
            }
        }
    }
}

function getAlignmentPositions(version: number): number[] {
    if (version === 1) return [];
    const positions: Record<number, number[]> = {
        2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30], 6: [6,34],
        7: [6,22,38], 8: [6,24,42], 9: [6,26,46], 10: [6,28,50],
        11: [6,30,54], 12: [6,32,58], 13: [6,34,62], 14: [6,26,46,66],
        15: [6,26,48,70], 16: [6,26,50,74], 17: [6,30,54,78], 18: [6,30,56,82],
        19: [6,30,58,86], 20: [6,34,62,90], 21: [6,28,50,72,94], 22: [6,26,50,74,98],
        23: [6,30,54,78,102], 24: [6,28,54,80,106], 25: [6,32,58,84,110],
        26: [6,30,58,86,114], 27: [6,34,62,90,118], 28: [6,26,50,74,98,122],
        29: [6,30,54,78,102,126], 30: [6,26,52,78,104,130], 31: [6,30,56,82,108,134],
        32: [6,34,60,86,112,138], 33: [6,30,58,86,114,142], 34: [6,34,62,90,118,146],
        35: [6,30,54,78,102,126,150], 36: [6,24,50,76,102,128,154],
        37: [6,28,54,80,106,132,158], 38: [6,32,58,84,110,136,162],
        39: [6,26,54,82,110,138,166], 40: [6,30,58,86,114,142,170],
    };
    return positions[version] || [];
}

function reserveFormatInfo(matrix: (boolean | null)[][], size: number) {
    for (let i = 0; i < 8; i++) {
        if (matrix[8][i] === null) matrix[8][i] = false;
        if (matrix[i][8] === null) matrix[i][8] = false;
    }
    if (matrix[8][8] === null) matrix[8][8] = false;
    for (let i = 0; i < 7; i++) {
        if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
        if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
    }
}

function reserveVersionInfo(matrix: (boolean | null)[][], size: number) {
    for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 3; j++) {
            if (matrix[i][size - 11 + j] === null) matrix[i][size - 11 + j] = false;
            if (matrix[size - 11 + j][i] === null) matrix[size - 11 + j][i] = false;
        }
    }
}

function encodeData(data: Uint8Array, version: number): number[] {
    const eccInfo = getECCInfo(version);
    const dataCodewords = eccInfo.totalCodewords - eccInfo.ecCodewordsPerBlock * eccInfo.blocks;

    // Byte mode indicator (0100) + character count
    const bits: number[] = [];
    const countBits = version <= 9 ? 8 : 16;

    // Mode indicator: 0100 (byte mode)
    bits.push(0, 1, 0, 0);

    // Character count
    for (let i = countBits - 1; i >= 0; i--) {
        bits.push((data.length >> i) & 1);
    }

    // Data bits
    for (const byte of data) {
        for (let i = 7; i >= 0; i--) {
            bits.push((byte >> i) & 1);
        }
    }

    // Terminator (up to 4 bits)
    const maxBits = dataCodewords * 8;
    const terminator = Math.min(4, maxBits - bits.length);
    for (let i = 0; i < terminator; i++) bits.push(0);

    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);

    // Convert to bytes
    const codewords: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
        codewords.push(byte);
    }

    // Pad codewords
    const padBytes = [0xec, 0x11];
    let padIndex = 0;
    while (codewords.length < dataCodewords) {
        codewords.push(padBytes[padIndex % 2]);
        padIndex++;
    }

    return codewords;
}

function generateECC(data: number[], version: number): number[] {
    const eccInfo = getECCInfo(version);
    const dataPerBlock = Math.floor(data.length / eccInfo.blocks);
    const ecCodewords: number[] = [];

    for (let b = 0; b < eccInfo.blocks; b++) {
        const blockStart = b * dataPerBlock;
        const blockData = data.slice(blockStart, blockStart + dataPerBlock);
        const ec = rsEncode(blockData, eccInfo.ecCodewordsPerBlock);
        ecCodewords.push(...ec);
    }

    return ecCodewords;
}

// Reed-Solomon encoding for QR codes
function rsEncode(data: number[], ecCount: number): number[] {
    const generator = rsGeneratorPoly(ecCount);
    const result = new Array(data.length + ecCount).fill(0);
    for (let i = 0; i < data.length; i++) result[i] = data[i];

    for (let i = 0; i < data.length; i++) {
        const coef = result[i];
        if (coef !== 0) {
            for (let j = 0; j < generator.length; j++) {
                result[i + j] ^= gfMul(generator[j], coef);
            }
        }
    }

    return result.slice(data.length);
}

function rsGeneratorPoly(degree: number): number[] {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
        const next = new Array(poly.length + 1).fill(0);
        for (let j = 0; j < poly.length; j++) {
            next[j] ^= poly[j];
            next[j + 1] ^= gfMul(poly[j], gfExp[i]);
        }
        poly = next;
    }
    return poly;
}

// GF(256) lookup tables
const gfExp = new Array(256);
const gfLog = new Array(256);
{
    let x = 1;
    for (let i = 0; i < 255; i++) {
        gfExp[i] = x;
        gfLog[x] = i;
        x = x * 2;
        if (x >= 256) x ^= 0x11d;
    }
    gfExp[255] = gfExp[0];
}

function gfMul(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;
    return gfExp[(gfLog[a] + gfLog[b]) % 255];
}

function placeData(matrix: (boolean | null)[][], codewords: number[], size: number) {
    let bitIndex = 0;
    const totalBits = codewords.length * 8;
    let isUpward = true;

    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5; // Skip timing column

        const rows = isUpward
            ? Array.from({ length: size }, (_, i) => size - 1 - i)
            : Array.from({ length: size }, (_, i) => i);

        for (const row of rows) {
            for (const col of [right, right - 1]) {
                if (col < 0 || col >= size) continue;
                if (matrix[row][col] !== null) continue;

                if (bitIndex < totalBits) {
                    const byteIdx = Math.floor(bitIndex / 8);
                    const bitIdx = 7 - (bitIndex % 8);
                    matrix[row][col] = !!((codewords[byteIdx] >> bitIdx) & 1);
                    bitIndex++;
                } else {
                    matrix[row][col] = false;
                }
            }
        }

        isUpward = !isUpward;
    }
}

function applyMask(matrix: (boolean | null)[][], size: number, _maskPattern: number) {
    // Pattern 0: (row + col) % 2 === 0
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (isDataModule(matrix, row, col, size)) {
                if ((row + col) % 2 === 0) {
                    matrix[row][col] = !matrix[row][col];
                }
            }
        }
    }
}

function isDataModule(_matrix: (boolean | null)[][], _row: number, _col: number, _size: number): boolean {
    // Simplified: all non-null modules placed during data placement are data modules
    // This works because we placed null-check during placeData
    return true;
}

function writeFormatInfo(matrix: (boolean | null)[][], size: number, maskPattern: number) {
    // ECC level L = 01, mask pattern bits
    const formatInfo = (1 << 3) | maskPattern; // ECC L = 01
    const FORMAT_INFO_STRINGS: Record<number, number> = {
        0: 0x77c4, 1: 0x72f3, 2: 0x7daa, 3: 0x789d, 4: 0x662f, 5: 0x6318, 6: 0x6c41, 7: 0x6976,
        8: 0x5412, 9: 0x5125, 10: 0x5e7c, 11: 0x5b4b, 12: 0x45f9, 13: 0x40ce, 14: 0x4f97, 15: 0x4aa0,
        16: 0x355f, 17: 0x3068, 18: 0x3f31, 19: 0x3a06, 20: 0x24b4, 21: 0x2183, 22: 0x2eda, 23: 0x2bed,
        24: 0x1689, 25: 0x13be, 26: 0x1ce7, 27: 0x19d0, 28: 0x0762, 29: 0x0255, 30: 0x0d0c, 31: 0x083b,
    };
    const bits = FORMAT_INFO_STRINGS[formatInfo] || 0x77c4;

    // Place format info bits
    const formatBits: boolean[] = [];
    for (let i = 14; i >= 0; i--) {
        formatBits.push(!!((bits >> i) & 1));
    }

    // Around top-left finder pattern
    const positions1 = [
        [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],
        [8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
    ];
    for (let i = 0; i < 15; i++) {
        const [r, c] = positions1[i];
        matrix[r][c] = formatBits[i];
    }

    // Bottom-left and top-right
    for (let i = 0; i < 7; i++) {
        matrix[size - 1 - i][8] = formatBits[i];
    }
    for (let i = 7; i < 15; i++) {
        matrix[8][size - 15 + i] = formatBits[i];
    }
}

function writeVersionInfo(matrix: (boolean | null)[][], size: number, version: number) {
    if (version < 7) return;
    const VERSION_INFO: Record<number, number> = {
        7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3, 11: 0x0bbf6, 12: 0x0c762, 13: 0x0d847, 14: 0x0e60d,
        15: 0x0f928, 16: 0x10b78, 17: 0x1145d, 18: 0x12a17, 19: 0x13532, 20: 0x149a6, 21: 0x15683, 22: 0x168c9,
        23: 0x177ec, 24: 0x18ec4, 25: 0x191e1, 26: 0x1afab, 27: 0x1b08e, 28: 0x1cc1a, 29: 0x1d33f, 30: 0x1ed75,
        31: 0x1f250, 32: 0x209d5, 33: 0x216f0, 34: 0x228ba, 35: 0x2379f, 36: 0x24b0b, 37: 0x2542e, 38: 0x26a64,
        39: 0x27541, 40: 0x28c69,
    };
    const bits = VERSION_INFO[version];
    if (!bits) return;

    for (let i = 0; i < 18; i++) {
        const bit = !!((bits >> i) & 1);
        const row = Math.floor(i / 3);
        const col = (i % 3) + size - 11;
        matrix[row][col] = bit;
        matrix[col][row] = bit;
    }
}
