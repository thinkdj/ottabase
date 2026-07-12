# @ottabase/cf-ai — agent notes

Cloudflare AI Gateway + Workers AI wrapper: multi-provider chat with fallback, streaming, caching. Full docs: ./README.md

## Use when

- Any LLM/embedding/image/STT inference from a Worker: chat with provider fallback (universal), direct `env.AI` binding calls (workers-ai), or proxying OpenAI/Anthropic/Google/etc. through AI Gateway.
- NOT for: provider SDKs outside Cloudflare, or realtime/voice (see @ottabase/cf-realtime).

## Imports

```ts
import { createUniversalAIClient, type ChatOptions, type ChatResult } from '@ottabase/cf-ai/universal';
import { createWorkersAIClient, type WorkersAIConfig } from '@ottabase/cf-ai/workers-ai';
import { createAIGatewayClient, AIGatewayClient } from '@ottabase/cf-ai/gateway';
import { AI_PROVIDERS, buildProviderUrl, buildAuthHeaders, isValidProvider, type AIProviderKey } from '@ottabase/cf-ai/providers';
import { AIError, type Result, type ChatMessage, type FallbackStep, type UniversalAIConfig } from '@ottabase/cf-ai';
```

## Canonical usage

```ts
const ai = createUniversalAIClient({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    gateway: 'production',
    fallbacks: [
        { provider: 'openai', model: 'gpt-4o-mini', apiKey: env.CFAI_OPENAI_API_KEY },
        { provider: 'anthropic', model: 'claude-sonnet-4-20250514', apiKey: env.CFAI_ANTHROPIC_API_KEY },
    ],
});
const result = await ai.chatWithFallback('Hello!'); // also: ai.chat(input, opts), ai.chatStream(input, opts)
if (result.success) console.log(result.data.text, result.data.provider);
```

```ts
const wai = createWorkersAIClient({ binding: env.AI });
const r = await wai.textGeneration({ model: '@cf/meta/llama-3.1-8b-instruct', messages: [{ role: 'user', content: 'Hi' }] });
// also: textGenerationStream, embeddings, imageGeneration, translation, summarization, speechToText, run<T>()
```

## Gotchas

- Everything returns `Result<T>` — check `result.success`; but all three client constructors throw `AIError` on bad config: `WorkersAIClient` (missing binding), `AIGatewayClient` (missing accountId/gateway), `UniversalAIClient` (builds a gateway client, so same).
- Universal/Gateway need `CLOUDFLARE_ACCOUNT_ID` + an existing AI Gateway name; provider keys use `CFAI_*` env names.
- `cacheTtl`/`skipCache` only apply via AI Gateway, not the direct `env.AI` binding.
- workers-ai entry requires `@cloudflare/workers-types` in the type path (global `Ai`).
- Providers: 'workers-ai' | 'openai' | 'anthropic' | 'google-ai-studio' | 'azure' | 'mistral' | 'groq' | 'cohere' | ... (see AI_PROVIDERS).
- `chatWithFallback` ignores per-call provider/model/apiKey — those come from `config.fallbacks` steps.
