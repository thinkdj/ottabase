import PostalMime from 'postal-mime';
import type { Awaitable, InboundEmail, InboundMessageLike, MailAddress, WaitUntilLike } from './types';

/** The `+tag` of a plus address: `support+abc123@acme.test` → `abc123`. */
export function plusTag(address: string): string | null {
    const local = address.split('@')[0] ?? '';
    const plus = local.indexOf('+');
    return plus > 0 && plus < local.length - 1 ? local.slice(plus + 1) : null;
}

/** `Name <addr>` or bare address, lower-cased address. */
export function normalizeAddress(value: string): string {
    const match = /<([^>]+)>/.exec(value);
    return (match ? match[1] : value).trim().toLowerCase();
}

type PostalAddress = { address?: string; name?: string } | { group?: unknown; name?: string };

function toAddresses(list: PostalAddress[] | undefined): MailAddress[] {
    const out: MailAddress[] = [];
    for (const entry of list ?? []) {
        if ('address' in entry && entry.address) {
            out.push({ address: entry.address.toLowerCase(), ...(entry.name ? { name: entry.name } : {}) });
        }
    }
    return out;
}

async function readAll(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
            await reader.cancel();
            throw new Error(`message exceeds ${maxBytes} bytes`);
        }
        chunks.push(value);
    }
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return joined;
}

export interface ParseOptions {
    /** Refuse anything larger. Default 25 MB (Email Routing's own ceiling). */
    maxBytes?: number;
}

/** Parse a raw RFC 822 message (what Email Routing streams) into plain data. */
export async function parseRawEmail(
    raw: Uint8Array | ArrayBuffer | string,
    envelope: { from: string; to: string; rawSize?: number },
): Promise<InboundEmail> {
    const parsed = await new PostalMime().parse(raw);
    const headers: Record<string, string> = {};
    for (const header of parsed.headers ?? []) {
        headers[header.key.toLowerCase()] = header.value;
    }
    const size = typeof raw === 'string' ? new TextEncoder().encode(raw).byteLength : raw.byteLength;
    return {
        envelopeFrom: envelope.from.toLowerCase(),
        envelopeTo: envelope.to.toLowerCase(),
        from: parsed.from?.address
            ? { address: parsed.from.address.toLowerCase(), ...(parsed.from.name ? { name: parsed.from.name } : {}) }
            : null,
        to: toAddresses(parsed.to as PostalAddress[] | undefined),
        cc: toAddresses(parsed.cc as PostalAddress[] | undefined),
        replyTo: toAddresses(parsed.replyTo as PostalAddress[] | undefined),
        subject: parsed.subject ?? '',
        text: parsed.text ?? null,
        html: parsed.html ?? null,
        messageId: parsed.messageId ?? null,
        inReplyTo: parsed.inReplyTo ?? null,
        references: parsed.references ? parsed.references.split(/\s+/).filter(Boolean) : [],
        date: parsed.date ?? null,
        headers,
        attachments: (parsed.attachments ?? []).map((attachment) => ({
            filename: attachment.filename ?? null,
            mimeType: attachment.mimeType,
            disposition: attachment.disposition ?? null,
            contentId: attachment.contentId ?? null,
            size: attachment.content instanceof ArrayBuffer ? attachment.content.byteLength : 0,
            content: attachment.content instanceof ArrayBuffer ? attachment.content : new ArrayBuffer(0),
        })),
        tag: plusTag(envelope.to),
        rawSize: envelope.rawSize ?? size,
    };
}

/** Parse the message Email Routing hands the Worker. */
export async function parseInboundEmail(
    message: InboundMessageLike,
    options: ParseOptions = {},
): Promise<InboundEmail> {
    const raw = await readAll(message.raw, options.maxBytes ?? 25 * 1024 * 1024);
    return parseRawEmail(raw, { from: message.from, to: message.to, rawSize: message.rawSize });
}

export interface InboundHandlerOptions<Env> extends ParseOptions {
    /** What to do with a parsed message: emit it on the bus, file it, answer it. */
    onMessage: (mail: InboundEmail, env: Env, ctx: WaitUntilLike) => Awaitable<void>;
    /**
     * Recipients this Worker accepts (`support@acme.test`, or a predicate). Anything else is
     * rejected at SMTP time, which is what tells a sender their address is wrong. Default: all.
     */
    accept?: string[] | ((to: string) => boolean);
    /** Called when parsing or `onMessage` throws. The message is rejected with `reason`. */
    onError?: (error: unknown, message: InboundMessageLike) => void;
}

/**
 * The Worker's `email()` export:
 *
 * ```typescript
 * export default { fetch, scheduled, queue, email: createInboundEmailHandler({ onMessage }) };
 * ```
 */
export function createInboundEmailHandler<Env>(options: InboundHandlerOptions<Env>) {
    const accepts = (to: string): boolean => {
        if (!options.accept) return true;
        if (typeof options.accept === 'function') return options.accept(to);
        return options.accept.some((address) => address.toLowerCase() === to.toLowerCase());
    };
    return async (message: InboundMessageLike, env: Env, ctx: WaitUntilLike): Promise<void> => {
        if (!accepts(normalizeAddress(message.to))) {
            message.setReject('No such mailbox');
            return;
        }
        try {
            const mail = await parseInboundEmail(message, options);
            await options.onMessage(mail, env, ctx);
        } catch (error) {
            options.onError?.(error, message);
            message.setReject('Message could not be processed');
        }
    };
}
