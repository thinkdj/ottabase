// TreeView: the WAI-ARIA tree pattern, rendered flat, with one tab stop and full keyboard support.
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TreeView, type TreeNode } from '../../components/ui/tree-view';

const ITEMS: TreeNode[] = [
    {
        id: 'content',
        label: 'Content',
        children: [
            { id: 'posts', label: 'Posts' },
            { id: 'pages', label: 'Pages', children: [{ id: 'home', label: 'Home' }] },
        ],
    },
    { id: 'billing', label: 'Billing', disabled: true },
    { id: 'settings', label: 'Settings' },
];

const item = (name: string) => screen.getByRole('treeitem', { name });
const key = (name: string, k: string) => fireEvent.keyDown(item(name), { key: k });

describe('<TreeView>', () => {
    it('renders the visible items flat with their level, position and state', () => {
        render(<TreeView aria-label="Admin" items={ITEMS} defaultExpanded={['content']} />);

        expect(screen.getByRole('tree', { name: 'Admin' })).toBeInTheDocument();
        expect(screen.getAllByRole('treeitem').map((el) => el.textContent)).toEqual([
            'Content',
            'Posts',
            'Pages',
            'Billing',
            'Settings',
        ]);
        expect(item('Content')).toHaveAttribute('aria-expanded', 'true');
        expect(item('Pages')).toHaveAttribute('aria-expanded', 'false');
        expect(item('Posts')).not.toHaveAttribute('aria-expanded');
        expect(item('Pages')).toHaveAttribute('aria-level', '2');
        expect(item('Pages')).toHaveAttribute('aria-posinset', '2');
        expect(item('Pages')).toHaveAttribute('aria-setsize', '2');
        expect(item('Billing')).toHaveAttribute('aria-disabled', 'true');
        // Hidden children are not rendered at all
        expect(screen.queryByRole('treeitem', { name: 'Home' })).toBeNull();
    });

    it('keeps exactly one tab stop, on the selected item when there is one', () => {
        render(<TreeView items={ITEMS} defaultExpanded={['content']} defaultSelected="posts" />);
        const stops = screen.getAllByRole('treeitem').filter((el) => el.tabIndex === 0);
        expect(stops).toEqual([item('Posts')]);
    });

    it('moves, opens and closes with the arrow keys', () => {
        render(<TreeView items={ITEMS} />);
        item('Content').focus();

        key('Content', 'ArrowRight'); // opens
        expect(item('Content')).toHaveAttribute('aria-expanded', 'true');
        key('Content', 'ArrowRight'); // steps into the first child
        expect(item('Posts')).toHaveFocus();
        key('Posts', 'ArrowDown');
        expect(item('Pages')).toHaveFocus();
        key('Pages', 'ArrowLeft'); // a closed branch steps out to its parent
        expect(item('Content')).toHaveFocus();
        key('Content', 'ArrowLeft'); // an open one closes
        expect(item('Content')).toHaveAttribute('aria-expanded', 'false');
        key('Content', 'End');
        expect(item('Settings')).toHaveFocus();
        key('Settings', 'Home');
        expect(item('Content')).toHaveFocus();
        expect(item('Content').tabIndex).toBe(0);
    });

    it('selects with Enter, Space and a click, and never selects a disabled item', () => {
        const onSelectedChange = vi.fn();
        render(<TreeView items={ITEMS} defaultExpanded={['content']} onSelectedChange={onSelectedChange} />);

        key('Posts', ' ');
        expect(item('Posts')).toHaveAttribute('aria-selected', 'true');
        expect(onSelectedChange).toHaveBeenLastCalledWith('posts', ITEMS[0].children![0]);

        // Enter on a branch selects it and opens it
        key('Pages', 'Enter');
        expect(item('Pages')).toHaveAttribute('aria-selected', 'true');
        expect(item('Pages')).toHaveAttribute('aria-expanded', 'true');

        fireEvent.click(item('Settings'));
        expect(item('Settings')).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(item('Billing'));
        key('Billing', 'Enter');
        expect(item('Billing')).toHaveAttribute('aria-selected', 'false');
        expect(onSelectedChange).toHaveBeenCalledTimes(3);
    });

    it('opens from the chevron without selecting, and on a double click', () => {
        const { container } = render(<TreeView items={ITEMS} />);
        fireEvent.click(container.querySelector('[data-slot="tree-toggle"]')!);
        expect(item('Content')).toHaveAttribute('aria-expanded', 'true');
        expect(item('Content')).toHaveAttribute('aria-selected', 'false');

        fireEvent.doubleClick(item('Pages'));
        expect(item('Pages')).toHaveAttribute('aria-expanded', 'true');
        expect(item('Home')).toHaveAttribute('aria-level', '3');
    });

    it('jumps by typed letters, cycling through matches', () => {
        render(<TreeView items={ITEMS} defaultExpanded={['content']} />);
        item('Content').focus();

        key('Content', 'p');
        expect(item('Posts')).toHaveFocus();
        key('Posts', 'p'); // the same letter again cycles to the next match
        expect(item('Pages')).toHaveFocus();
        key('Pages', 's'); // a new letter refines: "pps" matches nothing, so focus stays
        expect(item('Pages')).toHaveFocus();
    });

    it('refines the match as more letters are typed', () => {
        render(<TreeView items={ITEMS} defaultExpanded={['content']} />);
        item('Content').focus();
        key('Content', 's');
        expect(item('Settings')).toHaveFocus();
        key('Settings', 'e');
        expect(item('Settings')).toHaveFocus();
    });

    it('follows controlled state and reports changes', () => {
        function Controlled() {
            const [expanded, setExpanded] = React.useState<string[]>([]);
            return (
                <>
                    <output>{expanded.join(',')}</output>
                    <TreeView items={ITEMS} expanded={expanded} onExpandedChange={setExpanded} />
                </>
            );
        }
        render(<Controlled />);
        key('Content', 'ArrowRight');
        expect(screen.getByRole('status')).toHaveTextContent('content');
        expect(item('Posts')).toBeInTheDocument();
    });

    it('renders a custom label and hides selection when not selectable', () => {
        render(
            <TreeView
                items={ITEMS}
                selectable={false}
                renderItem={(node, state) => `${node.label as string} · L${state.level}`}
            />,
        );
        expect(screen.getByText('Content · L1')).toBeInTheDocument();
        expect(screen.getAllByRole('treeitem')[0]).not.toHaveAttribute('aria-selected');
    });
});
