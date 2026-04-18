import { registerBuiltInThemes } from '@ottabase/brand-engine';
import { RouterProvider } from '@tanstack/react-router';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Providers } from './providers/Providers';
import { router } from './router';
import './styles/globals.css';

// Register built-in themes (default, neo, midnight, etc.)
registerBuiltInThemes();

// ---------------------------------------------------------------------------
// Embed routes (/embed/*) run in a separate, minimal React tree — no brand,
// session, blog state, or org fetches. Only QueryClient + next-themes.
// ---------------------------------------------------------------------------
const isEmbedRoute = window.location.pathname.startsWith('/embed');

if (isEmbedRoute) {
    // Lazy-load embed app to keep main bundle unaffected
    import('./embed/EmbedApp').then(({ EmbedApp }) => {
        ReactDOM.createRoot(document.getElementById('root')!).render(
            <React.StrictMode>
                <ErrorBoundary>
                    <EmbedApp />
                </ErrorBoundary>
            </React.StrictMode>,
        );
    });
} else {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <ErrorBoundary>
                <Providers>
                    <RouterProvider router={router} />
                </Providers>
            </ErrorBoundary>
        </React.StrictMode>,
    );
}
