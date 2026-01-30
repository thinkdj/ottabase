import { renderEmail } from './render';
import type { Mailer, SendEmailResult, TemplatedEmailInput } from './types';

export async function sendTemplatedEmail(mailer: Mailer, input: TemplatedEmailInput): Promise<SendEmailResult> {
    const { template, variables, content, subject, ...message } = input;
    const rendered = renderEmail({ template, variables, content, subject });

    return mailer.send({
        ...message,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
    });
}

export function createNoopMailer(): Mailer {
    return {
        provider: 'noop',
        async send() {
            return {
                provider: 'noop',
                success: true,
                id: 'noop',
            };
        },
    };
}
