/**
 * App Email Templates
 *
 * Custom email templates for this application.
 * These are automatically registered with the @ottabase/email registry.
 *
 * To add a new template:
 * 1. Create a new file in this directory (e.g., my-template.ts)
 * 2. Export the template from this index file
 * 3. Register it with registerTemplate()
 */

import { registerTemplate } from "@ottabase/email";

// Import custom templates
export {
  spacedOutWelcomeTemplate,
  spacedOutNotificationTemplate,
  spacedOutComponents,
  wrapWithSpacedOutTemplate,
  type SpacedOutWelcomeData,
  type SpacedOutNotificationData,
} from "./spaced-out";

// Import for registration
import {
  spacedOutWelcomeTemplate,
  spacedOutNotificationTemplate,
} from "./spaced-out";

/**
 * Register all app templates with the global registry
 *
 * Call this function early in your app initialization to make
 * these templates available throughout your application.
 */
export function registerAppTemplates(): void {
  registerTemplate(spacedOutWelcomeTemplate);
  registerTemplate(spacedOutNotificationTemplate);
}

// Auto-register templates when this module is imported
registerAppTemplates();
