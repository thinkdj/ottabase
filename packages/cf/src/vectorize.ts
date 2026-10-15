/**
 * Vectorize wrapper
 * Similarity search over embeddings, with a default namespace so one index serves every tenant.
 *
 * @see https://developers.cloudflare.com/vectorize/
 */

import type {
    Vectorize,
    VectorizeAsyncMutation,
    VectorizeIndexInfo,
    VectorizeMatches,
    VectorizeQueryOptions,
    VectorizeVector,
} from '@cloudflare/workers-types';
import { attempt, CloudflareError, type Result } from './types';

export interface VectorizeConfig {
    index: Vectorize;
    /**
     * Applied to every vector written and every query that does not name its own. Scope an index
     * per tenant (`org_123`) and a query can never see another tenant's vectors.
     */
    namespace?: string;
}

export type VectorizeQuery = Omit<VectorizeQueryOptions, 'namespace'> & { namespace?: string };

/** Vectorize bindings, scoped. */
export class VectorizeClient {
    private index: Vectorize;
    private namespace: string | undefined;

    constructor(config: VectorizeConfig) {
        if (!config.index) {
            throw new CloudflareError('Vectorize index binding is required', 'VECTORIZE_MISSING_BINDING');
        }
        this.index = config.index;
        this.namespace = config.namespace;
    }

    /** A client for another namespace on the same index. */
    scoped(namespace: string): VectorizeClient {
        return new VectorizeClient({ index: this.index, namespace });
    }

    private stamp(vectors: VectorizeVector[]): VectorizeVector[] {
        if (!this.namespace) return vectors;
        return vectors.map((vector) => ({ namespace: this.namespace, ...vector }));
    }

    /** Insert or replace. Vectorize applies mutations asynchronously; the id lets you poll. */
    upsert(vectors: VectorizeVector[]): Promise<Result<VectorizeAsyncMutation, Error>> {
        return attempt(() => this.index.upsert(this.stamp(vectors)));
    }

    /** Insert only; an existing id is an error. */
    insert(vectors: VectorizeVector[]): Promise<Result<VectorizeAsyncMutation, Error>> {
        return attempt(() => this.index.insert(this.stamp(vectors)));
    }

    query(vector: number[] | Float32Array, options: VectorizeQuery = {}): Promise<Result<VectorizeMatches, Error>> {
        return attempt(() => this.index.query(vector, { namespace: this.namespace, ...options }));
    }

    queryById(id: string, options: VectorizeQuery = {}): Promise<Result<VectorizeMatches, Error>> {
        return attempt(() => this.index.queryById(id, { namespace: this.namespace, ...options }));
    }

    getByIds(ids: string[]): Promise<Result<VectorizeVector[], Error>> {
        return attempt(() => this.index.getByIds(ids));
    }

    deleteByIds(ids: string[]): Promise<Result<VectorizeAsyncMutation, Error>> {
        return attempt(() => this.index.deleteByIds(ids));
    }

    describe(): Promise<Result<VectorizeIndexInfo, Error>> {
        return attempt(() => this.index.describe());
    }
}

export function createVectorizeClient(config: VectorizeConfig): VectorizeClient {
    return new VectorizeClient(config);
}
