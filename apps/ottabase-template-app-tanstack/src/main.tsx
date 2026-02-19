import { registerBuiltInThemes } from '@ottabase/brand-engine';
import { RouterProvider } from '@tanstack/react-router';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Providers } from './providers/Providers';
import { router } from './router';
import './styles/globals.css';

// Register built-in themes (default, neo, midnight, etc.) before any component uses getThemeOrDefault
registerBuiltInThemes();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <Providers>
                <RouterProvider router={router} />
            </Providers>
        </ErrorBoundary>
    </React.StrictMode>,
);
