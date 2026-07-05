/**
 * User Management Page (Admin)
 *
 * System-wide user management for admins
 */

import { useApiQuery } from '@ottabase/ottaorm/client';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
    Button,
    Input,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import type { PaginatedResponse } from '@ottabase/utils/pagination';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Mail, Search, Shield } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const PER_PAGE = 25;

const CHIP_CLASS =
    'rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border';
const TH_CLASS = 'px-4 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';
const MICRO_LABEL_CLASS = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

interface User {
    id: string;
    name: string | null;
    email: string | null;
    emailVerified: string | null;
    image: string | null;
    createdAt: string;
    role?: 'admin' | 'user';
}

export function UserManagementPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounce search to avoid hammering the API on every keystroke.
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1); // Reset to first page on new search
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [searchTerm]);

    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        params.set('page', String(currentPage));
        params.set('per_page', String(PER_PAGE));
        if (debouncedSearch) params.set('search', debouncedSearch);
        return params.toString();
    }, [currentPage, debouncedSearch]);

    const { data: response, isLoading } = useApiQuery<PaginatedResponse<User>>({
        entity: 'users',
        queryKey: ['admin-users', queryParams],
        endpoint: `/api/admin/users?${queryParams}`,
        queryOptions: { staleTime: 2 * 60 * 1000 },
    });

    const users = response?.data ?? [];
    const pagination = response?.pagination;

    const getUserInitials = (user: User) => {
        if (user.name) {
            return user.name
                .split(' ')
                .filter((n) => n.length > 0)
                .map((n) => n[0])
                .join('')
                .toUpperCase();
        }
        return user.email?.[0]?.toUpperCase() || '?';
    };

    const pageStart = pagination ? (pagination.page - 1) * pagination.perPage + 1 : 0;
    const pageEnd = pagination ? Math.min(pagination.page * pagination.perPage, pagination.total) : 0;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/admin">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Admin
                    </Link>
                </Button>

                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">User Management</h1>
                    <p className="max-w-3xl text-muted-foreground">View and manage all users across the system</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl bg-muted/40 p-5">
                    <p className={MICRO_LABEL_CLASS}>Total Users</p>
                    <p className="mt-2 text-2xl font-semibold">{pagination?.total ?? '—'}</p>
                </div>
            </div>

            {/* Users Table */}
            <section className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-[0.9375rem] font-semibold">All Users</h2>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-9 pl-10"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-3" aria-busy="true">
                        <span className="sr-only">Loading users…</span>
                        {Array.from({ length: 5 }, (_, index) => (
                            <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : users.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <p className="text-sm text-muted-foreground">No users found matching your search</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border/60">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="border-border/60 hover:bg-transparent">
                                    <TableHead className={TH_CLASS}>User</TableHead>
                                    <TableHead className={TH_CLASS}>Email</TableHead>
                                    <TableHead className={TH_CLASS}>Role</TableHead>
                                    <TableHead className={TH_CLASS}>Status</TableHead>
                                    <TableHead className={TH_CLASS}>Joined</TableHead>
                                    <TableHead className={`${TH_CLASS} text-right`}>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow
                                        key={user.id}
                                        className="border-border/60 transition-colors duration-normal hover:bg-muted/40"
                                    >
                                        <TableCell className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8 ring-1 ring-border">
                                                    <AvatarImage src={user.image || undefined} />
                                                    <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-medium">{user.name || 'No name'}</div>
                                                    <code className="font-mono text-xs text-muted-foreground">
                                                        {user.id}
                                                    </code>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                {user.email || 'No email'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            {user.role === 'admin' ? (
                                                <Badge variant="outline" className={`gap-1 ${CHIP_CLASS}`}>
                                                    <Shield className="h-3 w-3" />
                                                    Admin
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className={CHIP_CLASS}>
                                                    User
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            {user.emailVerified ? (
                                                <Badge variant="outline" className={`gap-1.5 ${CHIP_CLASS}`}>
                                                    <span
                                                        className="h-1.5 w-1.5 rounded-full bg-success"
                                                        aria-hidden="true"
                                                    />
                                                    Verified
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className={`gap-1.5 ${CHIP_CLASS}`}>
                                                    <span
                                                        className="h-1.5 w-1.5 rounded-full bg-warning"
                                                        aria-hidden="true"
                                                    />
                                                    Pending
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                <Calendar className="h-4 w-4" />
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-muted-foreground hover:text-foreground"
                                                asChild
                                            >
                                                <Link to={`/admin/access/users/${user.id}/rbac`}>View</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </section>

            {/* Pagination Controls */}
            {!isLoading && pagination && pagination.total > PER_PAGE && (
                <div className="flex items-center justify-between">
                    <p className={MICRO_LABEL_CLASS}>
                        Showing {pageStart}–{pageEnd} of {pagination.total} users
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={pagination.page <= 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Prev
                        </Button>
                        <span className={MICRO_LABEL_CLASS}>
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setCurrentPage((p) => p + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
