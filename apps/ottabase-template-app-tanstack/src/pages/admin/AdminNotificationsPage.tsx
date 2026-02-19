import { useApiMutation } from '@ottabase/ottaorm/client';
import { useState } from 'react';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
    Badge,
} from '@ottabase/ui-shadcn';
import { Bell, Mail, Radio, Send, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface NotificationForm {
    recipientId: string;
    recipientEmail: string;
    title: string;
    message: string;
    channel: 'email' | 'websocket' | 'system';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    category?: string;
    actionUrl?: string;
    actionText?: string;
}

export function AdminNotificationsPage() {
    const [form, setForm] = useState<NotificationForm>({
        recipientId: '',
        recipientEmail: '',
        title: '',
        message: '',
        channel: 'email',
        priority: 'normal',
    });

    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const sendNotification = useApiMutation<unknown, NotificationForm>({
        endpoint: '/api/admin/notifications/send',
        method: 'POST',
        mutationOptions: {
            onSuccess: () => {
                setResult({ success: true, message: 'Notification sent successfully!' });
                setForm({
                    recipientId: '',
                    recipientEmail: '',
                    title: '',
                    message: '',
                    channel: 'email',
                    priority: 'normal',
                });
            },
            onError: () => setResult({ success: false, message: 'Failed to send notification' }),
        },
    });

    const sendAlert = useApiMutation<unknown, { title: string; message: string; severity: string; eventType: string }>({
        endpoint: '/api/admin/notifications/system-alert',
        method: 'POST',
        mutationOptions: {
            onSuccess: () => setResult({ success: true, message: 'System alert sent to admins!' }),
            onError: () => setResult({ success: false, message: 'Failed to send system alert' }),
        },
    });

    const sending = sendNotification.isPending || sendAlert.isPending;

    const handleSend = () => {
        setResult(null);
        sendNotification.mutate(form);
    };

    const sendSystemAlert = (severity: 'info' | 'warning' | 'error' | 'critical') => {
        setResult(null);
        sendAlert.mutate({ title: form.title, message: form.message, severity, eventType: 'admin.manual' });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Bell className="h-8 w-8" />
                    Notifications Management
                </h1>
                <p className="text-muted-foreground mt-2">
                    Send notifications to users or broadcast system alerts to administrators.
                </p>
            </div>

            <Tabs defaultValue="send" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="send">Send Notification</TabsTrigger>
                    <TabsTrigger value="system">System Alerts</TabsTrigger>
                    <TabsTrigger value="history">Notification History</TabsTrigger>
                </TabsList>

                <TabsContent value="send" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Send Notification to User</CardTitle>
                            <CardDescription>
                                Choose a channel (email, websocket, or system) and compose your notification
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="recipientId">Recipient User ID</Label>
                                    <Input
                                        id="recipientId"
                                        placeholder="user-123"
                                        value={form.recipientId}
                                        onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="recipientEmail">Recipient Email</Label>
                                    <Input
                                        id="recipientEmail"
                                        type="email"
                                        placeholder="user@example.com"
                                        value={form.recipientEmail}
                                        onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="channel">Channel</Label>
                                    <Select
                                        value={form.channel}
                                        onValueChange={(value: any) => setForm({ ...form, channel: value })}
                                    >
                                        <SelectTrigger id="channel">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="email">
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-4 w-4" />
                                                    Email
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="websocket">
                                                <div className="flex items-center gap-2">
                                                    <Radio className="h-4 w-4" />
                                                    WebSocket
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="system">
                                                <div className="flex items-center gap-2">
                                                    <AlertCircle className="h-4 w-4" />
                                                    System
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="priority">Priority</Label>
                                    <Select
                                        value={form.priority}
                                        onValueChange={(value: any) => setForm({ ...form, priority: value })}
                                    >
                                        <SelectTrigger id="priority">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="urgent">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category (Optional)</Label>
                                    <Input
                                        id="category"
                                        placeholder="e.g. security, update"
                                        value={form.category || ''}
                                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    placeholder="Notification title"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message">Message</Label>
                                <Textarea
                                    id="message"
                                    placeholder="Notification message content"
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                                    rows={4}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="actionUrl">Action URL (Optional)</Label>
                                    <Input
                                        id="actionUrl"
                                        placeholder="https://example.com/action"
                                        value={form.actionUrl || ''}
                                        onChange={(e) => setForm({ ...form, actionUrl: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="actionText">Action Button Text</Label>
                                    <Input
                                        id="actionText"
                                        placeholder="View Details"
                                        value={form.actionText || ''}
                                        onChange={(e) => setForm({ ...form, actionText: e.target.value })}
                                    />
                                </div>
                            </div>

                            {result && (
                                <div
                                    className={`p-4 rounded-lg flex items-center gap-2 ${
                                        result.success ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
                                    }`}
                                >
                                    {result.success ? (
                                        <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5" />
                                    )}
                                    {result.message}
                                </div>
                            )}

                            <Button
                                onClick={handleSend}
                                disabled={sending || !form.title || !form.message}
                                className="w-full"
                            >
                                <Send className="mr-2 h-4 w-4" />
                                {sending ? 'Sending...' : 'Send Notification'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="system" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Broadcast System Alert</CardTitle>
                            <CardDescription>
                                Send alerts to all administrators about system events or issues
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="system-title">Alert Title</Label>
                                <Input
                                    id="system-title"
                                    placeholder="System alert title"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="system-message">Alert Message</Label>
                                <Textarea
                                    id="system-message"
                                    placeholder="Describe the system event or issue"
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                                    rows={4}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    variant="outline"
                                    onClick={() => sendSystemAlert('info')}
                                    disabled={sending || !form.title || !form.message}
                                >
                                    <Badge className="mr-2 bg-blue-500">Info</Badge>
                                    Send Info Alert
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => sendSystemAlert('warning')}
                                    disabled={sending || !form.title || !form.message}
                                >
                                    <Badge className="mr-2 bg-yellow-500">Warning</Badge>
                                    Send Warning
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => sendSystemAlert('error')}
                                    disabled={sending || !form.title || !form.message}
                                >
                                    <Badge className="mr-2 bg-orange-500">Error</Badge>
                                    Send Error Alert
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => sendSystemAlert('critical')}
                                    disabled={sending || !form.title || !form.message}
                                >
                                    <Badge className="mr-2 bg-red-500">Critical</Badge>
                                    Send Critical Alert
                                </Button>
                            </div>

                            {result && (
                                <div
                                    className={`p-4 rounded-lg flex items-center gap-2 ${
                                        result.success ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
                                    }`}
                                >
                                    {result.success ? (
                                        <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5" />
                                    )}
                                    {result.message}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notification History</CardTitle>
                            <CardDescription>View recently sent notifications and their status</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="rounded-lg border p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium">Sample Notification</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Sent to user@example.com via email
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">
                                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                                Sent
                                            </Badge>
                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">2 hours ago</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center text-sm text-muted-foreground">
                                    Connect to your notification database to view real history
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Card>
                <CardHeader>
                    <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold">0</div>
                            <div className="text-sm text-muted-foreground">Sent Today</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">0</div>
                            <div className="text-sm text-muted-foreground">Pending</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">0</div>
                            <div className="text-sm text-muted-foreground">Failed</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold">0</div>
                            <div className="text-sm text-muted-foreground">Read Rate</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
