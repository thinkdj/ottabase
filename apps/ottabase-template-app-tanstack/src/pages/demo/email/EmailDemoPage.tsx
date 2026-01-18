import { useState, useMemo, useEffect } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@ottabase/ui-shadcn";
import {
  Eye,
  Code,
  RefreshCw,
  Mail,
  Send,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Settings,
  Info,
} from "lucide-react";
import {
  loginTemplate,
  verificationCodeTemplate,
  wrapWithBaseTemplate,
  bodyComponents,
  getTemplateNames,
  type BaseTemplateConfig,
  type LoginEmailData,
} from "@ottabase/email";

// Import and register app templates
import "@/email/templates";
import {
  spacedOutWelcomeTemplate,
  spacedOutNotificationTemplate,
  spacedOutComponents,
  wrapWithSpacedOutTemplate,
} from "@/email/templates/spaced-out";

type TemplateType =
  | "login"
  | "verification-code"
  | "spaced-out-welcome"
  | "spaced-out-notification"
  | "custom"
  | "custom-spaced";

const DEFAULT_CONFIG: BaseTemplateConfig = {
  appName: "Ottabase",
  primaryColor: "#000000",
  footerText: "You received this email because you requested to sign in.",
  supportEmail: "support@example.com",
  logoUrl: "",
  address: "",
};

const DEFAULT_LOGIN_DATA: LoginEmailData = {
  url: "https://app.example.com/auth?token=abc123xyz",
  email: "user@example.com",
  expiresIn: "15 minutes",
  code: "123456",
};

const DEFAULT_VERIFICATION_DATA = {
  code: "847291",
  expiresIn: "10 minutes",
};

const DEFAULT_WELCOME_DATA = {
  userName: "Alex",
  actionUrl: "https://app.example.com/dashboard",
  actionText: "Go to Dashboard",
  preheader: "Welcome aboard! Your account is ready.",
};

const DEFAULT_NOTIFICATION_DATA = {
  title: "New Comment on Your Post",
  message:
    "Someone left a comment on your recent post. Click below to view it and respond.",
  actionUrl: "https://app.example.com/posts/123",
  actionText: "View Comment",
  preheader: "You have a new notification",
};

export function EmailDemoPage() {
  const [templateType, setTemplateType] = useState<TemplateType>("login");
  const [viewMode, setViewMode] = useState<"preview" | "html">("preview");

  // Template configuration
  const [config, setConfig] = useState<BaseTemplateConfig>(DEFAULT_CONFIG);

  // Template data (JSON)
  const [dataJson, setDataJson] = useState<string>(
    JSON.stringify(DEFAULT_LOGIN_DATA, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Email sending state
  const [emailRecipients, setEmailRecipients] = useState("");
  const [sendStatus, setSendStatus] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [sendMessage, setSendMessage] = useState("");

  // Registered templates
  const [registeredTemplates, setRegisteredTemplates] = useState<string[]>([]);

  useEffect(() => {
    setRegisteredTemplates(getTemplateNames());
  }, []);

  // Parse JSON data
  const parsedData = useMemo(() => {
    try {
      const data = JSON.parse(dataJson);
      setJsonError(null);
      return data;
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON");
      return null;
    }
  }, [dataJson]);

  // Generate rendered HTML
  const renderedHtml = useMemo(() => {
    if (!parsedData) return null;

    try {
      switch (templateType) {
        case "login":
          return loginTemplate.render(parsedData, config);
        case "verification-code":
          return verificationCodeTemplate.render(parsedData, config);
        case "spaced-out-welcome":
          return spacedOutWelcomeTemplate.render(parsedData, {
            ...config,
            primaryColor: config.primaryColor || "#5046e5",
          });
        case "spaced-out-notification":
          return spacedOutNotificationTemplate.render(parsedData, {
            ...config,
            primaryColor: config.primaryColor || "#5046e5",
          });
        case "custom":
          return wrapWithBaseTemplate(
            parsedData.body || "<p>No body content provided</p>",
            { subject: parsedData.subject || "Custom Email" },
            config
          );
        case "custom-spaced":
          return wrapWithSpacedOutTemplate(
            parsedData.body || "<p>No body content provided</p>",
            {
              subject: parsedData.subject || "Custom Email",
              preheader: parsedData.preheader,
            },
            { ...config, primaryColor: config.primaryColor || "#5046e5" }
          );
        default:
          return null;
      }
    } catch (e) {
      return `<pre style="color: red;">Error rendering template: ${e instanceof Error ? e.message : String(e)}</pre>`;
    }
  }, [templateType, parsedData, config]);

  // Handle template change
  const handleTemplateChange = (type: TemplateType) => {
    setTemplateType(type);
    switch (type) {
      case "login":
        setDataJson(JSON.stringify(DEFAULT_LOGIN_DATA, null, 2));
        break;
      case "verification-code":
        setDataJson(JSON.stringify(DEFAULT_VERIFICATION_DATA, null, 2));
        break;
      case "spaced-out-welcome":
        setDataJson(JSON.stringify(DEFAULT_WELCOME_DATA, null, 2));
        break;
      case "spaced-out-notification":
        setDataJson(JSON.stringify(DEFAULT_NOTIFICATION_DATA, null, 2));
        break;
      case "custom":
        setDataJson(
          JSON.stringify(
            {
              subject: "Custom Email",
              body: `${bodyComponents.heading("Custom Email")}${bodyComponents.paragraph("This is a custom email body using the default Notion-style template.")}${bodyComponents.button("Click Me", "https://example.com", config.primaryColor || "#000000")}`,
            },
            null,
            2
          )
        );
        break;
      case "custom-spaced":
        setDataJson(
          JSON.stringify(
            {
              subject: "Custom Spaced Email",
              preheader: "A custom email with the spaced-out template",
              body: `${spacedOutComponents.heading("Spaced Out Custom")}${spacedOutComponents.paragraph("This uses the more airy, Dunked/Linear inspired template.")}${spacedOutComponents.highlight("Highlight boxes look great for important info.")}${spacedOutComponents.button("Take Action", "https://example.com", config.primaryColor || "#5046e5")}`,
            },
            null,
            2
          )
        );
        break;
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    handleTemplateChange(templateType);
    setSendStatus("idle");
    setSendMessage("");
  };

  // Parse email recipients
  const parseRecipients = (input: string): string[] => {
    return input
      .split(/[,;\n]+/)
      .map((email) => email.trim())
      .filter((email) => email && email.includes("@"));
  };

  // Send test emails
  const handleSendEmails = async () => {
    const recipients = parseRecipients(emailRecipients);

    if (recipients.length === 0) {
      setSendStatus("error");
      setSendMessage("Please enter at least one valid email address");
      return;
    }

    if (!renderedHtml) {
      setSendStatus("error");
      setSendMessage("No email content to send. Fix any template errors first.");
      return;
    }

    setSendStatus("sending");
    setSendMessage(`Sending to ${recipients.length} recipient(s)...`);

    try {
      // Call the API to send emails
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: recipients,
          subject: `[Test] ${config.appName || "Email"} - ${templateType}`,
          html: renderedHtml,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          (error as { message?: string }).message ||
            `Failed to send: ${response.status}`
        );
      }

      const result = await response.json();
      setSendStatus("success");
      setSendMessage(
        `Successfully sent to ${recipients.length} recipient(s)!`
      );
    } catch (error) {
      setSendStatus("error");
      setSendMessage(
        error instanceof Error ? error.message : "Failed to send emails"
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">
            Preview, customize, and test @ottabase/email templates
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Configuration Panel */}
        <div className="flex flex-col gap-4">
          {/* Template Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Template</CardTitle>
              <CardDescription>
                {registeredTemplates.length} templates registered
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={templateType}
                onValueChange={(v) => handleTemplateChange(v as TemplateType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="login">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Login / Magic Link
                    </div>
                  </SelectItem>
                  <SelectItem value="verification-code">
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Verification Code
                    </div>
                  </SelectItem>
                  <Separator className="my-1" />
                  <SelectItem value="spaced-out-welcome">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Spaced Out: Welcome
                    </div>
                  </SelectItem>
                  <SelectItem value="spaced-out-notification">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Spaced Out: Notification
                    </div>
                  </SelectItem>
                  <Separator className="my-1" />
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Custom (Notion Style)
                    </div>
                  </SelectItem>
                  <SelectItem value="custom-spaced">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Custom (Spaced Out)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Branding Configuration */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Branding</CardTitle>
              <CardDescription>
                Configure the base template styling
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appName">App Name</Label>
                <Input
                  id="appName"
                  value={config.appName || ""}
                  onChange={(e) =>
                    setConfig({ ...config, appName: e.target.value })
                  }
                  placeholder="My App"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    value={config.primaryColor || ""}
                    onChange={(e) =>
                      setConfig({ ...config, primaryColor: e.target.value })
                    }
                    placeholder="#000000"
                  />
                  <input
                    type="color"
                    value={config.primaryColor || "#000000"}
                    onChange={(e) =>
                      setConfig({ ...config, primaryColor: e.target.value })
                    }
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL (optional)</Label>
                <Input
                  id="logoUrl"
                  value={config.logoUrl || ""}
                  onChange={(e) =>
                    setConfig({ ...config, logoUrl: e.target.value })
                  }
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="footerText">Footer Text</Label>
                <Input
                  id="footerText"
                  value={config.footerText || ""}
                  onChange={(e) =>
                    setConfig({ ...config, footerText: e.target.value })
                  }
                  placeholder="You received this email because..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email (optional)</Label>
                <Input
                  id="supportEmail"
                  value={config.supportEmail || ""}
                  onChange={(e) =>
                    setConfig({ ...config, supportEmail: e.target.value })
                  }
                  placeholder="support@example.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Template Data */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Template Data (JSON)
              </CardTitle>
              <CardDescription>
                Edit the data passed to the template
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={dataJson}
                onChange={(e) => setDataJson(e.target.value)}
                className={`font-mono text-xs min-h-[200px] ${jsonError ? "border-red-500" : ""}`}
                placeholder="Enter JSON data..."
              />
              {jsonError && (
                <p className="text-xs text-red-500 mt-2">{jsonError}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Preview</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === "preview" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("preview")}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button
                  variant={viewMode === "html" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("html")}
                >
                  <Code className="h-4 w-4 mr-1" />
                  HTML
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === "preview" ? (
              <div className="border rounded-lg overflow-hidden bg-white">
                {renderedHtml ? (
                  <iframe
                    srcDoc={renderedHtml}
                    className="w-full min-h-[600px] border-0"
                    title="Email Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    {jsonError
                      ? "Fix JSON errors to see preview"
                      : "No preview available"}
                  </div>
                )}
              </div>
            ) : (
              <div className="border rounded-lg overflow-auto bg-muted/30 max-h-[600px]">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                  {renderedHtml || "No HTML generated"}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Test Email Sending */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Test Email
          </CardTitle>
          <CardDescription>
            Send a test email to verify your template looks correct
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipients">
              Recipients (comma or newline separated)
            </Label>
            <Textarea
              id="recipients"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder="test@example.com, another@example.com"
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              Enter email addresses separated by commas, semicolons, or
              newlines.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleSendEmails}
              disabled={sendStatus === "sending" || !renderedHtml}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendStatus === "sending" ? "Sending..." : "Send Test Email"}
            </Button>

            {sendStatus !== "idle" && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  sendStatus === "success"
                    ? "text-green-600"
                    : sendStatus === "error"
                      ? "text-red-600"
                      : "text-muted-foreground"
                }`}
              >
                {sendStatus === "success" && (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {sendStatus === "error" && (
                  <AlertCircle className="h-4 w-4" />
                )}
                {sendMessage}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Email Configuration
          </CardTitle>
          <CardDescription>
            How email sending is configured in this application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Provider:</strong> This app uses{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded">
                    @ottabase/email
                  </code>{" "}
                  with Resend as the email provider.
                </p>
                <p>
                  <strong>Environment Variables Required:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>
                    <code className="bg-muted px-1 rounded">RESEND_API_KEY</code>{" "}
                    - Your Resend API key
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">EMAIL_FROM</code> -
                    Sender email address (must be verified in Resend)
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">APP_NAME</code>{" "}
                    (optional) - App name for email templates
                  </li>
                  <li>
                    <code className="bg-muted px-1 rounded">
                      APP_PRIMARY_COLOR
                    </code>{" "}
                    (optional) - Brand color for emails
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Usage in Code</h4>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto">
              {`import { createMailer, createResendProvider, loginTemplate } from "@ottabase/email";

const mailer = createMailer({
  provider: createResendProvider({ apiKey: process.env.RESEND_API_KEY }),
  defaultFrom: process.env.EMAIL_FROM,
  templateConfig: {
    appName: "My App",
    primaryColor: "#5046e5",
  },
});

// Send a templated email
await mailer.send({
  template: loginTemplate,
  data: { url: "https://app.example.com/auth?token=xxx" },
  to: "user@example.com",
});`}
            </pre>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Alternative: Cloudflare Workers</h4>
            <p className="text-sm text-muted-foreground">
              For Cloudflare Workers, you can use MailChannels (free) or the
              native Cloudflare Email binding:
            </p>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto">
              {`import { createMailChannelsProvider } from "@ottabase/email";

// Free email sending via MailChannels
// Requires SPF record: v=spf1 include:relay.mailchannels.net ~all
const provider = createMailChannelsProvider({ domain: "myapp.com" });`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Body Components Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Available Body Components
          </CardTitle>
          <CardDescription>
            Use these in custom templates via bodyComponents.* or
            spacedOutComponents.*
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-3">
                Default Template (bodyComponents)
              </h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    heading(text, level?)
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Heading (h1, h2, h3)
                  </p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    paragraph(text)
                  </code>
                  <p className="text-xs text-muted-foreground">Paragraph</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    button(text, url, color?)
                  </code>
                  <p className="text-xs text-muted-foreground">Primary CTA</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    buttonOutline(text, url)
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Secondary button
                  </p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    code(text)
                  </code>
                  <p className="text-xs text-muted-foreground">Code display</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    divider()
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Horizontal rule
                  </p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    muted(text)
                  </code>
                  <p className="text-xs text-muted-foreground">Muted text</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    callout(text, type?)
                  </code>
                  <p className="text-xs text-muted-foreground">Info box</p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium text-sm mb-3">
                Spaced Out Template (spacedOutComponents)
              </h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    heading(text)
                  </code>
                  <p className="text-xs text-muted-foreground">Large heading</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    paragraph(text)
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Comfortable paragraph
                  </p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    button(text, url, color?)
                  </code>
                  <p className="text-xs text-muted-foreground">Large button</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    buttonSecondary(text, url)
                  </code>
                  <p className="text-xs text-muted-foreground">Subtle button</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    highlight(text)
                  </code>
                  <p className="text-xs text-muted-foreground">Highlight box</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    code(text)
                  </code>
                  <p className="text-xs text-muted-foreground">
                    Large code display
                  </p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    divider()
                  </code>
                  <p className="text-xs text-muted-foreground">Light divider</p>
                </div>
                <div className="space-y-1">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    muted(text)
                  </code>
                  <p className="text-xs text-muted-foreground">Helper text</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
