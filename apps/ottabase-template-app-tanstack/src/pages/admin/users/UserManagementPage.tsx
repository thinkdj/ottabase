/**
 * User Management Page (Admin)
 *
 * System-wide user management for admins
 * GitHub-like minimal UI with dark mode support
 */

import { TableSkeleton } from '@/components/LoadingSkeletons';
import { api } from '@/lib/api';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Calendar, Mail, Search, Shield, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

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

    const { data: allUsers = [], isLoading } = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: async () => {
            const response = await api<{
                data: Array<User | { entity: string; data: User }>;
            }>('/api/admin/users');

            // Support both flat and nested payloads while filtering out invalid entries.
            return response.data
                .map((item) => ('data' in item ? item.data : item))
                .filter((user): user is User => !!user && typeof user.id === 'string');
        },
        staleTime: 2 * 60 * 1000,
    });

    const users = useMemo(
        () =>
            allUsers.filter(
                (user) =>
                    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.email?.toLowerCase().includes(searchTerm.toLowerCase()),
            ),
        [allUsers, searchTerm],
    );

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="h-6 w-6" />
                        User Management
                    </h1>
                    <p className="text-muted-foreground mt-1">View and manage all users across the system</p>
                </div>
                <Button variant="outline" asChild>
                    <Link to="/admin">← Back to Admin</Link>
                </Button>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Users</CardDescription>
                        <CardTitle className="text-2xl">{allUsers.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Admins</CardDescription>
                        <CardTitle className="text-2xl">{allUsers.filter((u) => u.role === 'admin').length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Verified</CardDescription>
                        <CardTitle className="text-2xl">{allUsers.filter((u) => u.emailVerified).length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>This Month</CardDescription>
                        <CardTitle className="text-2xl">
                            {allUsers.filter((u) => new Date(u.createdAt).getMonth() === new Date().getMonth()).length}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>All Users</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <TableSkeleton rows={5} columns={5} />
                    ) : users.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No users found matching your search
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={user.image || undefined} />
                                                    <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-medium">{user.name || 'No name'}</div>
                                                    <code className="text-xs text-muted-foreground">{user.id}</code>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                {user.email || 'No email'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {user.role === 'admin' ? (
                                                <Badge variant="default" className="gap-1">
                                                    <Shield className="h-3 w-3" />
                                                    Admin
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">User</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.emailVerified ? (
                                                <Badge variant="outline" className="gap-1">
                                                    Verified
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">Pending</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="h-4 w-4" />
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link to={`/admin/users/${user.id}/rbac`}>View</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
