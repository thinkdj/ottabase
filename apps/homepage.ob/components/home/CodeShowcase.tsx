'use client';

import { AnimateOnView } from '@/components/core/AnimateOnView';
import { useState } from 'react';

type TabId = 'model' | 'hooks' | 'rls' | 'deploy';

const FILENAMES: Record<TabId, string> = {
    model: 'ottabase/models/Todo.ts',
    hooks: 'ottabase/hooks/useTodos.ts',
    rls: 'worker/middleware/rls.ts',
    deploy: 'terminal',
};

const PANEL_MODEL = `import { BaseModel } from '@ottabase/ottaorm';
import { todosTable } from '../db/schema';

export class Todo extends BaseModel {
  static entity = 'todos';
  static table  = todosTable;

  static casts = {
    completed: 'boolean' as const,
  };

  // Relationships use dynamic imports — no circular deps.
  async user() {
    const { User } = await import('@ottabase/ottaorm');
    return this.belongsTo(User, 'userId');
  }

  // Domain logic lives with the data.
  async toggle() {
    this.set('completed', !this.get('completed'));
    return this.save();
  }
}`;

const PANEL_HOOKS = `import { createModelHooks } from '@ottabase/ottaorm/client';

// Five hooks, one line. CRUD is done.
export const {
  useList:   useTodos,
  useCreate: useCreateTodo,
  useUpdate: useUpdateTodo,
  useDelete: useDeleteTodo,
  useDetail: useTodo,
} = createModelHooks<TodoType>({ entityName: 'todos' });

// In your component — it just works.
const { data: todos } = useTodos();
const create = useCreateTodo();

await create.mutateAsync({
  title: 'Ship the thing',
  completed: false,
});

// The API at /api/ottaorm/todos
// was created automatically.
// You wrote zero server code.`;

const PANEL_RLS = `// One call at request start.
// Every query after is scoped automatically.
await initRLS({
  organizationId: session.user.orgId,
  userId:         session.user.id,
  appId:          'my-saas',
});

// This returns ONLY this tenant's todos.
// No WHERE clause. No accident possible.
const todos = await Todo.all();

// RBAC is enforced at the same layer.
// Roles are cached in Cloudflare KV.
// Permissions are checked transparently.

// Multi-tenancy is the foundation.
// Not a feature you add in month 6.`;

const PANEL_DEPLOY = `# 1. Create your Cloudflare resources.
#    D1, KV, R2, Queues — all of them.
$ pnpm cf:setup
  ✓ D1 database created
  ✓ KV namespace created
  ✓ R2 bucket created

# 2. Initialize your database schema.
#    No migration files. No SQL to write.
$ curl -X POST localhost:3004/api/ottaorm/init
  ✓ 12 tables created

# 3. Deploy to 300+ edge locations.
$ wrangler deploy
  ✓ Deployed in 8 seconds
  ✓ https://my-saas.workers.dev

# That's it. No servers. No DevOps.
# ~$5/month at meaningful scale.`;

const PANELS: Record<TabId, string> = {
    model: PANEL_MODEL,
    hooks: PANEL_HOOKS,
    rls: PANEL_RLS,
    deploy: PANEL_DEPLOY,
};

export function CodeShowcase() {
    const [tab, setTab] = useState<TabId>('model');

    return (
        <section className="code-showcase" aria-labelledby="code-heading">
            <div className="container code-showcase-inner">
                <AnimateOnView className="code-showcase-header">
                    <h2 id="code-heading">
                        Beautiful APIs.
                        <br />
                        Ugly problems, solved.
                    </h2>
                    <p>
                        OttaORM&apos;s fat models pattern keeps domain logic with the data — not scattered across
                        controllers, services, and repositories.
                    </p>

                    <div className="code-tabs" role="tablist" aria-label="Code examples">
                        {(
                            [
                                ['model', 'Model'],
                                ['hooks', 'Hooks'],
                                ['rls', 'RLS'],
                                ['deploy', 'Deploy'],
                            ] as const
                        ).map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                className={`code-tab${tab === id ? ' active' : ''}`}
                                role="tab"
                                aria-selected={tab === id}
                                aria-controls={`panel-${id}`}
                                id={`tab-${id}`}
                                onClick={() => setTab(id)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </AnimateOnView>

                <AnimateOnView delayClass="animate-delay-2">
                    <div className="code-window" role="tabpanel">
                        <div className="code-window-bar" aria-hidden="true">
                            <span className="code-window-dot" style={{ background: '#ef4444' }} />
                            <span className="code-window-dot" style={{ background: '#f59e0b' }} />
                            <span className="code-window-dot" style={{ background: '#10b981' }} />
                            <span className="code-window-filename" id="code-filename">
                                {FILENAMES[tab]}
                            </span>
                        </div>

                        {(Object.keys(PANELS) as TabId[]).map((id) => (
                            <div
                                key={id}
                                className={`code-panel${tab === id ? ' active' : ''}`}
                                id={`panel-${id}`}
                                hidden={tab !== id}
                                aria-label={`${id} example`}
                            >
                                <pre className="code-block">
                                    <code>{PANELS[id]}</code>
                                </pre>
                            </div>
                        ))}
                    </div>
                </AnimateOnView>
            </div>
        </section>
    );
}
