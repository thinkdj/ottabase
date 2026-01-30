### code

```
packages/hello-world/
  src/
    HelloBox.tsx
    index.ts
  package.json
  tsconfig.json
```

### build

```
pnpm install
pnpm build --filter @ottabase/hello-world
```

This generates dist/ with compiled component + types.

### publish

```
npm login --scope=@ottabase


cd packages/hello-world
npm publish --access public
```

### use

```
import { HelloBox } from "@ottabase/hello-world";

export default function Page() {
  return <HelloBox name="thinkdj" />;
}

```
