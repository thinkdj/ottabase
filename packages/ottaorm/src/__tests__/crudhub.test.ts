import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { afterEach, describe, expect, it } from 'vitest';
import { BaseModel } from '../base/BaseModel';
import {
    CRUDHUB_DENYLIST,
    describeCrudHubModel,
    fillRouteTokens,
    getCrudHubModel,
    isCrudHubModel,
    listCrudHubModels,
} from '../crudhub';
import { clearModelRegistry, getAllModelsMetadata, registerModel } from '../registry';

const table = sqliteTable('hub_things', { id: text('id').primaryKey(), name: text('name'), secret: text('secret') });

class Thing extends BaseModel {
    static entity = 'hub_things';
    static table = table;
    static packageName = '@ottabase/things';
    static packageType = 'package' as const;
    static displayName = 'Thing';
    static displayNamePlural = 'Things';
    static admin = { enabled: true, scope: 'org' as const, routes: { view: '/things/:slug' } };
    static adminActions = {
        ping: { title: 'Ping', when: (row: Record<string, unknown>) => row.name !== 'x', run: () => 'pong' },
    };
    protected static hidden = ['secret'];
    protected static fields = {
        id: { type: 'id' as const, primaryKey: true },
        name: { type: 'string' as const, searchable: true },
        secret: { type: 'string' as const },
    };
}

class Hidden extends BaseModel {
    static entity = 'hub_hidden';
    static table = sqliteTable('hub_hidden', { id: text('id').primaryKey() });
}

class Sneaky extends BaseModel {
    static entity = 'users';
    static table = sqliteTable('users', { id: text('id').primaryKey() });
    static admin = { enabled: true };
}

describe('CrudHub model opt-in', () => {
    afterEach(() => clearModelRegistry());

    it('lists only enabled models and never a denylisted table, even when it opts in', () => {
        registerModel(Thing);
        registerModel(Hidden);
        registerModel(Sneaky);
        expect(listCrudHubModels().map((m) => m.entity)).toEqual(['hub_things']);
        expect(getCrudHubModel('users')).toBeNull();
        expect(getCrudHubModel('hub_hidden')).toBeNull();
        expect(isCrudHubModel(getAllModelsMetadata().get('users')!)).toBe(false);
        for (const table of ['users', 'roles', 'user_roles', 'accounts', 'verification_tokens', 'audit_logs']) {
            expect(CRUDHUB_DENYLIST.has(table)).toBe(true);
        }
    });

    it('describes a model without hidden fields or action functions', () => {
        registerModel(Thing);
        const descriptor = describeCrudHubModel(getCrudHubModel('hub_things')!);
        expect(Object.keys(descriptor.fields)).toEqual(['id', 'name']);
        expect(descriptor.searchField).toBe('name');
        expect(descriptor.titleField).toBe('name');
        expect(descriptor.scope).toBe('org');
        expect(descriptor.actions).toEqual([
            { key: 'ping', title: 'Ping', destructive: false, confirm: undefined, bulk: false },
        ]);
        expect(JSON.stringify(descriptor)).not.toContain('pong');
    });

    it('fills route tokens and refuses a template with a missing value', () => {
        expect(fillRouteTokens('/blog/:slug', { slug: 'hello world' })).toBe('/blog/hello%20world');
        expect(fillRouteTokens('/admin/x/:id/edit', { id: 7 })).toBe('/admin/x/7/edit');
        expect(fillRouteTokens('/blog/:slug', { slug: '' })).toBeNull();
    });

    it('never exposes any denylisted grant or auth table, even when it opts in', () => {
        for (const entity of CRUDHUB_DENYLIST) {
            class Optin extends BaseModel {
                static entity = entity;
                static table = sqliteTable(entity, { id: text('id').primaryKey() });
                static admin = { enabled: true };
            }
            registerModel(Optin);
            expect(getCrudHubModel(entity)).toBeNull();
        }
        expect(listCrudHubModels()).toEqual([]);
    });
});
