import { registerEmailTemplate, type EmailTemplate } from '@ottabase/email';
import { minimalistTemplate } from './minimalist';

const APP_TEMPLATES: EmailTemplate[] = [minimalistTemplate];

export function registerAppEmailTemplates() {
    APP_TEMPLATES.forEach((template) => registerEmailTemplate(template));
    return APP_TEMPLATES;
}
