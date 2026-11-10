// The Worker entry. The corpus is written by `scripts/build-corpus.mjs` before every build, dev and deploy.
import corpus from './corpus.generated.json';
import { createApp } from './app';
import type { Corpus } from './corpus';

const app = createApp(corpus as Corpus);

export default {
    fetch: (request: Request) => app(request),
} satisfies ExportedHandler;
