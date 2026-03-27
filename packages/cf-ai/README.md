# @ottabase/cf-ai

Cloudflare AI Gateway & Workers AI wrapper — multi-provider AI with fallback, streaming, and caching.

## Overview

This package provides three clients for AI inference on Cloudflare:

| Client              | Import                       | Use Case                                                         |
| ------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `WorkersAIClient`   | `@ottabase/cf-ai/workers-ai` | Direct Workers AI binding — lowest latency, CF models only       |
| `AIGatewayClient`   | `@ottabase/cf-ai/gateway`    | AI Gateway proxy — any provider with caching/logging/rate-limits |
| `UniversalAIClient` | `@ottabase/cf-ai/universal`  | High-level unified chat with multi-provider fallback             |

## Installation

Already included in the monorepo. Add to your app's `package.json`:

```json
{
    "@ottabase/cf-ai": "workspace:*"
}
```

## Quick Start

### Universal Client (Recommended)

```typescript
import { createUniversalAIClient } from '@ottabase/cf-ai/universal';

const ai = createUniversalAIClient({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    gateway: 'production',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    fallbacks: [
        { provider: 'openai', model: 'gpt-4o-mini', apiKey: env.CFAI_OPENAI_API_KEY },
        { provider: 'anthropic', model: 'claude-sonnet-4-20250514', apiKey: env.CFAI_ANTHROPIC_API_KEY },
        { provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct', apiKey: env.CF_API_TOKEN },
    ],
});

// Simple chat
const result = await ai.chat('What is the capital of France?');
if (result.success) {
    console.log(result.data.text); // "Paris"
}

// With options
const result2 = await ai.chat('Summarize this article', {
    systemPrompt: 'You are a concise summarizer.',
    temperature: 0.3,
    max_tokens: 200,
    cacheTtl: 3600, // Cache for 1 hour via AI Gateway
});

// Automatic fallback — tries each provider in order
const result3 = await ai.chatWithFallback('Hello!');
if (result3.success) {
    console.log(`Served by: ${result3.data.provider}`);
}

// Streaming
const stream = await ai.chatStream('Tell me a story', {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: env.CFAI_OPENAI_API_KEY,
});
```

### Workers AI Client (Direct Binding)

```typescript
import { createWorkersAIClient } from '@ottabase/cf-ai/workers-ai';

const ai = createWorkersAIClient({ binding: env.OBCF_AI });

// Text generation
const result = await ai.textGeneration({
    model: '@cf/meta/llama-3.1-8b-instruct',
    messages: [{ role: 'user', content: 'Hello!' }],
});

// Embeddings
const embeddings = await ai.embeddings({
    model: '@cf/baai/bge-base-en-v1.5',
    text: 'Some text to embed',
});

// Image generation
const image = await ai.imageGeneration({
    model: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    prompt: 'A sunset over mountains',
});

// Translation
const translated = await ai.translation({
    model: '@cf/meta/m2m100-1.2b',
    text: 'Hello world',
    source_lang: 'en',
    target_lang: 'fr',
});

// Streaming
const stream = await ai.textGenerationStream({
    model: '@cf/meta/llama-3.1-8b-instruct',
    messages: [{ role: 'user', content: 'Tell me a joke' }],
});
```

### AI Gateway Client (Provider Proxy)

```typescript
import { createAIGatewayClient } from '@ottabase/cf-ai/gateway';

const gw = createAIGatewayClient({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    gateway: 'my-gateway',
});

// OpenAI through gateway
const result = await gw.chatCompletion(
    'openai',
    {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello!' }],
    },
    { apiKey: env.CFAI_OPENAI_API_KEY, cacheTtl: 3600 },
);

// Anthropic through gateway
const result2 = await gw.chatCompletion(
    'anthropic',
    {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hello!' }],
    },
    { apiKey: env.CFAI_ANTHROPIC_API_KEY },
);

// Any provider endpoint (e.g. image generation)
const images = await gw.request(
    'openai',
    '/v1/images/generations',
    {
        prompt: 'A cat wearing a hat',
        n: 1,
        size: '1024x1024',
    },
    { apiKey: env.CFAI_OPENAI_API_KEY },
);
```

## Supported Providers

| Provider         | Key                | Auth Method      |
| ---------------- | ------------------ | ---------------- |
| Workers AI       | `workers-ai`       | Bearer token     |
| OpenAI           | `openai`           | Bearer token     |
| Anthropic        | `anthropic`        | x-api-key header |
| Google AI Studio | `google-ai-studio` | Query parameter  |
| Azure OpenAI     | `azure`            | api-key header   |
| Mistral AI       | `mistral`          | Bearer token     |
| Groq             | `groq`             | Bearer token     |
| Cohere           | `cohere`           | Bearer token     |
| Hugging Face     | `hugging-face`     | Bearer token     |
| Perplexity AI    | `perplexity`       | Bearer token     |
| DeepSeek         | `deepseek`         | Bearer token     |

## AI Gateway Features

All requests through `AIGatewayClient` and `UniversalAIClient` automatically get:

- **Caching** — Set `cacheTtl` to cache responses (seconds)
- **Logging** — All requests logged in CF dashboard
- **Rate Limiting** — Configure in CF dashboard
- **Analytics** — Token usage, latency, cost tracking
- **Custom Metadata** — Attach metadata for filtering in logs

```typescript
const result = await gw.chatCompletion('openai', request, {
    cacheTtl: 3600, // Cache for 1 hour
    skipCache: false, // Use cache (default)
    metadata: {
        // Custom metadata for logging
        userId: 'u123',
        feature: 'summarizer',
    },
});
```

## Cloudflare Setup

### 1. Create an AI Gateway

In the Cloudflare dashboard: **AI** → **AI Gateway** → **Create Gateway**.

### 2. Add Bindings (for Workers AI)

In `wrangler.jsonc`:

```jsonc
{
    "ai": {
        "binding": "OBCF_AI",
    },
}
```

### 3. Add Environment Variables

In `wrangler.jsonc` (or `.dev.vars` for local dev):

```jsonc
{
    "vars": {
        "CLOUDFLARE_ACCOUNT_ID": "your-account-id",
        "CFAI_GATEWAY_NAME": "your-gateway-name",
    },
}
```

Provider API keys should be set as secrets (via `.dev.vars` locally, or `wrangler secret put` for production):

| Variable                 | Required For                                               |
| ------------------------ | ---------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`  | AI Gateway + Universal clients (always required for proxy) |
| `CFAI_GATEWAY_NAME`      | AI Gateway + Universal clients                             |
| `CFAI_CF_API_TOKEN`      | Workers AI through Gateway (Cloudflare API token)          |
| `CFAI_OPENAI_API_KEY`    | OpenAI through Gateway                                     |
| `CFAI_ANTHROPIC_API_KEY` | Anthropic through Gateway                                  |
| `CFAI_GOOGLE_AI_API_KEY` | Google AI Studio through Gateway                           |

> **Note:** `@cloudflare/workers-types` must be in your TypeScript type path when using the `workers-ai` entry point
> (the `Ai` global type comes from there).

## API Reference

### `Result<T>` Pattern

All methods return `Result<T>` — a discriminated union that avoids throwing:

```typescript
const result = await ai.chat('Hello');
if (result.success) {
    console.log(result.data.text);
} else {
    console.error(result.error.code, result.error.message);
}
```
