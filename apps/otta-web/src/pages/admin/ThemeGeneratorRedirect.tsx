import { Navigate } from '@tanstack/react-router';

/** Redirects to Brand Engine Theme tab → Color generator sub-tab */
export function ThemeGeneratorRedirect() {
    return <Navigate to="/admin/brand-engine" />;
}
