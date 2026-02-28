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
            toast.success(message, description ? { description } : undefined);
        },

        /**
         * Show error toast
         */
        error: (message: string, description?: string) => {
            toast.error(message, description ? { description } : undefined);
        },

        /**
         * Show warning toast
         */
        warning: (message: string, description?: string) => {
            toast.warning(message, description ? { description } : undefined);
        },

        /**
         * Show info toast
         */
        info: (message: string, description?: string) => {
            toast.info(message, description ? { description } : undefined);
        },

        /**
         * Common RBAC-specific toasts
         */
        rbac: {
            organizationCreated: () =>
                toast.success('Organization created', {
                    description: 'The organization has been successfully created.',
                }),
            organizationUpdated: () =>
                toast.success('Organization updated', {
                    description: 'The organization has been successfully updated.',
                }),
            organizationDeleted: () =>
                toast.success('Organization deleted', {
                    description: 'The organization has been permanently deleted.',
                }),
            memberInvited: () =>
                toast.success('Member invited', {
                    description: 'The member invitation has been sent.',
                }),
            memberUpdated: () =>
                toast.success('Member updated', {
                    description: 'The member has been successfully updated.',
                }),
            memberRemoved: () =>
                toast.success('Member removed', {
                    description: 'The member has been removed from the organization.',
                }),
            roleCreated: () =>
                toast.success('Role created', {
                    description: 'The role has been successfully created.',
                }),
            roleUpdated: () =>
                toast.success('Role updated', {
                    description: 'The role has been successfully updated.',
                }),
            roleDeleted: () =>
                toast.success('Role deleted', {
                    description: 'The role has been permanently deleted.',
                }),
            permissionGranted: () =>
                toast.success('Permission granted', {
                    description: 'The permission has been successfully granted.',
                }),
            permissionRevoked: () =>
                toast.success('Permission revoked', {
                    description: 'The permission has been successfully revoked.',
                }),
        },

        /**
         * Show loading toast with promise
         */
        promise: <T>(
            promise: Promise<T>,
            {
                loading,
                success,
                error,
            }: {
                loading: string;
                success: string | ((data: T) => string);
                error: string | ((error: Error) => string);
            },
        ) => {
            toast.promise(promise, {
                loading,
                success,
                error,
            });

            return promise;
        },
    };
}
