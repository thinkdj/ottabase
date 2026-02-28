import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { AlertCircle, Archive, Bell, CheckCircle2, Clock, Inbox, Mail, Radio } from 'lucide-react';
import { useState } from 'react';

interface DemoNotification {
    id: string;
    title: string;
    message: string;
    channel: 'email' | 'websocket' | 'system';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    status: 'pending' | 'sent' | 'read';
    timestamp: string;
    actionUrl?: string;
    actionText?: string;
}

export function DemoNotificationsPage() {
    const [notifications, setNotifications] = useState<DemoNotification[]>([
        {
            id: '1',
            title: 'Welcome to Ottabase!',
            message: 'Thanks for trying out our notification system. This is a demo email notification.',
            channel: 'email',
            priority: 'normal',
            status: 'sent',
            timestamp: '2 hours ago',
            actionUrl: '/demo',
            actionText: 'Explore Demos',
        },
        {
            id: '2',
            title: 'Real-time Update',
            message: 'This notification was delivered via WebSocket for instant updates.',
            channel: 'websocket',
            priority: 'high',
            status: 'read',
            timestamp: '1 hour ago',
        },
        {
            id: '3',
            title: 'System Alert',
            message: 'A critical system notification for administrators.',
            channel: 'system',
            priority: 'urgent',
            status: 'sent',
            timestamp: '30 minutes ago',
        },
    ]);

    const [stats] = useState({
        total: 127,
        unread: 5,
        sent: 120,
        failed: 2,
    });

    const sendTestNotification = async (channel: 'email' | 'websocket' | 'system') => {
        const newNotification: DemoNotification = {
            id: Date.now().toString(),
            title: `Test ${channel} Notification`,
            message: `This is a test notification sent via ${channel}`,
            channel,
            priority: 'normal',
            status: 'sent',
            timestamp: 'just now',
        };

        setNotifications([newNotification, ...notifications]);
    };

    const markAsRead = (id: string) => {
        setNotifications(notifications.map((n) => (n.id === id ? { ...n, status: 'read' as const } : n)));
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return 'bg-red-500';
            case 'high':
                return 'bg-orange-500';
            case 'normal':
                return 'bg-blue-500';
            case 'low':
                return 'bg-gray-500';
            default:
                return 'bg-blue-500';
        }
    };

    const getChannelIcon = (channel: string) => {
        switch (channel) {
            case 'email':
                return <Mail className="h-4 w-4" />;
            case 'websocket':
                return <Radio className="h-4 w-4" />;
            case 'system':
                return <AlertCircle className="h-4 w-4" />;
            default:
                return <Bell className="h-4 w-4" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Button asChild variant="ghost" className="mb-4">
                        <Link to="/demo">← Back to Demos</Link>
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Bell className="h-8 w-8" />
                        Notifications Demo
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Multi-channel notification system with email, WebSocket, and system alerts
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                            <Bell className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Unread</p>
                                <p className="text-2xl font-bold">{stats.unread}</p>
                            </div>
                            <Inbox className="h-8 w-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Delivered</p>
                                <p className="text-2xl font-bold">{stats.sent}</p>
                            </div>
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Failed</p>
                                <p className="text-2xl font-bold">{stats.failed}</p>
                            </div>
                            <AlertCircle className="h-8 w-8 text-red-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Features */}
                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Features</CardTitle>
                            <CardDescription>Test different notification channels</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h4 className="font-medium mb-2">Multi-Channel Support</h4>
                                <div className="space-y-2">
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => sendTestNotification('email')}
                                    >
                                        <Mail className="mr-2 h-4 w-4" />
                                        Send Email Notification
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => sendTestNotification('websocket')}
                                    >
                                        <Radio className="mr-2 h-4 w-4" />
                                        Send WebSocket Notification
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => sendTestNotification('system')}
                                    >
                                        <AlertCircle className="mr-2 h-4 w-4" />
                                        Send System Alert
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-medium mb-2">Priority Levels</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-red-500">Urgent</Badge>
                                        <span className="text-sm">Critical notifications</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-orange-500">High</Badge>
                                        <span className="text-sm">Important updates</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-blue-500">Normal</Badge>
                                        <span className="text-sm">Standard messages</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-gray-500">Low</Badge>
                                        <span className="text-sm">Informational</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-medium mb-2">Capabilities</h4>
                                <ul className="text-sm space-y-1 text-muted-foreground">
                                    <li>✓ Email delivery via multiple providers</li>
                                    <li>✓ Real-time WebSocket notifications</li>
                                    <li>✓ System alerts for admins</li>
                                    <li>✓ Async queue processing</li>
                                    <li>✓ User preferences</li>
                                    <li>✓ Status tracking</li>
                                    <li>✓ Action buttons & URLs</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Integration</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <p className="font-medium">Packages Used:</p>
                                <ul className="text-muted-foreground space-y-1">
                                    <li>• @ottabase/notifications</li>
                                    <li>• @ottabase/email</li>
                                    <li>• @ottabase/cf-realtime</li>
                                    <li>• @ottabase/queue</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Notification Feed */}
                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notification Feed</CardTitle>
                            <CardDescription>Recent notifications across all channels</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="all">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="all">
                                        All <Badge className="ml-2">{notifications.length}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="email">
                                        Email{' '}
                                        <Badge className="ml-2">
                                            {notifications.filter((n) => n.channel === 'email').length}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="websocket">
                                        WebSocket{' '}
                                        <Badge className="ml-2">
                                            {notifications.filter((n) => n.channel === 'websocket').length}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="system">
                                        System{' '}
                                        <Badge className="ml-2">
                                            {notifications.filter((n) => n.channel === 'system').length}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="all" className="space-y-4 mt-4">
                                    {notifications.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <Archive className="h-12 w-12 mx-auto mb-4" />
                                            <p>No notifications yet. Try sending a test notification!</p>
                                        </div>
                                    ) : (
                                        notifications.map((notification) => (
                                            <div
                                                key={notification.id}
                                                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            {getChannelIcon(notification.channel)}
                                                            <h4 className="font-medium">{notification.title}</h4>
                                                            <Badge className={getPriorityColor(notification.priority)}>
                                                                {notification.priority}
                                                            </Badge>
                                                            {notification.status === 'read' ? (
                                                                <Badge variant="outline">Read</Badge>
                                                            ) : (
                                                                <Badge variant="default">New</Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground mb-2">
                                                            {notification.message}
                                                        </p>
                                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {notification.timestamp}
                                                            </span>
                                                            <span>via {notification.channel}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {notification.status !== 'read' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => markAsRead(notification.id)}
                                                            >
                                                                Mark as Read
                                                            </Button>
                                                        )}
                                                        {notification.actionUrl && (
                                                            <Button size="sm">
                                                                {notification.actionText || 'View'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </TabsContent>

                                <TabsContent value="email" className="space-y-4 mt-4">
                                    {notifications
                                        .filter((n) => n.channel === 'email')
                                        .map((notification) => (
                                            <div key={notification.id} className="border rounded-lg p-4">
                                                <h4 className="font-medium mb-2">{notification.title}</h4>
                                                <p className="text-sm text-muted-foreground">{notification.message}</p>
                                            </div>
                                        ))}
                                </TabsContent>

                                <TabsContent value="websocket" className="space-y-4 mt-4">
                                    {notifications
                                        .filter((n) => n.channel === 'websocket')
                                        .map((notification) => (
                                            <div key={notification.id} className="border rounded-lg p-4">
                                                <h4 className="font-medium mb-2">{notification.title}</h4>
                                                <p className="text-sm text-muted-foreground">{notification.message}</p>
                                            </div>
                                        ))}
                                </TabsContent>

                                <TabsContent value="system" className="space-y-4 mt-4">
                                    {notifications
                                        .filter((n) => n.channel === 'system')
                                        .map((notification) => (
                                            <div
                                                key={notification.id}
                                                className="border rounded-lg p-4 border-red-200 bg-red-50/50"
                                            >
                                                <h4 className="font-medium mb-2">{notification.title}</h4>
                                                <p className="text-sm text-muted-foreground">{notification.message}</p>
                                            </div>
                                        ))}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Code Example */}
            <Card>
                <CardHeader>
                    <CardTitle>Usage Example</CardTitle>
                    <CardDescription>How to use @ottabase/notifications in your application</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{`import { NotificationManager, createEmailChannel } from '@ottabase/notifications';

// Setup notification manager
const manager = new NotificationManager({
  defaultChannels: ['email', 'websocket'],
  email: { from: 'noreply@example.com' }
});

// Register channels
manager.registerChannel(emailChannel);
manager.registerChannel(wsChannel);

// Send notification
await manager.notify({
  recipient: {
    userId: '123',
    email: 'user@example.com'
  },
  payload: {
    title: 'Welcome!',
    message: 'Thanks for signing up',
    actionUrl: '/dashboard',
    actionText: 'Go to Dashboard'
  },
  options: {
    priority: 'high'
  }
});`}</code>
                    </pre>
                </CardContent>
            </Card>
        </div>
    );
}
