import { expenseMemberHooks } from '@/hooks/expenseHooks';
import type { ExpenseGroupMemberRecord } from '@/types/expenses';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface ExpenseMembersManagerProps {
    groupId: string;
    members: ExpenseGroupMemberRecord[];
}

export function ExpenseMembersManager({ groupId, members }: ExpenseMembersManagerProps) {
    const [name, setName] = useState('');
    const createMember = expenseMemberHooks.useCreate();

    const handleAddMember = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) return;
        if (members.some((member) => member.name.toLowerCase() === trimmedName.toLowerCase())) {
            toast.info('Member already exists');
            return;
        }

        await createMember.mutateAsync({ groupId, name: trimmedName } as Partial<ExpenseGroupMemberRecord>);
        setName('');
        toast.success('Member added');
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Members
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <form onSubmit={handleAddMember} className="flex gap-2">
                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Add Chris" />
                    <Button type="submit" size="icon" disabled={!name.trim() || createMember.isPending}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </form>
                <div className="flex flex-wrap gap-2">
                    {members.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Add people here, or mention new names in the natural language input.
                        </p>
                    ) : (
                        members.map((member) => (
                            <Badge key={member.id} variant="secondary">
                                {member.name}
                            </Badge>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
