import type { EmailTemplate, TemplateData } from "./types";
import { loginTemplate, verificationCodeTemplate } from "./templates/login";

/**
 * Template registry for managing email templates
 *
 * This allows apps to register custom templates that can be used
 * alongside the built-in templates.
 */
class TemplateRegistry {
  private templates: Map<string, EmailTemplate<any>> = new Map();

  constructor() {
    // Register built-in templates
    this.register(loginTemplate);
    this.register(verificationCodeTemplate);
  }

  /**
   * Register a template
   */
  register<T extends TemplateData>(template: EmailTemplate<T>): void {
    this.templates.set(template.name, template);
  }

  /**
   * Get a template by name
   */
  get<T extends TemplateData = TemplateData>(
    name: string
  ): EmailTemplate<T> | undefined {
    return this.templates.get(name) as EmailTemplate<T> | undefined;
  }

  /**
   * Check if a template exists
   */
  has(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Get all registered template names
   */
  getNames(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get all registered templates
   */
  getAll(): EmailTemplate<any>[] {
    return Array.from(this.templates.values());
  }

  /**
   * Unregister a template
   */
  unregister(name: string): boolean {
    return this.templates.delete(name);
  }

  /**
   * Clear all templates (except built-in)
   */
  clearCustom(): void {
    const builtInNames = ["login", "verification-code"];
    for (const name of this.templates.keys()) {
      if (!builtInNames.includes(name)) {
        this.templates.delete(name);
      }
    }
  }
}

/**
 * Global template registry instance
 */
export const templateRegistry = new TemplateRegistry();

/**
 * Register a custom email template
 *
 * @example
 * ```typescript
 * import { registerTemplate, wrapWithBaseTemplate, bodyComponents } from "@ottabase/email";
 *
 * registerTemplate({
 *   name: "welcome",
 *   subject: "Welcome to {{appName}}!",
 *   render(data, config) {
 *     let body = bodyComponents.heading("Welcome!");
 *     body += bodyComponents.paragraph(`Hi ${data.name}, thanks for joining!`);
 *     return wrapWithBaseTemplate(body, { subject: "Welcome" }, config);
 *   },
 * });
 * ```
 */
export function registerTemplate<T extends TemplateData>(
  template: EmailTemplate<T>
): void {
  templateRegistry.register(template);
}

/**
 * Get a template by name from the registry
 */
export function getTemplate<T extends TemplateData = TemplateData>(
  name: string
): EmailTemplate<T> | undefined {
  return templateRegistry.get<T>(name);
}

/**
 * Get all registered template names
 */
export function getTemplateNames(): string[] {
  return templateRegistry.getNames();
}

/**
 * Check if a template is registered
 */
export function hasTemplate(name: string): boolean {
  return templateRegistry.has(name);
}
