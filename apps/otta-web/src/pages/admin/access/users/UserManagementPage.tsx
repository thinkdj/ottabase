/**
 * Users (admin): everyone with an account, and the way into what each person may do.
 */
import { StatList } from '@/components/admin/StatList';
import type { PaginatedResponse } from '@/lib/api-types';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Chip } from '@ottabase/ui-components';
import { useDataTable, useListState } from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable } from '@ottabase/ui-datatable/react';
import { Alert, Avatar, AvatarFallback, AvatarImage } from '@ottabase/ui-shadcn';
import { formatShortDate } from '@ottabase/utils/timezone';
import { keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ShieldCheck, Users } from 'lucide-react';
import { useCallback, useMemo } from 'react';

interface User {
    id: string;
    name: string | null;
    email: string | null;
    emailVerified: string | null;
    image: string | null;
    createdAt: string;
    role?: 'admin' | 'user';
}

interface UserStats {
    total: number;
    admins: number;
    verified: number;
    newThisMonth: number;
}

const NO_USERS: User[] = [];

const initials = (user: User) =>
    (user.name || user.email || '?')
        .split(/[\s@]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

export function UserManagementPage() {
    const navigate = useNavigate();
    const list = useListState();
    const users = useApiQuery<PaginatedResponse<User> & { stats?: UserStats | null }>({
        entity: 'users',
        queryKey: ['admin-users', list.params],
        endpoint: `/api/admin/users?${list.params}`,
        queryOptions: { placeholderData: keepPreviousData, meta: { errorPresentation: 'local' } },
    });
    const rows = users.data?.data ?? NO_USERS;
    const total = users.data?.pagination.total;
    const stats = users.data?.stats;

    const openAccess = useCallback(
        (user: User) => void navigate({ to: '/admin/access/users/$userId/rbac', params: { userId: user.id } }),
        [navigate],
    );

    const columns = useMemo(
        () => [
            ...createColumns<User>([
                {
                    key: 'name',
                    header: 'User',
                    cell: ({ row }) => (
                        <span className="flex min-w-[14rem] items-center gap-3">
                            <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border">
                                <AvatarImage src={row.image || undefined} />
                                <AvatarFallback className="text-xs">{initials(row)}</AvatarFallback>
                            </Avatar>
                            <span className="min-w-0">
                                <span className="block truncate font-medium">{row.name || 'No name'}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                    {row.email || 'No email'}
                                </span>
                            </span>
                        </span>
                    ),
                },
                {
                    key: 'role',
                    header: 'Role',
                    width: 110,
                    cell: ({ row }) => <Chip>{row.role === 'admin' ? 'Admin' : 'User'}</Chip>,
                },
                {
                    key: 'emailVerified',
                    header: 'Email',
                    width: 130,
                    cell: ({ row }) =>
                        row.emailVerified ? <Chip dot="success">Verified</Chip> : <Chip dot="warning">Unverified</Chip>,
                },
                {
                    key: 'createdAt',
                    header: 'Joined',
                    width: 130,
                    cell: ({ row }) => <span className="text-muted-foreground">{formatShortDate(row.createdAt)}</span>,
                },
                {
                    key: 'id',
                    header: 'ID',
                    visible: false,
                    cell: ({ row }) => <code className="font-mono text-xs text-muted-foreground">{row.id}</code>,
                },
            ]),
            actionsColumn<User>([{ label: 'Access', icon: ShieldCheck, onClick: openAccess }]),
        ],
        [openAccess],
    );

    const { table } = useDataTable<User>({ data: rows, columns, getRowId: (row) => row.id, list, rowCount: total });

    return (
        <div className="space-y-8">
            <header className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <Users className="h-7 w-7 text-primary" />
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Users</h1>
                </div>
                <p className="text-muted-foreground">
                    Everyone with an account. Open a person to manage their roles and organizations.
                </p>
            </header>

            {users.error && <Alert variant="destructive">{users.error.message}</Alert>}

            {stats && (
                <StatList
                    stats={[
                        { label: 'Total', value: stats.total },
                        { label: 'Platform admins', value: stats.admins },
                        { label: 'Verified emails', value: stats.verified },
                        { label: 'New this month', value: stats.newThisMonth },
                    ]}
                />
            )}

            <DataTable
                table={table}
                isLoading={users.isLoading}
                onRowClick={openAccess}
                emptyIcon={Users}
                emptyMessage={list.query ? 'No one matches your search.' : 'No users yet.'}
                searchValue={list.search}
                onSearchChange={list.setSearch}
                searchPlaceholder="Search by name or email"
                pageSizeOptions={[25, 50, 100]}
            />
        </div>
    );
}
