# @ottabase/ui-split-pane — agent notes

Minimal resizable React split-pane (vertical/horizontal, snap points, nesting). Full docs: ./README.md

## Use when
- Two-pane drag-to-resize layouts in Ottabase React apps (sidebars, editor/preview splits); nest `SplitPane` for 3+ panes. NOT for non-React contexts.

## Imports
    import { SplitPane, type SplitPaneProps, type SplitType } from '@ottabase/ui-split-pane';

## Canonical usage
    <SplitPane split='vertical' defaultSize='30%' minWidth={200} maxWidth={600} snapPoints={[250, 400]} onChange={(size) => {}}>
        <Sidebar />
        <Main />
    </SplitPane>

## Gotchas
- Exactly two children required; otherwise it warns and renders null. `defaultSize` takes px or `%`.
- `minSize`/`maxSize` are deprecated — use `minWidth`/`maxWidth` (vertical) or `minHeight`/`maxHeight` (horizontal).
- Internal `useSplitPane` hook is not exported; `react`/`react-dom` are peer deps (`catalog:`).
