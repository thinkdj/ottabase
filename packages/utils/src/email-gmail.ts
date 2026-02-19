/**
 * Email header interface for Gmail verification
 */
export interface EmailHeader {
    name: string;
    value: string;
}

/**
 * Verify sender authenticity for Gmail emails using email headers.
 * Checks SPF, DKIM, and DMARC authentication results.
 */
export function verifySenderGmail(headers: EmailHeader[], domain?: string): boolean {
    if (!headers || !Array.isArray(headers)) return false;

    // Check "Authentication-Results" or "ARC-Authentication-Results" headers for pass status
    if (checkHeaderPass(headers, 'Authentication-Results') || checkHeaderPass(headers, 'ARC-Authentication-Results')) {
        return true;
    }

    // Check if Received-SPF starts with "pass"
    const spfHeader = headers.find((header) => header.name === 'Received-SPF');
    if (spfHeader && spfHeader.value.startsWith('pass')) {
        return true;
    }

    return false;
}

/**
 * Check if the specified header contains authentication pass indicators.
 * Looks for spf=pass, dkim=pass, or dmarc=pass in the header value.
 */
export function checkHeaderPass(headers: EmailHeader[], headerName: string): boolean {
    if (!headers || !Array.isArray(headers) || !headerName) return false;

    const header = headers.find((h) => h.name === headerName);
    if (!header || !header.value) return false;

    return (
        header.value.includes('spf=pass') || header.value.includes('dkim=pass') || header.value.includes('dmarc=pass')
    );
}

/**
 * Extract authentication results from email headers.
 * Returns an object with SPF, DKIM, and DMARC status.
 */
export function getAuthenticationResults(headers: EmailHeader[]): {
    spf: 'pass' | 'fail' | 'neutral' | 'unknown';
    dkim: 'pass' | 'fail' | 'neutral' | 'unknown';
    dmarc: 'pass' | 'fail' | 'neutral' | 'unknown';
} {
    const results = {
        spf: 'unknown' as const,
        dkim: 'unknown' as const,
        dmarc: 'unknown' as const,
    };

    if (!headers || !Array.isArray(headers)) return results;

    const authHeader = headers.find((h) => h.name === 'Authentication-Results');
    if (!authHeader) return results;

    const value = authHeader.value.toLowerCase();

    // Extract SPF result
    const spfMatch = value.match(/spf=(\w+)/);
    if (spfMatch) results.spf = spfMatch[1] as any;

    // Extract DKIM result
    const dkimMatch = value.match(/dkim=(\w+)/);
    if (dkimMatch) results.dkim = dkimMatch[1] as any;

    // Extract DMARC result
    const dmarcMatch = value.match(/dmarc=(\w+)/);
    if (dmarcMatch) results.dmarc = dmarcMatch[1] as any;

    return results;
}
