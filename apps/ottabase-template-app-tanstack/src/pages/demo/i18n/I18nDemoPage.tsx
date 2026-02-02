import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { languageNames, supportedLanguages, Trans, useTranslation } from '@ottabase/i18n/react';
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

export function I18nDemoPage() {
    const { t, i18n } = useTranslation('common');

    return (
        <div className="container max-w-5xl mx-auto py-8 space-y-8">
            <div className="space-y-2">
                <h1 className="text-4xl font-bold">Internationalization (i18n) Demo</h1>
                <p className="text-muted-foreground">
                    This page demonstrates the i18n functionality integrated into the Ottabase monorepo using i18next
                    and react-i18next.
                </p>
            </div>

            {/* Current Language */}
            <Card>
                <CardHeader>
                    <CardTitle>Current Language</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Badge variant="default" className="text-base px-4 py-2">
                            {languageNames[i18n.language as keyof typeof languageNames] || i18n.language}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                            Use the language switcher in the header to change the language.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Language Switcher Component */}
            <Card>
                <CardHeader>
                    <CardTitle>Language Switcher</CardTitle>
                    <CardDescription>Interactive component to change the application language</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                    <LanguageSwitcher />
                    <p className="text-sm text-muted-foreground">Click to switch between available languages</p>
                </CardContent>
            </Card>

            {/* Supported Languages */}
            <Card>
                <CardHeader>
                    <CardTitle>Supported Languages</CardTitle>
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
                                className="px-3 py-1"
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
                    <CardTitle>Translation Examples</CardTitle>
                    <CardDescription>
                        Below are examples of common translations. Switch languages to see them change in real-time.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
                                <TableCell>{t('welcome')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">language</code>
                                </TableCell>
                                <TableCell>{t('language')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">save</code>
                                </TableCell>
                                <TableCell>{t('save')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cancel</code>
                                </TableCell>
                                <TableCell>{t('cancel')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">loading</code>
                                </TableCell>
                                <TableCell>{t('loading')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">error</code>
                                </TableCell>
                                <TableCell>{t('error')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">success</code>
                                </TableCell>
                                <TableCell>{t('success')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">login</code>
                                </TableCell>
                                <TableCell>{t('login')}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>
                                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">logout</code>
                                </TableCell>
                                <TableCell>{t('logout')}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Advanced Examples */}
            <Card>
                <CardHeader>
                    <CardTitle>Advanced Examples</CardTitle>
                    <CardDescription>Interpolation, pluralization, and rich text rendering</CardDescription>
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
                                <TableCell>{t('greeting', { name: 'Developer' })}</TableCell>
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
                                <TableCell>{t('messages', { count: 1 })}</TableCell>
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
                                <TableCell>{t('messages', { count: 5 })}</TableCell>
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
                                        i18nKey="agreement"
                                        components={{
                                            1: <a href="#" className="text-primary underline" />,
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

            {/* Package Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Package Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="text-sm font-semibold mb-2">Location</h4>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">packages/i18n</code>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold mb-2">Key Features</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Centralized i18n configuration for the entire monorepo</li>
                            <li>Type-safe translations with TypeScript support</li>
                            <li>Browser language detection and localStorage persistence</li>
                            <li>Support for interpolation, pluralization, and rich text</li>
                            <li>Hybrid model: shared package translations + app-specific overrides</li>
                            <li>React hooks and components for easy integration</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold mb-2">Usage</h4>
                        <div className="space-y-2">
                            <p className="text-sm">
                                Import the provider in your app:{' '}
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                    import &#123; I18nProvider &#125; from '@ottabase/i18n/react'
                                </code>
                            </p>
                            <p className="text-sm">
                                Use the hook in components:{' '}
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
