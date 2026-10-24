import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { FileText, Folder, FolderOpen, Lock, Palette, Users } from 'lucide-react';
import { useState } from 'react';
import { CountBadge } from '../components/ui/status';
import { TreeView, type TreeNode } from '../components/ui/tree-view';

const ADMIN: TreeNode[] = [
    {
        id: 'content',
        label: 'Content',
        icon: <Folder />,
        children: [
            {
                id: 'blog',
                label: 'Blog',
                icon: <Folder />,
                children: [
                    { id: 'posts', label: 'Posts', icon: <FileText /> },
                    { id: 'series', label: 'Series', icon: <FileText /> },
                    { id: 'translations', label: 'Translations', icon: <FileText /> },
                ],
            },
            {
                id: 'landing',
                label: 'Landing',
                icon: <Folder />,
                children: [
                    { id: 'pages', label: 'Pages', icon: <FileText /> },
                    { id: 'leads', label: 'Leads', icon: <FileText /> },
                ],
            },
        ],
    },
    {
        id: 'access',
        label: 'Access',
        icon: <Users />,
        children: [
            { id: 'users', label: 'Users', icon: <FileText /> },
            { id: 'organizations', label: 'Organizations', icon: <FileText /> },
            { id: 'roles', label: 'Roles and permissions', icon: <FileText /> },
        ],
    },
    {
        id: 'appearance',
        label: 'Appearance',
        icon: <Palette />,
        children: [
            { id: 'brand', label: 'Brand kits', icon: <FileText /> },
            { id: 'menus', label: 'Menus', icon: <FileText /> },
        ],
    },
    { id: 'billing', label: 'Billing (Pro)', icon: <Lock />, disabled: true },
];

const meta: Meta<typeof TreeView> = {
    title: 'TreeView',
    component: TreeView,
    parameters: { layout: 'centered' },
    decorators: [
        (Story) => (
            <div className="w-72 rounded-lg border bg-card p-2 shadow-xs">
                <Story />
            </div>
        ),
    ],
    tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof TreeView>;

/** Click to select, the chevron (or a double click) to open; try the arrows, Home/End and typing a letter. */
export const Navigation: Story = {
    render: () => (
        <TreeView
            aria-label="Admin"
            items={ADMIN}
            defaultExpanded={['content', 'blog', 'access']}
            defaultSelected="posts"
        />
    ),
};

/** Folders that open and close their icon with the branch, and a count beside each label. */
export const CustomItems: Story = {
    render: function Render() {
        const [expanded, setExpanded] = useState<string[]>(['content', 'landing']);
        const counts: Record<string, number> = { posts: 25, series: 3, pages: 8, leads: 112 };
        const withFolders = (nodes: TreeNode[]): TreeNode[] =>
            nodes.map((node) =>
                node.children
                    ? {
                          ...node,
                          icon: expanded.includes(node.id) ? <FolderOpen /> : <Folder />,
                          children: withFolders(node.children),
                      }
                    : node,
            );
        return (
            <TreeView
                aria-label="Content"
                items={withFolders(ADMIN.slice(0, 1))}
                expanded={expanded}
                onExpandedChange={setExpanded}
                renderItem={(node) => (
                    <span className="flex items-center justify-between gap-2">
                        <span className="truncate">{node.label}</span>
                        {counts[node.id] ? <CountBadge>{counts[node.id]}</CountBadge> : null}
                    </span>
                )}
            />
        );
    },
};

/** For reading: no selection, just open and close. */
export const ReadOnly: Story = {
    render: () => <TreeView aria-label="Structure" items={ADMIN} selectable={false} defaultExpanded={['appearance']} />,
};
