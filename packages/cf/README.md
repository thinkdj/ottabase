# @ottabase/cf

Type-safe Cloudflare bindings wrappers.

## KV Storage

```typescript
import { createKVClient } from "@ottabase/cf/kv";

const kv = createKVClient({ namespace: env.OBCF_KV });

// Text
await kv.put("key", "value", { expirationTtl: 3600 });
const { data } = await kv.getText("key");

// JSON
await kv.putJSON("user:123", { name: "John" });
const { data: user } = await kv.getJSON<User>("user:123");

// List
const { data: list } = await kv.list({ prefix: "user:" });

// Delete
await kv.delete("key");
```

## R2 Storage

```typescript
import { createR2Client } from "@ottabase/cf/r2";

const r2 = createR2Client({ bucket: env.OBCF_R2 });

// Upload
await r2.put("files/doc.pdf", fileBuffer, {
  httpMetadata: { contentType: "application/pdf" }
});

// Download
const { data: object } = await r2.get("files/doc.pdf");
const content = await object?.arrayBuffer();

// List
const { data } = await r2.list({ prefix: "files/" });

// Delete
await r2.delete("files/doc.pdf");
```

## Cloudflare Images

```typescript
import { createImagesClient } from "@ottabase/cf/images";

const images = createImagesClient({
  accountId: env.CF_ACCOUNT_ID,
  apiToken: env.CF_API_TOKEN
});

// Upload
const { data } = await images.upload(file, { metadata: { alt: "Photo" } });

// Get delivery URL
const url = images.getDeliveryUrl(data.id, "public");
```

## Rate Limiting

```typescript
import { createRateLimitingClient } from "@ottabase/cf/rate-limiting";

const limiter = createRateLimitingClient({ rateLimiter: env.OBCF_RATE_LIMITER });

const { data } = await limiter.limit({ key: `user:${userId}` });
if (!data.success) {
  return new Response("Too many requests", { status: 429 });
}
```

## Queues

```typescript
import { createQueuesClient, processQueueBatch } from "@ottabase/cf/queues";

const queues = createQueuesClient({ queue: env.OBCF_QUEUE });

// Send message
await queues.send({ type: "email", to: "user@example.com" });

// Send batch
await queues.sendBatch([
  { body: { type: "task1" } },
  { body: { type: "task2" } }
]);
```

## D1 (Raw)

```typescript
import { createD1Client } from "@ottabase/cf/d1";

const db = createD1Client({ database: env.OBCF_D1 });

const { data } = await db.query<User>("SELECT * FROM users WHERE id = ?", [id]);
await db.execute("INSERT INTO users (name) VALUES (?)", ["John"]);
```

## Hyperdrive

```typescript
import { createHyperdriveClient } from "@ottabase/cf/hyperdrive";

const hyperdrive = createHyperdriveClient({ binding: env.HYPERDRIVE });
const connectionString = hyperdrive.getConnectionString();
```

## Secrets

```typescript
import { createSecretsClient } from "@ottabase/cf/secrets";

const secrets = createSecretsClient({ env });
const apiKey = secrets.get("API_KEY");
const all = secrets.getAll(["API_KEY", "SECRET"]);
```

## Exports

```typescript
import { createKVClient } from "@ottabase/cf/kv";
import { createR2Client } from "@ottabase/cf/r2";
import { createD1Client } from "@ottabase/cf/d1";
import { createImagesClient } from "@ottabase/cf/images";
import { createQueuesClient } from "@ottabase/cf/queues";
import { createRateLimitingClient } from "@ottabase/cf/rate-limiting";
import { createHyperdriveClient } from "@ottabase/cf/hyperdrive";
import { createSecretsClient } from "@ottabase/cf/secrets";
```
