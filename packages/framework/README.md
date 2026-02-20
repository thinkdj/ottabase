# @ottabase/framework

Lightweight routing helpers for Cloudflare Worker apps.

## Router

```ts
import { Router } from '@ottabase/framework';

const router = new Router();

router.group({ prefix: '/api', middleware: [] }, (group) => {
    group.get('/health', () => new Response('ok'));
});
```
