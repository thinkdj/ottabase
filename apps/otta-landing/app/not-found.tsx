import { LandingView } from '@ottabase/ottalanding/react';
import { getSite } from '../lib/content';
import { SetupNotice } from './setup-notice';

/** A 404 in the site's own theme, with its navigation, so visitors can find their way back. */
export default async function NotFound() {
    const site = await getSite();
    if (!site) return <SetupNotice />;
    return (
        <LandingView
            site={site}
            sections={[
                {
                    id: 'not-found',
                    type: 'hero',
                    data: {
                        title: 'This page doesn’t exist',
                        subtitle: 'It may have moved, or it hasn’t been published yet.',
                        actions: [{ label: 'Go to the home page', href: '/' }],
                    },
                },
            ]}
        />
    );
}
