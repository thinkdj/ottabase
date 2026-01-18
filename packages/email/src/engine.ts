import Handlebars from "handlebars";
import type {
  EmailMessage,
  EmailTemplate,
  TemplateData,
  CreateEmailOptions,
  BaseTemplateConfig,
} from "./types";

/**
 * Compile a Handlebars template string
 */
export function compileTemplate(
  templateString: string
): HandlebarsTemplateDelegate {
  return Handlebars.compile(templateString);
}

/**
 * Render a template with data
 */
export function renderTemplate(
  templateString: string,
  data: TemplateData
): string {
  const template = compileTemplate(templateString);
  return template(data);
}

/**
 * Register a Handlebars helper
 */
export function registerHelper(
  name: string,
  fn: Handlebars.HelperDelegate
): void {
  Handlebars.registerHelper(name, fn);
}

/**
 * Register a Handlebars partial
 */
export function registerPartial(name: string, partial: string): void {
  Handlebars.registerPartial(name, partial);
}

// Register common helpers
registerHelper("eq", (a, b) => a === b);
registerHelper("ne", (a, b) => a !== b);
registerHelper("gt", (a, b) => a > b);
registerHelper("lt", (a, b) => a < b);
registerHelper("and", (a, b) => a && b);
registerHelper("or", (a, b) => a || b);
registerHelper("not", (a) => !a);

registerHelper("formatDate", (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

registerHelper("currentYear", () => new Date().getFullYear());

/**
 * Create an email message from a template
 */
export function createEmail<T>(
  options: CreateEmailOptions<T>
): EmailMessage {
  const { template, data, to, from, config, replyTo } = options;

  const subject = renderTemplate(template.subject, data as TemplateData);
  const html = template.render(data, config);
  const text = template.renderText?.(data);

  return {
    to,
    from,
    subject,
    html,
    text,
    replyTo,
  };
}

/**
 * Create a simple email template
 */
export function defineTemplate<T>(config: {
  name: string;
  subject: string;
  html: string;
  text?: string;
}): EmailTemplate<T> {
  const compiledHtml = compileTemplate(config.html);
  const compiledText = config.text ? compileTemplate(config.text) : undefined;
  const compiledSubject = compileTemplate(config.subject);

  return {
    name: config.name,
    subject: config.subject,
    render(data: T, baseConfig?: BaseTemplateConfig) {
      const mergedData = { ...baseConfig, ...data };
      return compiledHtml(mergedData);
    },
    renderText: compiledText
      ? (data: T) => compiledText(data)
      : undefined,
  };
}
