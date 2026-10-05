import { useNotificationPreferences, useSaveNotificationPreferences } from '@/hooks/useNotifications';
import { LoadingState } from '@ottabase/ui-components';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Switch, toast } from '@ottabase/ui-shadcn';

/** Which kinds of notification reach my inbox */
export function NotificationSettings() {
    const prefs = useNotificationPreferences();
    const save = useSaveNotificationPreferences();
    const entries = Object.entries(prefs.data?.categories ?? {});

    const toggle = async (key: string, enabled: boolean) => {
        try {
            await save.mutateAsync({ categories: { [key]: enabled } });
        } catch {
            toast.error('Could not save that. Try again.');
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-[0.9375rem] font-semibold">Notifications</CardTitle>
                <CardDescription>What lands in your inbox. The bell at the top shows what is new.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {prefs.isLoading ? (
                    <LoadingState count={2} height="h-6" />
                ) : (
                    entries.map(([key, { label, enabled }]) => (
                        <div key={key} className="flex items-center justify-between gap-4">
                            <Label htmlFor={`notify-${key}`} className="font-normal">
                                {label}
                            </Label>
                            <Switch
                                id={`notify-${key}`}
                                checked={enabled}
                                disabled={save.isPending}
                                onCheckedChange={(on) => void toggle(key, on)}
                            />
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
