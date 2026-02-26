import { buildCSSVarMap, getThemeByName, registerBuiltInThemes, resolveTheme } from '@ottabase/brand-engine';
import { notFound } from 'next/navigation';
import { ThemePreviewClient } from './ThemePreviewClient';

registerBuiltInThemes();

interface ThemePreviewPageProps {
    params: Promise<{ themeName: string }>;
}

export async function generateMetadata({ params }: ThemePreviewPageProps) {
    const { themeName } = await params;
    return {
        title: `${themeName.charAt(0).toUpperCase() + themeName.slice(1)} theme — Ottabase`,
        description: `Preview the ${themeName} brand theme applied to Atlas and Mono marketing templates.`,
    };
}

export default async function ThemePreviewPage({ params }: ThemePreviewPageProps) {
    const { themeName } = await params;

    const theme = getThemeByName(themeName);
    if (!theme) notFound();

    // Resolve CSS variables for both light and dark modes
    const lightResolved = resolveTheme({ base: theme, mode: 'light' });
    const darkResolved = resolveTheme({ base: theme, mode: 'dark' });

    const lightVars = buildCSSVarMap(lightResolved);
    const darkVars = buildCSSVarMap(darkResolved);

    return <ThemePreviewClient themeName={themeName} lightVars={lightVars} darkVars={darkVars} />;
}
