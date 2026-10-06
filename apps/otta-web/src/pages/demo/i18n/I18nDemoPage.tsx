import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { i18nConfig } from '@/ottabase/config/i18n.config';
import { languageAtom } from '@/ottabase/state/appState';
import { DemoPageHeader } from '../DemoPageHeader';
import { languageNames, supportedLanguages, Trans, useTranslation, type SupportedLanguage } from '@ottabase/i18n/react';
import {
    Badge,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { useAtomValue } from 'jotai';
import { useState } from 'react';

export function I18nDemoPage() {
    const { t, i18n } = useTranslation('common');
    const globalLanguage = useAtomValue(languageAtom);
    // The preview reads another language's strings without touching the app's language or storage
    const [preview, setPreview] = useState<SupportedLanguage>(i18n.language as SupportedLanguage);
    const tp = i18n.getFixedT(preview, 'common');

    return (
        <div className="space-y-8">
            <DemoPageHeader
                title="i18n"
                description="Package translations, app overrides and the global language, with a preview of every package language."
            />

            {/* Language Switcher Component */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Language switcher</CardTitle>
                    <CardDescription>
                        The header's switcher: it changes the app's language and offers only the enabled languages.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                    <LanguageSwitcher languages={i18nConfig.enabledLanguages} />
                    <p className="text-sm text-muted-foreground">
                        {i18nConfig.enabledLanguages.length > 1
                            ? 'Pick a language to switch the whole app.'
                            : 'Only one language is enabled, so there is nothing to switch to yet.'}
                    </p>
                </CardContent>
            </Card>

            {/* Supported Languages */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Supported Languages</CardTitle>
                    <CardDescription>
                        The following languages are currently configured in the{' '}
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">@ottabase/i18n</code> package
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {supportedLanguages.map((lang) => (
                            <Badge
                                key={lang}
                                variant={i18n.language === lang ? 'default' : 'outline'}
                                className={
                                    i18n.language === lang
                                        ? 'rounded-full px-3 py-1'
                                        : 'rounded-full border-transparent bg-background px-3 py-1 text-muted-foreground ring-1 ring-border'
                                }
                            >
                                {languageNames[lang]}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Translation Examples */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Translation examples</CardTitle>
                    <CardDescription>
                        Common strings in the language you pick here. The preview is local to this page: the app's
                        language and the saved choice stay as they are.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div
                        role="group"
                        aria-label="Preview language"
                        className="inline-flex flex-wrap rounded-lg bg-muted/40 p-0.5"
                    >
                        {supportedLanguages.map((lang) => (
                            <button
                                key={lang}
                                type="button"
                                onClick={() => setPreview(lang)}
                                aria-pressed={preview === lang}
                                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                                    preview === lang
                                        ? 'bg-background text-foreground ring-1 ring-border'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {languageNames[lang]}
                            </button>
                        ))}
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Translation Key</TableHead>
                                <TableHead>Translated Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">welcome</code>
                                </TableCell>
                                <TableCell>{tp('welcome')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">language</code>
                                </TableCell>
                                <TableCell>{tp('language')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">save</code>
                                </TableCell>
                                <TableCell>{tp('save')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cancel</code>
                                </TableCell>
                                <TableCell>{tp('cancel')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">loading</code>
                                </TableCell>
                                <TableCell>{tp('loading')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">error</code>
                                </TableCell>
                                <TableCell>{tp('error')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">success</code>
                                </TableCell>
                                <TableCell>{tp('success')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">login</code>
                                </TableCell>
                                <TableCell>{tp('login')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">logout</code>
                                </TableCell>
                                <TableCell>{tp('logout')}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Advanced Examples */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Advanced examples</CardTitle>
                    <CardDescription>
                        Interpolation, pluralization and rich text, in the preview language
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Feature</TableHead>
                                <TableHead>Example</TableHead>
                                <TableHead>Usage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Interpolation</code>
                                </TableCell>
                                <TableCell>{tp('greeting', { name: 'Developer' })}</TableCell>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                        t('greeting', &#123; name: 'Developer' &#125;)
                                    </code>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Pluralization (1)</code>
                                </TableCell>
                                <TableCell>{tp('messages', { count: 1 })}</TableCell>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                        t('messages', &#123; count: 1 &#125;)
                                    </code>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Pluralization (5)</code>
                                </TableCell>
                                <TableCell>{tp('messages', { count: 5 })}</TableCell>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                        t('messages', &#123; count: 5 &#125;)
                                    </code>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Rich Text</code>
                                </TableCell>
                                <TableCell>
                                    <Trans
                                        t={tp}
                                        i18nKey="agreement"
                                        components={{
                                            1: <a href="/docs" className="text-primary underline" />,
                                        }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                        &lt;Trans i18nKey="agreement" /&gt;
                                    </code>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* App Config Overrides */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">App Config Overrides</CardTitle>
                    <CardDescription>How this app configures i18n using ottabase/config/i18n.config.ts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Default Language
                            </p>
                            <Badge
                                variant="outline"
                                className="rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border"
                            >
                                {i18nConfig.defaultLanguage}
                            </Badge>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Fallback Language
                            </p>
                            <Badge
                                variant="outline"
                                className="rounded-full border-transparent bg-background text-muted-foreground ring-1 ring-border"
                            >
                                {i18nConfig.fallbackLanguage}
                            </Badge>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Enabled Languages
                            </p>
                            <div className="flex gap-1.5">
                                {i18nConfig.enabledLanguages.map((lang) => (
                                    <Badge
                                        key={lang}
                                        variant="outline"
                                        className="rounded-full border-transparent bg-background text-xs text-muted-foreground ring-1 ring-border"
                                    >
                                        {lang}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 rounded-lg bg-background p-4 ring-1 ring-border">
                        <pre className="text-xs">
                            {`// src/ottabase/config/i18n.config.ts
export const i18nConfig = {
  defaultLanguage: '${i18nConfig.defaultLanguage}',
  enabledLanguages: [${i18nConfig.enabledLanguages.map((l) => `'${l}'`).join(', ')}],
  fallbackLanguage: '${i18nConfig.fallbackLanguage}',
};`}
                        </pre>
                    </div>
                </CardContent>
            </Card>

            {/* Global State Integration */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Global State Integration</CardTitle>
                    <CardDescription>Language syncs with @ottabase/state via Jotai atom</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                i18n Language
                            </p>
                            <Badge className="rounded-full px-4 py-2 text-base">{i18n.language}</Badge>
                        </div>
                        <div className="space-y-2">
                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                State Atom Language
                            </p>
                            <Badge
                                variant="outline"
                                className="rounded-full border-transparent bg-background px-4 py-2 text-base text-muted-foreground ring-1 ring-border"
                            >
                                {globalLanguage}
                            </Badge>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        The switcher above writes both. This app enables{' '}
                        {i18nConfig.enabledLanguages.map((code) => languageNames[code] ?? code).join(', ')}; add a
                        language in <code className="bg-muted px-1 rounded">i18n.config.ts</code> once its strings
                        exist.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Both values stay in sync automatically via{' '}
                        <code className="bg-muted px-1 rounded">useLanguageManager</code> hook
                    </p>
                </CardContent>
            </Card>

            {/* Persistence Demonstration */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Persistence Demonstration</CardTitle>
                    <CardDescription>Language selection persists to localStorage</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                localStorage Key
                            </p>
                            <code className="text-xs bg-muted px-2 py-1 rounded">ottabase.language</code>
                        </div>
                        <div className="space-y-2">
                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                Stored Value
                            </p>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                {typeof localStorage !== 'undefined'
                                    ? localStorage.getItem('ottabase.language') || 'Not set'
                                    : 'N/A'}
                            </code>
                        </div>
                    </div>
                    <div className="rounded-lg bg-background p-4 ring-1 ring-border">
                        <p className="mb-2 text-sm font-medium">Try it!</p>
                        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                            <li>Change language using switcher above</li>
                            <li>Reload this page (F5 or Ctrl+R)</li>
                            <li>Your language selection will be preserved</li>
                        </ol>
                    </div>
                </CardContent>
            </Card>

            {/* Resource Override Comparison */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Resource override example</CardTitle>
                    <CardDescription>
                        App resources override package defaults via deep merge, shown in the app's language
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Translation Key</TableHead>
                                <TableHead>Package Default</TableHead>
                                <TableHead>App Override</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">welcome</code>
                                </TableCell>
                                <TableCell className="text-muted-foreground italic">Welcome to Ottabase</TableCell>
                                <TableCell className="font-medium">{t('welcome')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">app_title</code>
                                </TableCell>
                                <TableCell className="text-muted-foreground italic text-xs">(not in package)</TableCell>
                                <TableCell className="font-medium">{t('app_title' as any)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">save</code>
                                </TableCell>
                                <TableCell className="font-medium">{t('save')}</TableCell>
                                <TableCell className="text-muted-foreground italic text-xs">
                                    (uses package default)
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    <div className="mt-4 rounded-lg bg-background p-4 ring-1 ring-border">
                        <pre className="text-xs">
                            {`// src/locales/en/app.json
{
  "welcome": "Welcome to Ottabase (App Override)", // Overrides package
  "app_title": "Ottabase Application",              // New key
  // "save" not defined, falls back to package "Save"
}`}
                        </pre>
                    </div>
                </CardContent>
            </Card>

            {/* Package Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Package Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Location
                        </h4>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">packages/i18n</code>
                    </div>
                    <div>
                        <h4 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Key Features
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Centralized i18n configuration for the entire monorepo</li>
                            <li>Type-safe translations with TypeScript support</li>
                            <li>Browser language detection and localStorage persistence</li>
                            <li>Support for interpolation, pluralization, and rich text</li>
                            <li>Hybrid model: shared package translations + app-specific overrides</li>
                            <li>Global state integration via Jotai</li>
                            <li>React hooks and components for easy integration</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Usage
                        </h4>
                        <div className="space-y-2">
                            <p className="text-sm">
                                Import the provider:{' '}
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                    import &#123; I18nProvider &#125; from '@ottabase/i18n/react'
                                </code>
                            </p>
                            <p className="text-sm">
                                Use the hook:{' '}
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                    const &#123; t &#125; = useTranslation()
                                </code>
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
