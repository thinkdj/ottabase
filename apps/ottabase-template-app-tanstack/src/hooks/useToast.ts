import { toast } from '@ottabase/ui-shadcn';

/**
 * Enhanced toast hook with common patterns for RBAC UI
 */
export function useRBACToast() {
    return {
        /**
         * Show success toast
         */
        success: (message: string, description?: string) => {
            toast({
                title: message,
                description,
                variant: 'default',
            });
        },

        /**
         * Show error toast
         */
        error: (message: string, description?: string) => {
            toast({
                title: message,
                description,
                variant: 'destructive',
            });
        },

        /**
         * Show warning toast
         */
        warning: (message: string, description?: string) => {
            toast({
                title: message,
                description,
            });
        },

        /**
         * Show info toast
         */
        info: (message: string, description?: string) => {
            toast({
                title: message,
                description,
            });
        },

        /**
         * Common RBAC-specific toasts
         */
        rbac: {
            organizationCreated: () => toast({
                title: 'Organization created',
                description: 'The organization has been successfully created.',
            }),
            organizationUpdated: () => toast({
                title: 'Organization updated',
                description: 'The organization has been successfully updated.',
            }),
            organizationDeleted: () => toast({
                title: 'Organization deleted',
                description: 'The organization has been permanently deleted.',
            }),
            memberInvited: () => toast({
                title: 'Member invited',
                description: 'The member invitation has been sent.',
            }),
            memberUpdated: () => toast({
                title: 'Member updated',
                description: 'The member has been successfully updated.',
            }),
            memberRemoved: () => toast({
                title: 'Member removed',
                description: 'The member has been removed from the organization.',
            }),
            roleCreated: () => toast({
                title: 'Role created',
                description: 'The role has been successfully created.',
            }),
            roleUpdated: () => toast({
                title: 'Role updated',
                description: 'The role has been successfully updated.',
            }),
            roleDeleted: () => toast({
                title: 'Role deleted',
                description: 'The role has been permanently deleted.',
            }),
            permissionGranted: () => toast({
                title: 'Permission granted',
                description: 'The permission has been successfully granted.',
            }),
            permissionRevoked: () => toast({
                title: 'Permission revoked',
                description: 'The permission has been successfully revoked.',
            }),
        },

        /**
         * Show loading toast with promise
         */
        promise: <T,>(
            promise: Promise<T>,
            {
                loading,
                success,
                error,
            }: {
                loading: string;
                success: string | ((data: T) => string);
                error: string | ((error: Error) => string);
            }
        ) => {
            const loadingToast = toast({
                title: loading,
                description: 'Please wait...',
            });

            promise
                .then((data) => {
                    loadingToast.dismiss();
                    toast({
                        title: typeof success === 'function' ? success(data) : success,
                        variant: 'default',
                    });
                })
                .catch((err) => {
                    loadingToast.dismiss();
                    toast({
                        title: typeof error === 'function' ? error(err) : error,
                        description: err instanceof Error ? err.message : undefined,
                        variant: 'destructive',
                    });
                });

            return promise;
        },
    };
}
