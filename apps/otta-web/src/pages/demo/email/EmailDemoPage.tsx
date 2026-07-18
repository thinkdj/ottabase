import { registerAppEmailTemplates } from '@/email/templates';
import { listEmailTemplates, renderEmail } from '@ottabase/email';
import {
    Badge,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Textarea,
} from '@ottabase/ui-shadcn';
import { sanitizeBlockHtml } from '@ottabase/utils/sanitize';
import { useEffect, useMemo, useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

registerAppEmailTemplates();

const EMAIL_TYPES = [
    {
        id: 'login',
        label: 'Login Link',
        description: 'Magic link sign-in email',
        subject: 'Sign in to {{appName}}',
        content: {
            header: 'Sign in to {{appName}}',
            body:
                '<p>Hi {{name}},</p>' +
                '<p>Click the link below to sign in:</p>' +
                '<p><a href="{{url}}">Sign in to {{appName}}</a></p>',
            footer: '<p>This link expires at {{expiresAt}}.</p>',
        },
        variables: {
            appName: 'Ottabase',
            name: 'Ada Lovelace',
            url: 'https://example.com/magic-login',
            expiresAt: '2026-01-18T12:00:00Z',
        },
    },
    {
        id: 'welcome',
        label: 'Welcome',
        description: 'New account welcome email',
        subject: 'Welcome to {{appName}}',
        content: {
            header: 'Welcome to {{appName}}',
            body: '<p>Hey {{name}},</p>' + '<p>Your account is ready. You can now explore your dashboard.</p>',
            footer: '<p>Need help? Reply to this email anytime.</p>',
        },
        variables: {
            appName: 'Ottabase',
            name: 'Ada Lovelace',
        },
    },
    {
        id: 'reset',
        label: 'Password Reset',
        description: 'Password reset email',
        subject: 'Reset your {{appName}} password',
        content: {
            header: 'Reset your password',
            body:
                '<p>We received a request to reset your password.</p>' + '<p><a href="{{url}}">Reset password</a></p>',
            footer: '<p>If you didn’t request this, you can ignore this email.</p>',
        },
        variables: {
            appName: 'Ottabase',
            url: 'https://example.com/reset-password',
        },
    },
] as const;

export function EmailDemoPage() {
    const templateOptions = useMemo(() => listEmailTemplates(), []);
    const [templateName, setTemplateName] = useState(templateOptions[0] || 'default');
    const [emailType, setEmailType] = useState<string>(EMAIL_TYPES[0].id);
    const [variablesText, setVariablesText] = useState(JSON.stringify(EMAIL_TYPES[0].variables, null, 2));
    const [subjectText, setSubjectText] = useState<string>(EMAIL_TYPES[0].subject);
    const [headerText, setHeaderText] = useState<string>(EMAIL_TYPES[0].content.header || '');
    const [bodyText, setBodyText] = useState<string>(EMAIL_TYPES[0].content.body);
    const [footerText, setFooterText] = useState<string>(EMAIL_TYPES[0].content.footer || '');

    const selectedType = useMemo(
        () => EMAIL_TYPES.find((type) => type.id === emailType) || EMAIL_TYPES[0],
        [emailType],
    );

    useEffect(() => {
        setVariablesText(JSON.stringify(selectedType.variables, null, 2));
        setSubjectText(selectedType.subject);
        setHeaderText(selectedType.content.header || '');
        setBodyText(selectedType.content.body);
        setFooterText(selectedType.content.footer || '');
    }, [selectedType]);

    const contentDraft = useMemo(
        () => ({
            header: sanitizeBlockHtml(headerText),
            body: sanitizeBlockHtml(bodyText),
            footer: sanitizeBlockHtml(footerText),
        }),
        [headerText, bodyText, footerText],
    );

    const { parsedVariables, parseError } = useMemo(() => {
        try {
            const parsed = variablesText ? JSON.parse(variablesText) : {};
            return {
                parsedVariables: parsed as Record<string, unknown>,
                parseError: null as string | null,
            };
        } catch (error) {
            return {
                parsedVariables: {},
                parseError: error instanceof Error ? error.message : 'Invalid JSON in variables',
            };
        }
    }, [variablesText]);

    const rendered = useMemo(() => {
        return renderEmail({
            template: templateName,
            variables: parsedVariables,
            content: contentDraft,
            subject: subjectText,
        });
    }, [templateName, parsedVariables, contentDraft, subjectText]);

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="Email Templates"
                description="Preview how @ottabase/email renders templates with replacement data. To send a real test email or check provider status, use Admin → Infrastructure → Email."
            />

            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Template Settings</CardTitle>
                        <CardDescription>Choose a template + email type and adjust the variables JSON.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="space-y-2">
                            <Label>Template</Label>
                            <Select value={templateName} onValueChange={setTemplateName}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {templateOptions.map((name) => (
                                        <SelectItem key={name} value={name}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Email Type</Label>
                            <Select value={emailType} onValueChange={setEmailType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an email type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {EMAIL_TYPES.map((type) => (
                                        <SelectItem key={type.id} value={type.id}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{selectedType.description}</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input
                                value={subjectText}
                                onChange={(event) => setSubjectText(event.target.value)}
                                className="text-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Header</Label>
                            <Textarea
                                value={headerText}
                                onChange={(event) => setHeaderText(event.target.value)}
                                className="min-h-[80px] font-mono text-xs"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Body</Label>
                            <Textarea
                                value={bodyText}
                                onChange={(event) => setBodyText(event.target.value)}
                                className="min-h-[180px] font-mono text-xs"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Footer</Label>
                            <Textarea
                                value={footerText}
                                onChange={(event) => setFooterText(event.target.value)}
                                className="min-h-[100px] font-mono text-xs"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Replacement JSON</Label>
                            <Textarea
                                value={variablesText}
                                onChange={(event) => setVariablesText(event.target.value)}
                                className="min-h-[220px] font-mono text-xs"
                            />
                            {parseError ? (
                                <Badge variant="destructive" className="text-xs">
                                    {parseError}
                                </Badge>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Parsed replacements are used by Handlebars.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardHeader>
                        <CardTitle className="text-[0.9375rem] font-semibold">Rendered Preview</CardTitle>
                        <CardDescription>Subject: {rendered.subject || '(no subject)'}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="overflow-hidden rounded-lg bg-background ring-1 ring-border">
                            <iframe
                                className="email-preview block min-h-[28rem] w-full bg-background"
                                title="Rendered email HTML preview"
                                sandbox=""
                                srcDoc={rendered.html}
                            />
                        </div>
                        <div className="rounded-lg bg-background p-3 text-xs text-muted-foreground ring-1 ring-border">
                            <div className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Plain Text
                            </div>
                            <pre className="whitespace-pre-wrap break-words">{rendered.text}</pre>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
