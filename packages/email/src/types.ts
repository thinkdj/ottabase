export type EmailAddress =
    | string
    | {
          email: string;
          name?: string;
      };

export type TemplateVariables = Record<string, unknown>;

export interface TemplateContent {
    header?: string;
    body: string;
    footer?: string;
}

export interface EmailTemplate {
    name: string;
    subject?: string;
    layout?: string;
    header?: string;
    body?: string;
    footer?: string;
    text?: string;
}

export interface RenderedEmail {
    subject: string;
    html: string;
    text?: string;
}

export interface SendEmailInput {
    from: EmailAddress;
    to: EmailAddress | EmailAddress[];
    subject: string;
    html: string;
    text?: string;
    cc?: EmailAddress | EmailAddress[];
    bcc?: EmailAddress | EmailAddress[];
    replyTo?: EmailAddress;
    headers?: Record<string, string>;
    tags?: string[];
}

export interface SendEmailResult {
    provider: string;
    success: boolean;
    id?: string;
    error?: string;
    raw?: unknown;
}

export interface Mailer {
    provider: string;
    send: (input: SendEmailInput) => Promise<SendEmailResult>;
}

export interface RenderEmailOptions {
    template: string | EmailTemplate;
    variables?: TemplateVariables;
    content?: TemplateContent;
    subject?: string;
}

export interface TemplatedEmailInput extends Omit<SendEmailInput, 'subject' | 'html' | 'text'>, RenderEmailOptions {}
