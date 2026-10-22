import { ottaJsonHandler } from '@ottabase/discover/next';
import { getProductFacts } from '../../../lib/product';

// The facts come from the live site and home page, so the file is built per request (and cached five minutes).
export const dynamic = 'force-dynamic';

/** /.well-known/otta.json: the product's facts in the shape Ottabuzz and Imageine read. Any origin may fetch it. */
export const GET = ottaJsonHandler(getProductFacts);
