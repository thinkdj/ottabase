import type { BaseTemplateConfig, TemplateData } from "../types";
import { renderTemplate } from "../engine";

/**
 * Default base template configuration
 */
export const defaultBaseConfig: Required<BaseTemplateConfig> = {
  appName: "Ottabase",
  logoUrl: "",
  primaryColor: "#000000",
  footerText: "You received this email because you have an account with us.",
  supportEmail: "",
  address: "",
};

/**
 * Clean, Notion-inspired base email template
 * Minimal design with clear header, body, and footer sections
 */
export const baseTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>{{subject}}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      height: 100% !important;
    }

    /* Base styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #37352f;
      background-color: #ffffff;
    }

    /* Links */
    a {
      color: {{primaryColor}};
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }

    /* Button */
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: {{primaryColor}};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
      font-size: 14px;
    }
    .button:hover {
      opacity: 0.9;
      text-decoration: none;
    }

    /* Utility */
    .text-muted {
      color: #9b9a97;
    }
    .text-small {
      font-size: 14px;
    }
    .text-center {
      text-align: center;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px; border-bottom: 1px solid #e9e9e7;">
              {{#if logoUrl}}
                <img src="{{logoUrl}}" alt="{{appName}}" height="32" style="height: 32px; width: auto;">
              {{else}}
                <span style="font-size: 18px; font-weight: 600; color: #37352f;">{{appName}}</span>
              {{/if}}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 0;">
              {{{body}}}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; border-top: 1px solid #e9e9e7;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #9b9a97; line-height: 1.5;">
                {{footerText}}
              </p>
              {{#if supportEmail}}
                <p style="margin: 0 0 8px; font-size: 13px; color: #9b9a97;">
                  Questions? Contact us at <a href="mailto:{{supportEmail}}" style="color: #9b9a97;">{{supportEmail}}</a>
                </p>
              {{/if}}
              {{#if address}}
                <p style="margin: 0; font-size: 13px; color: #9b9a97;">
                  {{address}}
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
 * Wrap content with the base template
 */
export function wrapWithBaseTemplate(
  bodyHtml: string,
  data: TemplateData & { subject?: string },
  config?: BaseTemplateConfig
): string {
  const mergedConfig = { ...defaultBaseConfig, ...config };
  const templateData = {
    ...mergedConfig,
    ...data,
    body: bodyHtml,
  };

  return renderTemplate(baseTemplate, templateData);
}

/**
 * Create body content with common elements
 */
export const bodyComponents = {
  /**
   * Heading element
   */
  heading: (text: string, level: 1 | 2 | 3 = 1): string => {
    const sizes = { 1: "24px", 2: "20px", 3: "16px" };
    const weights = { 1: "600", 2: "600", 3: "500" };
    return `<h${level} style="margin: 0 0 16px; font-size: ${sizes[level]}; font-weight: ${weights[level]}; color: #37352f; line-height: 1.3;">${text}</h${level}>`;
  },

  /**
   * Paragraph element
   */
  paragraph: (text: string): string => {
    return `<p style="margin: 0 0 16px; color: #37352f; line-height: 1.6;">${text}</p>`;
  },

  /**
   * Primary button
   */
  button: (text: string, url: string, color = "#000000"): string => {
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
        <tr>
          <td style="border-radius: 4px; background-color: ${color};">
            <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 500; color: #ffffff; text-decoration: none; border-radius: 4px;">${text}</a>
          </td>
        </tr>
      </table>
    `;
  },

  /**
   * Secondary/outline button
   */
  buttonOutline: (text: string, url: string, color = "#000000"): string => {
    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
        <tr>
          <td style="border-radius: 4px; border: 1px solid ${color};">
            <a href="${url}" target="_blank" style="display: inline-block; padding: 11px 23px; font-size: 14px; font-weight: 500; color: ${color}; text-decoration: none; border-radius: 4px;">${text}</a>
          </td>
        </tr>
      </table>
    `;
  },

  /**
   * Code/token display
   */
  code: (text: string): string => {
    return `<code style="display: inline-block; padding: 12px 16px; background-color: #f7f6f3; border-radius: 4px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 14px; color: #37352f; letter-spacing: 2px;">${text}</code>`;
  },

  /**
   * Divider
   */
  divider: (): string => {
    return `<hr style="margin: 24px 0; border: none; border-top: 1px solid #e9e9e7;">`;
  },

  /**
   * Muted/secondary text
   */
  muted: (text: string): string => {
    return `<p style="margin: 0 0 16px; font-size: 14px; color: #9b9a97; line-height: 1.5;">${text}</p>`;
  },

  /**
   * Callout/info box
   */
  callout: (text: string, type: "info" | "warning" | "success" = "info"): string => {
    const colors = {
      info: { bg: "#f7f6f3", border: "#e9e9e7" },
      warning: { bg: "#fef3cd", border: "#ffc107" },
      success: { bg: "#d4edda", border: "#28a745" },
    };
    const { bg, border } = colors[type];
    return `
      <div style="margin: 16px 0; padding: 16px; background-color: ${bg}; border-left: 3px solid ${border}; border-radius: 0 4px 4px 0;">
        <p style="margin: 0; font-size: 14px; color: #37352f; line-height: 1.5;">${text}</p>
      </div>
    `;
  },
};
