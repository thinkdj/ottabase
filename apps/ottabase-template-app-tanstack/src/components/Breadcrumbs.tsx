import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@ottabase/ui-shadcn';
import { Link, useRouterState } from '@tanstack/react-router';
import { Home } from 'lucide-react';
import { useMemo } from 'react';

/**
 * Route metadata for breadcrumb configuration
 * Can be extended on routes via route.context or route options
 */
export interface BreadcrumbMeta {
    /** Custom label to display instead of auto-generated one */
    label?: string;
    /** Whether to hide this segment from breadcrumbs */
    hide?: boolean;
    /** Icon to show before the label */
    icon?: React.ReactNode;
    /** Custom path override (useful for index routes) */
    href?: string;
}

interface BreadcrumbSegment {
    label: string;
    path: string;
    isLast: boolean;
    icon?: React.ReactNode;
}

/**
 * Route label overrides - configure custom labels for specific paths
 * This provides smart labeling instead of just slugifying URLs
 */
const ROUTE_LABELS: Record<string, string> = {
    '/': 'Home',
    '/demo': 'Demos',
    '/demo/mantine': 'Mantine UI',
    '/demo/shadcn': 'shadcn/ui',
    '/demo/ottaeditor': 'OttaEditor',
    '/demo/ottaorm': 'OttaORM',
    '/demo/ottaforms': 'OttaForms',
    '/demo/ottaselect': 'OttaSelect',
    '/demo/cropper': 'Image Cropper',
    '/demo/timezone': 'Timezone Utils',
    '/demo/api': 'API Client',
    '/demo/renderer': 'Content Renderer',
    '/demo/email': 'Email Templates',
    '/demo/state': 'State Management',
    '/demo/logger': 'Logger',
    '/demo/i18n': 'Internationalization',
    '/demo/theming': 'Theming',
    '/demo/notifications': 'Notifications',
    '/demo/cloudflare': 'Cloudflare Services',
    '/demo/cloudflare/d1': 'D1 Database',
    '/demo/cloudflare/kv': 'KV Storage',
    '/demo/cloudflare/r2': 'R2 Storage',
    '/demo/cloudflare/file-upload': 'File Upload',
    '/demo/cloudflare/images': 'Cloudflare Images',
    '/demo/cloudflare/hyperdrive': 'Hyperdrive',
    '/demo/cloudflare/queues': 'Queues',
    '/demo/cloudflare/rate-limiting': 'Rate Limiting',
    '/demo/cloudflare/realtime': 'Realtime Pub/Sub',
};

/**
 * Generates a human-readable label from a path segment
 * Converts kebab-case and snake_case to Title Case
 */
function generateLabel(segment: string): string {
    if (!segment) return '';

    // Handle special cases
    if (segment === 'd1') return 'D1';
    if (segment === 'kv') return 'KV';
    if (segment === 'r2') return 'R2';
    if (segment === 'i18n') return 'i18n';
    if (segment === 'ui') return 'UI';

    // Convert kebab-case or snake_case to Title Case
    return segment
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Build breadcrumb segments from the current path
 */
function buildBreadcrumbs(pathname: string): BreadcrumbSegment[] {
    // Always start with home
    const segments: BreadcrumbSegment[] = [
        {
            label: 'Home',
            path: '/',
            isLast: pathname === '/',
            icon: <Home className="h-3.5 w-3.5" />,
        },
    ];

    if (pathname === '/') {
        return segments;
    }

    // Split path and build cumulative paths
    const parts = pathname.split('/').filter(Boolean);
    let currentPath = '';

    parts.forEach((part, index) => {
        currentPath += `/${part}`;
        const isLast = index === parts.length - 1;

        // Check if we have a custom label for this exact path
        const customLabel = ROUTE_LABELS[currentPath];
        const label = customLabel || generateLabel(part);

        segments.push({
            label,
            path: currentPath,
            isLast,
        });
    });

    return segments;
}

interface BreadcrumbsProps {
    /** Custom className for the nav element */
    className?: string;
    /** Whether to show home icon instead of text */
    homeIcon?: boolean;
    /** Maximum number of intermediate segments to show before ellipsis (0 = no limit) */
    maxItems?: number;
    /** Custom separator between items */
    separator?: React.ReactNode;
}

/**
 * Smart Breadcrumbs component for TanStack Router
 *
 * Features:
 * - Automatically generates breadcrumbs from current route
 * - Uses custom labels from ROUTE_LABELS configuration
 * - Falls back to smart path-to-label conversion
 * - Supports icons, custom separators, and ellipsis for long paths
 * - Fully accessible with ARIA attributes
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Breadcrumbs />
 *
 * // With home icon
 * <Breadcrumbs homeIcon />
 *
 * // Limit visible items (shows ellipsis)
 * <Breadcrumbs maxItems={3} />
 *
 * // Custom separator
 * <Breadcrumbs separator={<span>/</span>} />
 * ```
 */
export function Breadcrumbs({ className, homeIcon = false, maxItems = 0, separator }: BreadcrumbsProps) {
    const routerState = useRouterState();
    const pathname = routerState.location.pathname;

    const segments = useMemo(() => buildBreadcrumbs(pathname), [pathname]);

    // Apply maxItems limit if specified
    const displaySegments = useMemo(() => {
        if (maxItems === 0 || segments.length <= maxItems) {
            return segments;
        }

        // Always show first (home) and last (current page)
        // Show ellipsis for middle items if exceeding maxItems
        const start = segments[0];
        const end = segments[segments.length - 1];
        const middleCount = maxItems - 2; // Reserve slots for start and end

        if (middleCount <= 0) {
            return [start, end];
        }

        const middle = segments.slice(1, -1);
        const displayMiddle = middle.slice(-middleCount);

        return [start, ...displayMiddle, end];
    }, [segments, maxItems]);

    const showEllipsis = maxItems > 0 && segments.length > maxItems;

    return (
        <Breadcrumb className={className}>
            <BreadcrumbList>
                {displaySegments.map((segment, index) => {
                    const isFirst = index === 0;
                    const showSeparator = index > 0;

                    return (
                        <div key={segment.path} className="contents">
                            {showSeparator && <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>}

                            {/* Show ellipsis if we're skipping middle items */}
                            {showEllipsis && index === 1 && segments.length > maxItems && (
                                <>
                                    <BreadcrumbItem>
                                        <span className="text-muted-foreground">...</span>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>
                                </>
                            )}

                            <BreadcrumbItem>
                                {segment.isLast ? (
                                    <BreadcrumbPage className="inline-flex items-center">
                                        {segment.icon && !homeIcon && (
                                            <span className="mr-1.5 inline-flex">{segment.icon}</span>
                                        )}
                                        {isFirst && homeIcon ? segment.icon : segment.label}
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <Link to={segment.path} className="inline-flex items-center">
                                            {segment.icon && !(isFirst && homeIcon) && (
                                                <span className="mr-1.5 inline-flex">{segment.icon}</span>
                                            )}
                                            {isFirst && homeIcon ? segment.icon : segment.label}
                                        </Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </div>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
