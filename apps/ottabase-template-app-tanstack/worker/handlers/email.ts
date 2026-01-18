import type { CloudflareEnv } from "@ottabase/cf";
import type { TemplateContent, TemplateVariables } from "@ottabase/email";
import { createResendMailer, sendTemplatedEmail } from "@ottabase/email";
import { errorResponse } from "@ottabase/utils/http-errors";
import { jsonResponse } from "@ottabase/utils/http-response";
import { registerAppEmailTemplates } from "../../src/email/templates";
import { readJson } from "../utils";

export async function handleEmailTest(
  request: Request,
  env: CloudflareEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/email/test" || request.method !== "POST") {
    return null;
  }

  const body = await readJson<{
    recipients?: string[];
    template?: string;
    emailType?: string;
    subject?: string;
    content?: TemplateContent;
    variables?: TemplateVariables;
  }>(request);

  const emailServer =
    typeof env.EMAIL_SERVER === "string" ? env.EMAIL_SERVER : undefined;
  const resendKey =
    typeof env.EMAIL_RESEND_API_KEY === "string"
      ? env.EMAIL_RESEND_API_KEY
      : undefined;
  const emailFrom =
    typeof env.EMAIL_FROM === "string" ? env.EMAIL_FROM : undefined;

  if (!emailServer && !resendKey) {
    return errorResponse(
      "EMAIL_SERVER or EMAIL_RESEND_API_KEY must be configured",
      400,
      {
        code: "CONFIG_ERROR",
      },
    );
  }

  const from = emailFrom || "noreply@example.com";
  const recipients = body.recipients || [];

  if (!recipients.length) {
    return errorResponse("Recipients list is required", 400, {
      code: "VALIDATION_ERROR",
    });
  }

  registerAppEmailTemplates();

  const mailer = emailServer
    ? await (async () => {
        const { createNodemailerMailer } =
          await import("@ottabase/email/providers/nodemailer");
        return createNodemailerMailer({ server: emailServer });
      })()
    : createResendMailer({ apiKey: resendKey || "" });

  const results = await Promise.all(
    recipients.map(async (email) => {
      const response = await sendTemplatedEmail(mailer, {
        from,
        to: email,
        template: body.template || "default",
        subject: body.subject || "Test Email",
        variables: body.variables,
        content: body.content || {
          header: "Test Email",
          body: "<p>Hello from Ottabase.</p>",
          footer: "<p>Sent from /api/email/test</p>",
        },
      });

      return {
        email,
        ok: response.success,
      };
    }),
  );

  return jsonResponse(
    {
      ok: true,
      emailType: body.emailType,
      results,
    },
    200,
  );
}
