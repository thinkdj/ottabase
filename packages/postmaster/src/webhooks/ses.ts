import type { ProviderEvent } from '../types';

interface SnsEnvelope {
    Type?: string;
    Message?: string;
    SubscribeURL?: string;
    TopicArn?: string;
}

interface SesMessage {
    notificationType?: string;
    eventType?: string;
    mail?: { messageId?: string; destination?: string[] };
    bounce?: { bounceType?: string; bouncedRecipients?: Array<{ emailAddress?: string }> };
    complaint?: { complainedRecipients?: Array<{ emailAddress?: string }> };
    delivery?: { recipients?: string[] };
}

export type SesParse =
    | { kind: 'subscribe'; subscribeUrl: string; topicArn: string | null }
    | { kind: 'event'; event: ProviderEvent }
    | { kind: 'ignore'; reason: string };

/**
 * SES publishes through SNS: an envelope whose `Message` is the SES notification as a JSON
 * string. The first delivery to a new endpoint is a `SubscriptionConfirmation` the host must
 * visit (`subscribeUrl`) before events flow.
 *
 * SNS signatures are verified against a certificate SNS hosts; fetching and checking it is
 * the host's call (`verify` on the package options). Without it, restrict the endpoint by
 * path secret or by Cloudflare Access.
 */
export function parseSesNotification(body: unknown): SesParse {
    const envelope = body as SnsEnvelope | null;
    if (!envelope || typeof envelope !== 'object') return { kind: 'ignore', reason: 'not an SNS envelope' };
    if (envelope.Type === 'SubscriptionConfirmation') {
        return envelope.SubscribeURL
            ? { kind: 'subscribe', subscribeUrl: envelope.SubscribeURL, topicArn: envelope.TopicArn ?? null }
            : { kind: 'ignore', reason: 'subscription confirmation without URL' };
    }
    if (envelope.Type !== 'Notification' || typeof envelope.Message !== 'string') {
        return { kind: 'ignore', reason: `SNS type ${envelope.Type ?? 'unknown'}` };
    }
    let message: SesMessage;
    try {
        message = JSON.parse(envelope.Message) as SesMessage;
    } catch {
        return { kind: 'ignore', reason: 'Message is not JSON' };
    }
    const type = (message.notificationType ?? message.eventType ?? '').toLowerCase();
    const messageId = message.mail?.messageId ?? null;
    const lower = (list: Array<string | undefined>) =>
        list.filter((value): value is string => !!value).map((value) => value.toLowerCase());
    switch (type) {
        case 'bounce': {
            const addresses = lower(
                (message.bounce?.bouncedRecipients ?? []).map((recipient) => recipient.emailAddress),
            );
            const permanent = (message.bounce?.bounceType ?? '').toLowerCase() === 'permanent';
            return {
                kind: 'event',
                event: {
                    provider: 'ses',
                    type: 'bounce',
                    raw: 'Bounce',
                    addresses,
                    bounce: permanent ? 'hard' : 'soft',
                    messageId,
                },
            };
        }
        case 'complaint': {
            const addresses = lower(
                (message.complaint?.complainedRecipients ?? []).map((recipient) => recipient.emailAddress),
            );
            return {
                kind: 'event',
                event: { provider: 'ses', type: 'complaint', raw: 'Complaint', addresses, messageId },
            };
        }
        case 'delivery':
            return {
                kind: 'event',
                event: {
                    provider: 'ses',
                    type: 'delivered',
                    raw: 'Delivery',
                    addresses: lower(message.delivery?.recipients ?? []),
                    messageId,
                },
            };
        default:
            return {
                kind: 'event',
                event: {
                    provider: 'ses',
                    type: 'other',
                    raw: type || 'unknown',
                    addresses: lower(message.mail?.destination ?? []),
                    messageId,
                },
            };
    }
}
