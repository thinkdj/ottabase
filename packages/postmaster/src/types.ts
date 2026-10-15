// ============================================================
// @ottabase/postmaster — the half of email that is not sending
// ============================================================
// Mail that arrives (Cloudflare Email Routing), addresses that must never be mailed again
// (bounces, complaints, unsubscribes), the one-click unsubscribe link a list needs, and the
// provider webhooks that tell you about bounces in the first place. `@ottabase/email` stays
// what it is: templates and senders.
// ============================================================

export type Awaitable<T> = T | Promise<T>;

/** The slice of `ExecutionContext` the handler forwards. */
export interface WaitUntilLike {
    waitUntil(promise: Promise<unknown>): void;
}

export interface MailAddress {
    address: string;
    name?: string;
}

export interface InboundAttachment {
    filename: string | null;
    mimeType: string;
    /** `attachment` or `inline`. */
    disposition: string | null;
    contentId: string | null;
    size: number;
    content: ArrayBuffer;
}

/** A parsed inbound message. Plain data: it is what travels on the event bus. */
export interface InboundEmail {
    /** From the envelope (SMTP MAIL FROM), what the sender's server claimed. */
    envelopeFrom: string;
    /** From the envelope (SMTP RCPT TO), the address this Worker received it for. */
    envelopeTo: string;
    from: MailAddress | null;
    to: MailAddress[];
    cc: MailAddress[];
    replyTo: MailAddress[];
    subject: string;
    text: string | null;
    html: string | null;
    messageId: string | null;
    inReplyTo: string | null;
    references: string[];
    date: string | null;
    headers: Record<string, string>;
    attachments: InboundAttachment[];
    /** The `+tag` of a plus address, if the recipient had one (`support+abc123@…` → `abc123`). */
    tag: string | null;
    rawSize: number;
}

/** The slice of Cloudflare's `ForwardableEmailMessage` the handler needs. */
export interface InboundMessageLike {
    readonly from: string;
    readonly to: string;
    readonly raw: ReadableStream<Uint8Array>;
    readonly rawSize: number;
    readonly headers: Headers;
    setReject(reason: string): void;
    forward?(rcptTo: string, headers?: Headers): Promise<unknown>;
}

export type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe' | 'manual';

export interface SuppressionEntry {
    id: string;
    address: string;
    reason: SuppressionReason;
    /** Where it came from: `resend`, `ses`, `link`, an admin's user id. */
    source: string | null;
    /** The list it applies to, or `*` for every message. */
    list: string;
    createdAt: number;
}

export type ProviderEventType = 'bounce' | 'complaint' | 'delivered' | 'other';

/** One normalised provider event. `addresses` are the recipients it is about. */
export interface ProviderEvent {
    provider: 'resend' | 'ses';
    type: ProviderEventType;
    /** The provider's own event name, for logs. */
    raw: string;
    addresses: string[];
    /** `hard` bounces suppress; `soft` ones do not. */
    bounce?: 'hard' | 'soft';
    messageId?: string | null;
}
