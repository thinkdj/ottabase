// Resend provider
export { createResendProvider, type ResendProviderConfig } from "./resend";

// Cloudflare providers
export {
  createCloudflareEmailProvider,
  createMailChannelsProvider,
  type CloudflareEmailProviderConfig,
  type CloudflareEmailBinding,
  type CloudflareEmailMessage,
  type MailChannelsConfig,
} from "./cloudflare";

// Nodemailer provider (Node.js only, for local dev with HELO, MailHog, etc.)
export {
  createNodemailerProvider,
  createHeloProvider,
  createMailhogProvider,
  type SmtpConfig,
  type NodemailerProviderConfig,
} from "./nodemailer";
