import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { Providers } from './providers/Providers';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerBuiltInThemes } from '@ottabase/brand-engine';
import { initBrandLayouts } from './ottabase/components/brandLayout.init';

// Register built-in themes (default, neo, crisp, etc.) before any component uses them
registerBuiltInThemes();
initBrandLayouts();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <Providers>
                <RouterProvider router={router} />
            </Providers>
        </ErrorBoundary>
    </React.StrictMode>,
);
