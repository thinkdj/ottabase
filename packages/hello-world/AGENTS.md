# @ottabase/hello-world — agent notes

Demo React greeting component; template reference for new packages. Full docs: ./README.md

## Use when

- Scaffolding a new package (copy its package.json / tsup / vitest setup) or smoke-testing the build pipeline.
- NOT for production features — it only renders a styled 'Hello, {name}!' box.

## Imports

    import { HelloBox, type HelloBoxProps } from '@ottabase/hello-world';
    import HelloBox from '@ottabase/hello-world'; // default export, same component

## Canonical usage

    <HelloBox name='Ottabase' className='my-box' style={{ backgroundColor: '#fff' }} />

## Gotchas

- react/react-dom are peerDependencies (catalog:), not bundled.
- Entry points resolve to dist/ — run `pnpm build` (tsup) before consuming.
- Default styles are inline; override via the style prop, not CSS alone.
