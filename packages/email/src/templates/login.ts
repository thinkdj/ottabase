import type { EmailTemplate, BaseTemplateConfig } from "../types";
import { wrapWithBaseTemplate, bodyComponents } from "./base";

/**
 * Data required for login/magic link email
 */
export interface LoginEmailData {
  /** Magic link URL */
  url: string;
  /** Optional verification code (if using code-based auth) */
  code?: string;
  /** User's email address */
  email?: string;
  /** Link expiration time (e.g., "15 minutes") */
  expiresIn?: string;
  /** IP address of request (for security) */
  ipAddress?: string;
  /** Browser/device info (for security) */
  userAgent?: string;
}

/**
 * Magic link / Login email template
 */
export const loginTemplate: EmailTemplate<LoginEmailData> = {
  name: "login",
  subject: "Sign in to {{appName}}",

  render(data: LoginEmailData, config?: BaseTemplateConfig): string {
    const { url, code, expiresIn = "15 minutes" } = data;

    let bodyHtml = "";

    // Heading
    bodyHtml += bodyComponents.heading("Sign in to your account");

    // Main message
    bodyHtml += bodyComponents.paragraph(
      "Click the button below to sign in. This link will expire in " +
        expiresIn +
        "."
    );

    // Sign in button
    bodyHtml += bodyComponents.button(
      "Sign in",
      url,
      config?.primaryColor || "#000000"
    );

    // Show code if provided (for copy-paste scenarios)
    if (code) {
      bodyHtml += bodyComponents.muted("Or enter this code:");
      bodyHtml += `<p style="margin: 0 0 24px;">${bodyComponents.code(code)}</p>`;
    }

    // Security note
    bodyHtml += bodyComponents.divider();
    bodyHtml += bodyComponents.muted(
      "If you didn't request this email, you can safely ignore it."
    );

    // Fallback URL
    bodyHtml += bodyComponents.muted(
      `If the button doesn't work, copy and paste this link into your browser:`
    );
    bodyHtml += `<p style="margin: 0; font-size: 12px; color: #9b9a97; word-break: break-all;"><a href="${url}" style="color: #9b9a97;">${url}</a></p>`;

    return wrapWithBaseTemplate(bodyHtml, { subject: "Sign in" }, config);
  },

  renderText(data: LoginEmailData): string {
    const { url, code, expiresIn = "15 minutes" } = data;
    let text = `Sign in to your account\n\n`;
    text += `Click the link below to sign in. This link will expire in ${expiresIn}.\n\n`;
    text += `${url}\n\n`;
    if (code) {
      text += `Or enter this code: ${code}\n\n`;
    }
    text += `If you didn't request this email, you can safely ignore it.\n`;
    return text;
  },
};

/**
 * Verification code only email (no magic link)
 */
export const verificationCodeTemplate: EmailTemplate<{
  code: string;
  expiresIn?: string;
}> = {
  name: "verification-code",
  subject: "Your verification code",

  render(data, config): string {
    const { code, expiresIn = "10 minutes" } = data;

    let bodyHtml = "";

    bodyHtml += bodyComponents.heading("Your verification code");
    bodyHtml += bodyComponents.paragraph(
      "Enter this code to verify your identity. It will expire in " +
        expiresIn +
        "."
    );
    bodyHtml += `<p style="margin: 24px 0; text-align: center;">${bodyComponents.code(code)}</p>`;
    bodyHtml += bodyComponents.muted(
      "If you didn't request this code, you can safely ignore this email."
    );

    return wrapWithBaseTemplate(bodyHtml, { subject: "Verification code" }, config);
  },

  renderText(data): string {
    const { code, expiresIn = "10 minutes" } = data;
    return `Your verification code: ${code}\n\nThis code will expire in ${expiresIn}.\n\nIf you didn't request this code, you can safely ignore this email.\n`;
  },
};
