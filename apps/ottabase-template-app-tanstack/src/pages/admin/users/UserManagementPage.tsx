/**
 * User Management Page (Admin)
 *
 * System-wide user management for admins
 * GitHub-like minimal UI with dark mode support
 */

import { useState } from 'react';
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
import { Users, Search, Mail, Calendar, Shield } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { TableSkeleton } from '@/components/LoadingSkeletons';

interface User {
    id: string;
    name: string | null;
    email: string;
    emailVerified: Date | null;
    image: string | null;
    createdAt: Date;
    role: 'admin' | 'user';
}

export function UserManagementPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading] = useState(false);

    // TODO: Replace with actual API call
    const mockUsers: User[] = [
        {
            id: 'user-1',
            name: 'John Doe',
            email: 'john@example.com',
            emailVerified: new Date('2024-01-15'),
            image: null,
            createdAt: new Date('2024-01-15'),
            role: 'admin',
        },
        {
            id: 'user-2',
            name: 'Jane Smith',
            email: 'jane@example.com',
            emailVerified: new Date('2024-02-20'),
            image: null,
            createdAt: new Date('2024-02-20'),
            role: 'user',
        },
        {
            id: 'user-3',
            name: null,
            email: 'bob@example.com',
            emailVerified: null,
            image: null,
            createdAt: new Date('2024-03-10'),
            role: 'user',
        },
    ];

    const users = mockUsers.filter(
        (user) =>
            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
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
        return user.email[0].toUpperCase();
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
                    <p className="text-muted-foreground mt-1">
                        View and manage all users across the system
                    </p>
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
                        <CardTitle className="text-2xl">{mockUsers.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Admins</CardDescription>
                        <CardTitle className="text-2xl">
                            {mockUsers.filter((u) => u.role === 'admin').length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Verified</CardDescription>
                        <CardTitle className="text-2xl">
                            {mockUsers.filter((u) => u.emailVerified).length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>This Month</CardDescription>
                        <CardTitle className="text-2xl">
                            {
                                mockUsers.filter(
                                    (u) =>
                                        new Date(u.createdAt).getMonth() === new Date().getMonth()
                                ).length
                            }
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
                                                    <AvatarFallback>
                                                        {getUserInitials(user)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-medium">
                                                        {user.name || 'No name'}
                                                    </div>
                                                    <code className="text-xs text-muted-foreground">
                                                        {user.id}
                                                    </code>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                {user.email}
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
                                                <Link to={`/admin/users/${user.id}`}>
                                                    View
                                                </Link>
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
