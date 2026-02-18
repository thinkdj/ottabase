import { RouterProvider } from '@tanstack/react-router';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Providers } from './providers/Providers';
import { router } from './router';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <Providers>
                <RouterProvider router={router} />
            </Providers>
        </ErrorBoundary>
    </React.StrictMode>,
);
