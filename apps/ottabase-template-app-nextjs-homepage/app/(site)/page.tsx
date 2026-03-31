import { getHomepageData } from '../../lib/get-homepage-data';
import { HomePageClient } from '../home-page-client';

/**
 * Homepage — server component loads D1-backed content via TanStack GET /api/homepage/data.
 */
export default async function HomePage() {
    const payload = await getHomepageData();
    return <HomePageClient payload={payload} />;
}
