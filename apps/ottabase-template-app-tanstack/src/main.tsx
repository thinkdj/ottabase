import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { Providers } from './providers/Providers';
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <Providers>
                <RouterProvider router={router} />
            </Providers>
        </ErrorBoundary>
    </React.StrictMode>,
);
