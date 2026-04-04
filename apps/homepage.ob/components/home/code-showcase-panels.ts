export type CodeShowcaseTabId = 'model' | 'hooks' | 'rls' | 'deploy';

export const CODE_SHOWCASE_FILENAMES: Record<CodeShowcaseTabId, string> = {
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

export const CODE_SHOWCASE_PANELS: Record<CodeShowcaseTabId, string> = {
    model: PANEL_MODEL,
    hooks: PANEL_HOOKS,
    rls: PANEL_RLS,
    deploy: PANEL_DEPLOY,
};
