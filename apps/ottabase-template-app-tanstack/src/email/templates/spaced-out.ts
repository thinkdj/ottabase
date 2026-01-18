/**
 * Spaced Out Email Template
 *
 * A more airy, spacious email design with generous padding
 * and a clean, modern aesthetic inspired by Dunked/Linear.
 */
import type { EmailTemplate, BaseTemplateConfig } from "@ottabase/email";
import { renderTemplate } from "@ottabase/email";

/**
 * Data for the spaced-out welcome template
 */
export interface SpacedOutWelcomeData {
  userName?: string;
  actionUrl?: string;
  actionText?: string;
  preheader?: string;
}

/**
 * Spaced out base template with more generous spacing
 */
const spacedOutBaseTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{{subject}}</title>
  {{#if preheader}}
  <span style="display: none !important; visibility: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">
    {{preheader}}
  </span>
  {{/if}}
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.7;
      color: #1a1a1a;
      background-color: #f8f9fa;
    }
    a {
      color: {{primaryColor}};
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8f9fa;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 520px;">

          <!-- Logo/Header -->
          <tr>
            <td align="center" style="padding-bottom: 48px;">
              {{#if logoUrl}}
                <img src="{{logoUrl}}" alt="{{appName}}" height="40" style="height: 40px; width: auto;">
              {{else}}
                <span style="font-size: 24px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px;">{{appName}}</span>
              {{/if}}
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <tr>
                  <td style="padding: 48px 40px;">
                    {{{body}}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 48px;">
              <p style="margin: 0 0 12px; font-size: 13px; color: #8c8c8c; line-height: 1.6;">
                {{footerText}}
              </p>
              {{#if supportEmail}}
                <p style="margin: 0; font-size: 13px; color: #8c8c8c;">
                  Need help? <a href="mailto:{{supportEmail}}" style="color: #8c8c8c; text-decoration: underline;">Contact support</a>
                </p>
              {{/if}}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Wrap content with the spaced-out template
 */
export function wrapWithSpacedOutTemplate(
  bodyHtml: string,
  data: { subject?: string; preheader?: string },
  config?: BaseTemplateConfig
): string {
  const defaultConfig: BaseTemplateConfig = {
    appName: "Ottabase",
    primaryColor: "#5046e5",
    footerText: "You received this email because you have an account with us.",
  };

  const mergedConfig = { ...defaultConfig, ...config };
  const templateData = {
    ...mergedConfig,
    ...data,
    body: bodyHtml,
  };

  return renderTemplate(spacedOutBaseTemplate, templateData);
}

/**
 * Spaced-out body components
 */
export const spacedOutComponents = {
  /**
   * Large heading with subtle color
   */
  heading: (text: string): string => {
    return `<h1 style="margin: 0 0 24px; font-size: 28px; font-weight: 600; color: #1a1a1a; line-height: 1.3; letter-spacing: -0.5px;">${text}</h1>`;
  },

  /**
   * Paragraph with comfortable line height
   */
  paragraph: (text: string): string => {
    return `<p style="margin: 0 0 24px; color: #4a4a4a; line-height: 1.7;">${text}</p>`;
  },

  /**
   * Large prominent button
   */
  button: (text: string, url: string, color = "#5046e5"): string => {
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0;">
        <tr>
          <td style="border-radius: 8px; background-color: ${color};">
            <a href="${url}" target="_blank" style="display: inline-block; padding: 16px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">${text}</a>
          </td>
        </tr>
      </table>
    `;
  },

  /**
   * Subtle secondary button
   */
  buttonSecondary: (text: string, url: string): string => {
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0;">
        <tr>
          <td style="border-radius: 8px; border: 1px solid #e0e0e0;">
            <a href="${url}" target="_blank" style="display: inline-block; padding: 15px 31px; font-size: 15px; font-weight: 500; color: #4a4a4a; text-decoration: none; border-radius: 8px;">${text}</a>
          </td>
        </tr>
      </table>
    `;
  },

  /**
   * Light divider
   */
  divider: (): string => {
    return `<hr style="margin: 32px 0; border: none; border-top: 1px solid #f0f0f0;">`;
  },

  /**
   * Muted helper text
   */
  muted: (text: string): string => {
    return `<p style="margin: 0 0 16px; font-size: 14px; color: #8c8c8c; line-height: 1.6;">${text}</p>`;
  },

  /**
   * Highlight box
   */
  highlight: (text: string): string => {
    return `
      <div style="margin: 24px 0; padding: 20px 24px; background-color: #f8f9fa; border-radius: 8px;">
        <p style="margin: 0; color: #4a4a4a; line-height: 1.6;">${text}</p>
      </div>
    `;
  },

  /**
   * Code/verification code display
   */
  code: (text: string): string => {
    return `<code style="display: inline-block; padding: 16px 24px; background-color: #f8f9fa; border-radius: 8px; font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 20px; font-weight: 600; color: #1a1a1a; letter-spacing: 4px;">${text}</code>`;
  },
};

/**
 * Spaced Out Welcome Template
 */
export const spacedOutWelcomeTemplate: EmailTemplate<SpacedOutWelcomeData> = {
  name: "spaced-out-welcome",
  subject: "Welcome to {{appName}}",

  render(data: SpacedOutWelcomeData, config?: BaseTemplateConfig): string {
    const { userName = "there", actionUrl, actionText = "Get Started" } = data;

    let bodyHtml = "";

    bodyHtml += spacedOutComponents.heading(`Welcome, ${userName}!`);
    bodyHtml += spacedOutComponents.paragraph(
      "We're excited to have you on board. Your account has been created successfully and you're ready to start exploring."
    );

    if (actionUrl) {
      bodyHtml += spacedOutComponents.button(actionText, actionUrl, config?.primaryColor);
    }

    bodyHtml += spacedOutComponents.highlight(
      "If you have any questions, our support team is here to help. Just reply to this email or visit our help center."
    );

    bodyHtml += spacedOutComponents.muted(
      "If you didn't create this account, you can safely ignore this email."
    );

    return wrapWithSpacedOutTemplate(
      bodyHtml,
      { subject: "Welcome", preheader: data.preheader },
      config
    );
  },

  renderText(data: SpacedOutWelcomeData): string {
    const { userName = "there", actionUrl, actionText = "Get Started" } = data;
    let text = `Welcome, ${userName}!\n\n`;
    text += "We're excited to have you on board. Your account has been created successfully.\n\n";
    if (actionUrl) {
      text += `${actionText}: ${actionUrl}\n\n`;
    }
    text += "If you have any questions, our support team is here to help.\n";
    return text;
  },
};

/**
 * Spaced Out Notification Template
 */
export interface SpacedOutNotificationData {
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  preheader?: string;
}

export const spacedOutNotificationTemplate: EmailTemplate<SpacedOutNotificationData> = {
  name: "spaced-out-notification",
  subject: "{{title}}",

  render(data: SpacedOutNotificationData, config?: BaseTemplateConfig): string {
    const { title, message, actionUrl, actionText = "View Details" } = data;

    let bodyHtml = "";

    bodyHtml += spacedOutComponents.heading(title);
    bodyHtml += spacedOutComponents.paragraph(message);

    if (actionUrl) {
      bodyHtml += spacedOutComponents.button(actionText, actionUrl, config?.primaryColor);
    }

    return wrapWithSpacedOutTemplate(
      bodyHtml,
      { subject: title, preheader: data.preheader },
      config
    );
  },

  renderText(data: SpacedOutNotificationData): string {
    const { title, message, actionUrl, actionText = "View Details" } = data;
    let text = `${title}\n\n${message}\n\n`;
    if (actionUrl) {
      text += `${actionText}: ${actionUrl}\n`;
    }
    return text;
  },
};
