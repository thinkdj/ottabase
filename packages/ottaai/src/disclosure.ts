// ============================================================
// @ottabase/ottaai — Custody & privacy disclosure, shipped as an ARTIFACT
// ============================================================
// Not advice. This is the exact factual paragraph a consuming app places next to
// the connect-a-provider form and in its data-processing agreement.
//
// Thirty apps should not each write a subtly wrong version — and an AI gateway
// processes tenant prompts, so it MUST be disclosed as a sub-processor.
// ============================================================

export interface CustodyDisclosureOptions {
    /** How the operator refers to itself in tenant-facing copy. */
    operatorName?: string;
    /** The proxy every call transits, when one is used (e.g. "Cloudflare AI Gateway"). */
    proxyName?: string | null;
    /** Where ciphertext lives at rest, if the operator states a region. */
    dataRegion?: string | null;
}

export interface CustodyDisclosure {
    /** One-line summary for a form footnote. */
    short: string;
    /** Full paragraphs for a settings page / DPA. */
    paragraphs: string[];
    /** The residency position — silence here is what blocks enterprise deals. */
    residency: string;
}

/**
 * Build the custody statement.
 *
 * THE NO-REVEAL POSITION IS PART OF IT, and it is written down BEFORE the feature
 * request arrives: there is NO reveal-key affordance. Not for support, not for the
 * tenant, not behind an approval workflow, not with an audit record. A reveal path
 * converts a compromised admin session or one over-broad support role into full
 * credential exfiltration across every tenant, and it destroys the central trust claim
 * of the feature. A tenant who lost their key obtains a new one from the provider.
 */
export function buildCustodyDisclosure(options: CustodyDisclosureOptions = {}): CustodyDisclosure {
    const operator = options.operatorName ?? 'This application';
    const proxy = options.proxyName === undefined ? 'Cloudflare AI Gateway' : options.proxyName;

    const paragraphs: string[] = [
        `Your provider key is encrypted at rest with authenticated encryption (AES-256-GCM) under a ` +
            `master secret held outside the database. ${operator} decrypts it in memory, at call time only, ` +
            `for the duration of a single request.`,
        `The key is never written to logs, never returned by any API, and cannot be revealed again — ` +
            `not to you, not to support. If you lose it, issue a new one with your provider and replace it here.`,
        `Deleting a connection permanently deletes the encrypted key. An audit record of the change is ` +
            `retained (provider, key hint, who changed it, when) but never the key itself.`,
    ];

    if (proxy) {
        paragraphs.push(
            `Requests are routed through ${proxy}, which acts as a sub-processor: your prompts and your ` +
                `provider key transit it on every call. Inference itself runs in your own provider account, ` +
                `under your own provider contract, and is billed to you.`,
        );
    } else {
        paragraphs.push(
            `Requests go directly to your provider. Inference runs in your own provider account, under your ` +
                `own provider contract, and is billed to you.`,
        );
    }

    const residency = options.dataRegion
        ? `The encrypted key is stored in ${options.dataRegion}. Inference happens wherever your provider ` +
          `processes it — that is governed by your contract with them, not by us.`
        : `Data residency for the stored key follows this deployment's database region; inference residency ` +
          `is governed by your own provider contract. If you have a residency requirement, partition at the ` +
          `deployment level — this feature does not enforce a region.`;

    return {
        short: proxy
            ? `Encrypted at rest, decrypted only in memory at call time, never logged, never shown again. Calls transit ${proxy}.`
            : 'Encrypted at rest, decrypted only in memory at call time, never logged, never shown again.',
        paragraphs,
        residency,
    };
}
