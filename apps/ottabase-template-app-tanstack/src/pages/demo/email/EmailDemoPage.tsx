import { useState, useMemo } from "react";
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
} from "@ottabase/ui-shadcn";
import { Eye, Code, RefreshCw, Mail } from "lucide-react";
import {
  loginTemplate,
  verificationCodeTemplate,
  wrapWithBaseTemplate,
  bodyComponents,
  type BaseTemplateConfig,
  type LoginEmailData,
} from "@ottabase/email";

type TemplateType = "login" | "verification-code" | "custom";

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
        case "custom":
          // Custom template - render the body from JSON directly
          return wrapWithBaseTemplate(
            parsedData.body || "<p>No body content provided</p>",
            { subject: parsedData.subject || "Custom Email" },
            config
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
      case "custom":
        setDataJson(
          JSON.stringify(
            {
              subject: "Custom Email",
              body: `${bodyComponents.heading("Custom Email")}${bodyComponents.paragraph("This is a custom email body. You can use HTML here.")}${bodyComponents.button("Click Me", "https://example.com", config.primaryColor)}`,
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
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">
            Preview and customize @ottabase/email templates
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
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Custom Template
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

      {/* Body Components Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Available Body Components
          </CardTitle>
          <CardDescription>
            Use these in custom templates via bodyComponents.*
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                bodyComponents.heading(text, level?)
              </code>
              <p className="text-xs text-muted-foreground">
                Heading element (h1, h2, or h3)
              </p>
            </div>
            <div className="space-y-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                bodyComponents.paragraph(text)
              </code>
              <p className="text-xs text-muted-foreground">Paragraph text</p>
            </div>
            <div className="space-y-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                bodyComponents.button(text, url, color?)
              </code>
              <p className="text-xs text-muted-foreground">
                Primary CTA button
              </p>
            </div>
            <div className="space-y-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                bodyComponents.buttonOutline(text, url, color?)
              </code>
              <p className="text-xs text-muted-foreground">
                Secondary/outline button
              </p>
            </div>
            <div className="space-y-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                bodyComponents.code(text)
              </code>
              <p className="text-xs text-muted-foreground">
                Code/token display box
              </p>
            </div>
            <div className="space-y-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                bodyComponents.divider()
              </code>
              <p className="text-xs text-muted-foreground">Horizontal rule</p>
            </div>
            <div className="space-y-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                bodyComponents.muted(text)
              </code>
              <p className="text-xs text-muted-foreground">
                Muted/secondary text
              </p>
            </div>
            <div className="space-y-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                bodyComponents.callout(text, type?)
              </code>
              <p className="text-xs text-muted-foreground">
                Info/warning/success box
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
