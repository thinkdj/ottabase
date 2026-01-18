# @ottabase/email

A flexible email templating and sending package with Handlebars support, clean Notion-like templates, and multiple provider support (Resend, Cloudflare/MailChannels).

## Features

- **Handlebars Templating**: Full Handlebars support with custom helpers
- **Built-in Templates**: Clean, Notion-like default templates for common use cases
- **App-level Templates**: Create custom templates in your application
- **Multiple Providers**: Send via Resend, Cloudflare Workers, or MailChannels
- **Edge Compatible**: Works on Cloudflare Workers and other edge runtimes
- **Template Registry**: Register and use templates from anywhere in your app

## Installation

```bash
pnpm add @ottabase/email
```

## Quick Start

### Sending a Simple Email

```typescript
import { Mailer, ResendProvider } from "@ottabase/email";

const provider = new ResendProvider("your-resend-api-key");
const mailer = new Mailer(provider);

// Send using a built-in template
await mailer.send("login", {
  to: "user@example.com",
  from: "noreply@yourapp.com",
  data: {
    url: "https://yourapp.com/auth/verify?token=abc123",
  },
  config: {
    appName: "My App",
    primaryColor: "#0066cc",
  },
});
```

### Using the Template Registry

```typescript
import { getTemplate, renderEmail } from "@ottabase/email";

const template = getTemplate("login");
if (template) {
  const html = template.render(
    { url: "https://example.com/verify" },
    { appName: "My App" }
  );
}
```

## Built-in Templates

### Login Template (`login`)

Magic link login email with a prominent sign-in button.

```typescript
interface LoginEmailData {
  url: string;        // Magic link URL
  host?: string;      // Optional: Display hostname
  expires?: string;   // Optional: Link expiration time
}
```

### Verification Code Template (`verification-code`)

Email with a verification code display.

```typescript
interface VerificationCodeData {
  code: string;       // The verification code
  expires?: string;   // Optional: Code expiration time
}
```

## Creating App-level Templates

You can create custom templates in your application and register them with the email system.

### 1. Create Your Template

Create a template file in your app (e.g., `src/email/templates/my-template.ts`):

```typescript
import type { EmailTemplate, BaseTemplateConfig } from "@ottabase/email";
import { wrapWithBaseTemplate, bodyComponents } from "@ottabase/email/templates";

// Define your template data interface
export interface MyTemplateData {
  userName: string;
  message: string;
  actionUrl?: string;
}

// Create the template
export const myTemplate: EmailTemplate<MyTemplateData> = {
  name: "my-template",
  subject: "Hello {{userName}}!",

  render(data: MyTemplateData, config?: BaseTemplateConfig): string {
    const body = `
      ${bodyComponents.heading(`Welcome, ${data.userName}!`)}
      ${bodyComponents.paragraph(data.message)}
      ${data.actionUrl ? bodyComponents.button("Take Action", data.actionUrl) : ""}
    `;
    return wrapWithBaseTemplate(body, config);
  },

  renderText(data: MyTemplateData): string {
    return `Welcome, ${data.userName}!\n\n${data.message}`;
  },
};
```

### 2. Register Your Templates

Create an index file that registers all your templates (e.g., `src/email/templates/index.ts`):

```typescript
import { registerTemplate } from "@ottabase/email";
import { myTemplate } from "./my-template";
import { anotherTemplate } from "./another-template";

// Export templates for direct use
export { myTemplate, anotherTemplate };
export type { MyTemplateData } from "./my-template";

// Register all app templates
export function registerAppTemplates(): void {
  registerTemplate(myTemplate);
  registerTemplate(anotherTemplate);
}

// Auto-register when this module is imported
registerAppTemplates();
```

### 3. Import Templates Early

Import your templates module early in your application to ensure they're registered:

```typescript
// In your app's entry point or where you initialize email
import "@/email/templates"; // This auto-registers your templates

// Now you can use them
import { Mailer, getTemplate } from "@ottabase/email";

// Use via Mailer
await mailer.send("my-template", {
  to: "user@example.com",
  from: "noreply@yourapp.com",
  data: { userName: "John", message: "Welcome to our platform!" },
});

// Or get template directly
const template = getTemplate<MyTemplateData>("my-template");
```

## Body Components

The package provides pre-built components for constructing email bodies:

```typescript
import { bodyComponents } from "@ottabase/email/templates";

const body = `
  ${bodyComponents.heading("Welcome!")}
  ${bodyComponents.paragraph("Thanks for signing up.")}
  ${bodyComponents.button("Get Started", "https://example.com/start")}
  ${bodyComponents.buttonOutline("Learn More", "https://example.com/docs")}
  ${bodyComponents.code("ABC123")}
  ${bodyComponents.divider()}
  ${bodyComponents.muted("This is fine print.")}
  ${bodyComponents.callout("Important information here.")}
`;
```

## Email Providers

### Resend Provider

Best for production use. Requires a [Resend](https://resend.com) API key.

```typescript
import { ResendProvider } from "@ottabase/email/providers/resend";

const provider = new ResendProvider(process.env.RESEND_API_KEY);
```

### Cloudflare Email Provider

For Cloudflare Workers with Email Routing enabled.

```typescript
import { CloudflareEmailProvider } from "@ottabase/email/providers/cloudflare";

// In your Cloudflare Worker
export default {
  async email(message, env, ctx) {
    const provider = new CloudflareEmailProvider(message);
    // Use provider...
  },
};
```

### MailChannels Provider

Free email sending via MailChannels (available on Cloudflare Workers).

```typescript
import { MailChannelsProvider } from "@ottabase/email/providers/cloudflare";

const provider = new MailChannelsProvider({
  dkimDomain: "yourapp.com",
  dkimSelector: "mailchannels",
  dkimPrivateKey: process.env.DKIM_PRIVATE_KEY,
});
```

## Configuration

### Base Template Configuration

All templates accept a `BaseTemplateConfig` for branding:

```typescript
interface BaseTemplateConfig {
  appName?: string;       // Your app name (default: "App")
  logoUrl?: string;       // URL to your logo
  primaryColor?: string;  // Primary brand color (default: "#000000")
  footerText?: string;    // Custom footer text
  supportEmail?: string;  // Support email address
  address?: string;       // Company address for footer
}
```

### Environment Variables

When using with `@ottabase/auth`, configure via environment variables:

```bash
# Email Provider
AUTH_RESEND_KEY=re_xxxxxxxxxx
AUTH_EMAIL_FROM=noreply@yourapp.com

# Branding (optional)
APP_NAME=My App
APP_PRIMARY_COLOR=#0066cc
APP_LOGO_URL=https://yourapp.com/logo.png
```

## Integration with @ottabase/auth

The email package integrates seamlessly with the auth package:

```typescript
import { createOttabaseEmailProvider } from "@ottabase/auth";

// In your auth configuration
const emailProvider = createOttabaseEmailProvider({
  resendApiKey: process.env.AUTH_RESEND_KEY,
  from: "noreply@yourapp.com",
  templateConfig: {
    appName: "My App",
    primaryColor: "#0066cc",
    logoUrl: "https://yourapp.com/logo.png",
  },
});
```

## Handlebars Helpers

The following Handlebars helpers are available in templates:

- `{{#if condition}}...{{/if}}` - Conditional rendering
- `{{#unless condition}}...{{/unless}}` - Negative conditional
- `{{#each items}}...{{/each}}` - Iteration
- `{{eq a b}}` - Equality check
- `{{ne a b}}` - Not equal check
- `{{gt a b}}` - Greater than
- `{{lt a b}}` - Less than
- `{{and a b}}` - Logical AND
- `{{or a b}}` - Logical OR
- `{{not a}}` - Logical NOT
- `{{uppercase str}}` - Convert to uppercase
- `{{lowercase str}}` - Convert to lowercase
- `{{capitalize str}}` - Capitalize first letter
- `{{truncate str length}}` - Truncate string
- `{{formatDate date format}}` - Format date (ISO, short, long)
- `{{json obj}}` - JSON stringify

## API Reference

### Mailer

```typescript
class Mailer {
  constructor(provider: EmailProvider);

  send<T>(
    templateName: string,
    options: {
      to: string | string[];
      from: string;
      data: T;
      config?: BaseTemplateConfig;
      replyTo?: string;
    }
  ): Promise<EmailResult>;

  sendRaw(options: EmailSendOptions): Promise<EmailResult>;
}
```

### Template Registry

```typescript
// Register a template
registerTemplate<T>(template: EmailTemplate<T>): void;

// Get a template by name
getTemplate<T>(name: string): EmailTemplate<T> | undefined;

// Get all registered template names
getTemplateNames(): string[];

// Render a template
renderEmail<T>(
  templateName: string,
  data: T,
  config?: BaseTemplateConfig
): { subject: string; html: string; text?: string } | null;
```

## License

MIT
