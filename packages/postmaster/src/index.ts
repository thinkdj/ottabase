export {
    createInboundEmailHandler,
    normalizeAddress,
    parseInboundEmail,
    parseRawEmail,
    plusTag,
    type InboundHandlerOptions,
    type ParseOptions,
} from './inbound';
export {
    createPostmasterPackage,
    POSTMASTER_BASE_PATH,
    POSTMASTER_PACKAGE_KEY,
    postmasterPolicies,
    type PostmasterPackageOptions,
} from './manifest';
export { EmailSuppression } from './ottaorm-models/EmailSuppression';
export { createPostmasterRouter, type PostmasterHooks, type PostmasterRouterOptions } from './routes';
export { emailSuppressionsTable, type EmailSuppressionRecord } from './schema';
export {
    createMemorySuppressionStore,
    createModelSuppressionStore,
    createSuppressions,
    normalizeEmail,
    type Suppressions,
    type SuppressionStore,
} from './suppression';
export { createUnsubscribe, type Unsubscribe, type UnsubscribeClaims, type UnsubscribeOptions } from './unsubscribe';
export { parseResendEvent, verifyResendSignature } from './webhooks/resend';
export { parseSesNotification, type SesParse } from './webhooks/ses';
export type {
    Awaitable,
    InboundAttachment,
    InboundEmail,
    InboundMessageLike,
    MailAddress,
    ProviderEvent,
    ProviderEventType,
    SuppressionEntry,
    SuppressionReason,
    WaitUntilLike,
} from './types';
