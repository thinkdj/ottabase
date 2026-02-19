import { getLandingTheme, initOttaLanding, renderPage } from '@ottabase/ottalanding';
import { homePage, landingThemeId, siteContent } from '@/config/landing.config';

// Register built-in themes (atlas + mono) and set active
initOttaLanding({ defaultThemeId: landingThemeId });

export default function HomePage() {
    const theme = getLandingTheme(landingThemeId)!;
    return renderPage(theme, siteContent, homePage);
}
