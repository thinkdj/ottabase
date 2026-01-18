// Types
export type {
  EmailAddress,
  EmailMessage,
  SendEmailResult,
  EmailProvider,
  TemplateData,
  BaseTemplateConfig,
  EmailTemplate,
  CreateEmailOptions,
} from "./types";

// Engine
export {
  compileTemplate,
  renderTemplate,
  registerHelper,
  registerPartial,
  createEmail,
  defineTemplate,
} from "./engine";

// Mailer
export { Mailer, createMailer, type MailerConfig, type SendTemplateOptions } from "./mailer";

// Templates (re-export from templates module)
export {
  baseTemplate,
  defaultBaseConfig,
  wrapWithBaseTemplate,
  bodyComponents,
  loginTemplate,
  verificationCodeTemplate,
  type LoginEmailData,
} from "./templates/index";

// Providers (re-export from providers module)
export {
  createResendProvider,
  type ResendProviderConfig,
  createCloudflareEmailProvider,
  createMailChannelsProvider,
  type CloudflareEmailProviderConfig,
  type CloudflareEmailBinding,
  type MailChannelsConfig,
} from "./providers/index";
