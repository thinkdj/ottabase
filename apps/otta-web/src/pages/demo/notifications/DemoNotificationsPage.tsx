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
import { AlertCircle, Archive, Bell, CheckCircle2, Clock, Inbox, Mail, Radio } from 'lucide-react';
import { useState } from 'react';
import { DemoPageHeader } from '../DemoPageHeader';

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

    // Priority chips: colored fills only for genuine destructive/warning semantics;
    // routine levels stay quiet as neutral ringed chips.
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return 'border-transparent bg-destructive text-destructive-foreground';
            case 'high':
                return 'border-transparent bg-warning text-warning-foreground';
            case 'normal':
            case 'low':
            default:
                return 'border-transparent bg-background text-muted-foreground ring-1 ring-border';
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
        <div className="space-y-8">
            <DemoPageHeader
                title="Notifications"
                description="Multi-channel notification system with email, WebSocket, and system alerts"
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                    Total Sent
                                </p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                            <Bell className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                    Unread
                                </p>
                                <p className="text-2xl font-bold">{stats.unread}</p>
                            </div>
                            <Inbox className="h-8 w-8 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                    Delivered
                                </p>
                                <p className="text-2xl font-bold">{stats.sent}</p>
                            </div>
                            <CheckCircle2 className="h-8 w-8 text-success" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                    Failed
                                </p>
                                <p className="text-2xl font-bold">{stats.failed}</p>
                            </div>
                            <AlertCircle className="h-8 w-8 text-destructive" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Features */}
                <div className="md:col-span-1 space-y-6">
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Features</CardTitle>
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
                                        <Badge className={getPriorityColor('urgent')}>Urgent</Badge>
                                        <span className="text-sm">Critical notifications</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={getPriorityColor('high')}>High</Badge>
                                        <span className="text-sm">Important updates</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={getPriorityColor('normal')}>Normal</Badge>
                                        <span className="text-sm">Standard messages</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={getPriorityColor('low')}>Low</Badge>
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

                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Integration</CardTitle>
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
                    <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                        <CardHeader>
                            <CardTitle className="text-[0.9375rem] font-semibold">Notification Feed</CardTitle>
                            <CardDescription>Recent notifications across all channels</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="all">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="all">
                                        All{' '}
                                        <Badge
                                            variant="outline"
                                            className="ml-2 rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border"
                                        >
                                            {notifications.length}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="email">
                                        Email{' '}
                                        <Badge
                                            variant="outline"
                                            className="ml-2 rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border"
                                        >
                                            {notifications.filter((n) => n.channel === 'email').length}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="websocket">
                                        WebSocket{' '}
                                        <Badge
                                            variant="outline"
                                            className="ml-2 rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border"
                                        >
                                            {notifications.filter((n) => n.channel === 'websocket').length}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="system">
                                        System{' '}
                                        <Badge
                                            variant="outline"
                                            className="ml-2 rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border"
                                        >
                                            {notifications.filter((n) => n.channel === 'system').length}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="all" className="space-y-4 mt-4">
                                    {notifications.length === 0 ? (
                                        <div className="rounded-xl bg-muted/40 py-12 text-center text-muted-foreground">
                                            <Archive className="h-12 w-12 mx-auto mb-4" />
                                            <p>No notifications yet. Try sending a test notification!</p>
                                        </div>
                                    ) : (
                                        notifications.map((notification) => (
                                            <div
                                                key={notification.id}
                                                className="rounded-lg bg-background p-4 ring-1 ring-border transition-colors duration-normal hover:bg-muted/40"
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
                                            <div
                                                key={notification.id}
                                                className="rounded-lg bg-background p-4 ring-1 ring-border"
                                            >
                                                <h4 className="font-medium mb-2">{notification.title}</h4>
                                                <p className="text-sm text-muted-foreground">{notification.message}</p>
                                            </div>
                                        ))}
                                </TabsContent>

                                <TabsContent value="websocket" className="space-y-4 mt-4">
                                    {notifications
                                        .filter((n) => n.channel === 'websocket')
                                        .map((notification) => (
                                            <div
                                                key={notification.id}
                                                className="rounded-lg bg-background p-4 ring-1 ring-border"
                                            >
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
                                                className="rounded-lg border border-destructive/40 bg-destructive/10 p-4"
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
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="text-[0.9375rem] font-semibold">Usage Example</CardTitle>
                    <CardDescription>How to use @ottabase/notifications in your application</CardDescription>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-x-auto rounded-lg bg-background p-4 text-sm ring-1 ring-border">
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
