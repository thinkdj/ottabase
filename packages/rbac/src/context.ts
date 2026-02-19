// ============================================================
// @ottabase/rbac - React Context
// ============================================================

/**
 * React context for RBAC
 * This file provides React hooks and context for using RBAC in React components
 */

import type { RBACContext } from './types';

/**
 * React Context for RBAC (placeholder for React implementation)
 *
 * @example
 * ```typescript
 * import { RBACProvider, useRBAC } from '@ottabase/rbac/context';
 *
 * function App() {
 *   return (
 *     <RBACProvider>
 *       <MyComponent />
 *     </RBACProvider>
 *   );
 * }
 *
 * function MyComponent() {
 *   const { hasPermission, hasRole, isAdmin } = useRBAC();
 *
 *   if (!hasPermission('users:read')) {
 *     return <div>Access denied</div>;
 *   }
 *
 *   return <div>Content</div>;
 * }
 * ```
 */

// Note: Actual React implementation would require React as a peer dependency
// This is a placeholder that can be extended when React is available

export interface RBACContextValue extends RBACContext {
    hasPermission: (permission: string | string[], requireAll?: boolean) => boolean;
    hasRole: (role: string | string[], requireAll?: boolean) => boolean;
    isAdmin: () => boolean;
    canAccess: (resource: string, action: string) => boolean;
}

// Export types for consumers to implement their own React context
export type { RBACContext };
