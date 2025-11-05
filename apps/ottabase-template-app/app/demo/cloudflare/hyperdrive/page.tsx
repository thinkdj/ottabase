export default function HyperdriveDemoPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFA] p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-semibold text-gray-900">
            Hyperdrive Demo
          </h1>
          <p className="text-gray-600">
            Accelerate access to your existing databases from Cloudflare Workers
          </p>
        </div>

        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-3 text-sm font-medium text-blue-900">
            What is Hyperdrive?
          </h3>
          <p className="mb-4 text-sm text-blue-700">
            Hyperdrive speeds up access to your existing databases by maintaining connection pools
            and caching frequent queries at Cloudflare's edge. It works with PostgreSQL and MySQL
            databases, including popular managed services like:
          </p>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>• PostgreSQL: Amazon RDS, Google Cloud SQL, Neon, Supabase, etc.</li>
            <li>• MySQL: Amazon RDS, Google Cloud SQL, PlanetScale, etc.</li>
            <li>• Compatible with standard connection strings</li>
            <li>• No code changes required - just point your connection string to Hyperdrive</li>
          </ul>
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-medium text-gray-900">
            Key Benefits
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="mb-2 text-sm font-semibold text-gray-900">
                🚀 Connection Pooling
              </h4>
              <p className="text-xs text-gray-600">
                Reuses database connections across requests, eliminating the overhead
                of creating new connections for every Worker invocation.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="mb-2 text-sm font-semibold text-gray-900">
                ⚡ Query Caching
              </h4>
              <p className="text-xs text-gray-600">
                Automatically caches frequently-read queries at the edge, reducing
                latency and database load.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="mb-2 text-sm font-semibold text-gray-900">
                🌍 Regional Performance
              </h4>
              <p className="text-xs text-gray-600">
                Smart routing ensures queries are routed through the optimal Cloudflare
                location closest to your database.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="mb-2 text-sm font-semibold text-gray-900">
                🔒 Security
              </h4>
              <p className="text-xs text-gray-600">
                Connections to your database are encrypted. Credentials are stored
                securely and never exposed to your application code.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Setup Instructions
          </h3>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">
                1. Create a Hyperdrive configuration
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`# PostgreSQL example
wrangler hyperdrive create my-postgres \\
  --connection-string="postgres://user:password@host:5432/database"

# MySQL example
wrangler hyperdrive create my-mysql \\
  --connection-string="mysql://user:password@host:3306/database"`}
              </pre>
              <p className="mt-2 text-xs text-gray-600">
                This returns a Hyperdrive ID - copy it for the next step
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">
                2. Add binding to wrangler.jsonc
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "your-hyperdrive-id-here"
  }
]`}
              </pre>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">
                3. Use in your Worker code
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`import { createHyperdriveClient } from '@ottabase/cf/hyperdrive';

export async function GET(request: NextRequest) {
  const { env } = await getCloudflareContext();

  const hyperdrive = createHyperdriveClient({
    hyperdrive: env.HYPERDRIVE
  });

  const connectionString = hyperdrive.getConnectionString();

  // Use with your preferred database client
  // Example with 'postgres' (pg) driver:
  const client = new Client({ connectionString });
  await client.connect();

  const result = await client.query('SELECT * FROM users LIMIT 10');
  await client.end();

  return NextResponse.json({ users: result.rows });
}`}
              </pre>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Usage with Popular ORMs
          </h3>

          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">
                Prisma (PostgreSQL)
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`import { PrismaClient } from '@prisma/client';
import { createHyperdriveClient } from '@ottabase/cf/hyperdrive';

export async function onRequest(context) {
  const hyperdrive = createHyperdriveClient({
    hyperdrive: context.env.HYPERDRIVE
  });

  const prisma = new PrismaClient({
    datasourceUrl: hyperdrive.getConnectionString()
  });

  const users = await prisma.user.findMany();

  return new Response(JSON.stringify(users));
}`}
              </pre>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">
                Drizzle ORM
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createHyperdriveClient } from '@ottabase/cf/hyperdrive';

export async function onRequest(context) {
  const hyperdrive = createHyperdriveClient({
    hyperdrive: context.env.HYPERDRIVE
  });

  const client = postgres(hyperdrive.getConnectionString());
  const db = drizzle(client);

  const users = await db.select().from(usersTable);

  return new Response(JSON.stringify(users));
}`}
              </pre>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">
                Node.js pg driver (PostgreSQL)
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`import { Client } from 'pg';
import { createHyperdriveClient } from '@ottabase/cf/hyperdrive';

export async function onRequest(context) {
  const hyperdrive = createHyperdriveClient({
    hyperdrive: context.env.HYPERDRIVE
  });

  const client = new Client({
    connectionString: hyperdrive.getConnectionString()
  });

  await client.connect();
  const result = await client.query('SELECT NOW()');
  await client.end();

  return new Response(JSON.stringify(result.rows));
}`}
              </pre>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-gray-900">
                mysql2 driver (MySQL)
              </p>
              <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`import mysql from 'mysql2/promise';
import { createHyperdriveClient } from '@ottabase/cf/hyperdrive';

export async function onRequest(context) {
  const hyperdrive = createHyperdriveClient({
    hyperdrive: context.env.HYPERDRIVE
  });

  const connection = await mysql.createConnection(
    hyperdrive.getConnectionString()
  );

  const [rows] = await connection.execute('SELECT * FROM users');
  await connection.end();

  return new Response(JSON.stringify(rows));
}`}
              </pre>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Best Practices
          </h3>
          <ul className="space-y-3 text-sm text-gray-600">
            <li>
              <span className="font-medium text-gray-900">• Connection Management:</span> Always
              close connections after use. Hyperdrive pools connections, but you should still
              properly clean up client connections.
            </li>
            <li>
              <span className="font-medium text-gray-900">• Read vs Write:</span> Hyperdrive is
              optimized for read-heavy workloads. Write queries still benefit from connection
              pooling but are not cached.
            </li>
            <li>
              <span className="font-medium text-gray-900">• Cache Control:</span> Use prepared
              statements for frequently executed queries to maximize cache hit rates.
            </li>
            <li>
              <span className="font-medium text-gray-900">• Regional Routing:</span> Create
              Hyperdrive configurations in the same region as your database for lowest latency.
            </li>
            <li>
              <span className="font-medium text-gray-900">• Error Handling:</span> Implement
              proper error handling and retries for database operations.
            </li>
            <li>
              <span className="font-medium text-gray-900">• Monitoring:</span> Use Cloudflare's
              analytics to monitor Hyperdrive performance and cache hit rates.
            </li>
          </ul>
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Configuration Methods
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            The HyperdriveClient provides helper methods to access connection details:
          </p>
          <pre className="overflow-x-auto rounded bg-gray-50 p-4 text-xs">
{`const hyperdrive = createHyperdriveClient({ hyperdrive: env.HYPERDRIVE });

// Get full connection string
const connString = hyperdrive.getConnectionString();

// Get individual connection parameters
const host = hyperdrive.getHost();
const port = hyperdrive.getPort();
const database = hyperdrive.getDatabase();
const user = hyperdrive.getUser();

// Use the connect helper with a factory function
const result = await hyperdrive.connect(async (connectionString) => {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
});

if (result.success) {
  const client = result.data;
  // Use client...
  await client.end();
}`}
          </pre>
        </div>

        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Performance Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="pb-3 text-left font-medium text-gray-900">Scenario</th>
                  <th className="pb-3 text-left font-medium text-gray-900">Without Hyperdrive</th>
                  <th className="pb-3 text-left font-medium text-gray-900">With Hyperdrive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-3 text-gray-600">Connection Setup</td>
                  <td className="py-3 text-gray-600">50-200ms per request</td>
                  <td className="py-3 font-medium text-green-700">~0ms (pooled)</td>
                </tr>
                <tr>
                  <td className="py-3 text-gray-600">Frequent Read Queries</td>
                  <td className="py-3 text-gray-600">100-500ms</td>
                  <td className="py-3 font-medium text-green-700">~1-10ms (cached)</td>
                </tr>
                <tr>
                  <td className="py-3 text-gray-600">Geographic Latency</td>
                  <td className="py-3 text-gray-600">Varies widely</td>
                  <td className="py-3 font-medium text-green-700">Optimized routing</td>
                </tr>
                <tr>
                  <td className="py-3 text-gray-600">Database Load</td>
                  <td className="py-3 text-gray-600">High (many connections)</td>
                  <td className="py-3 font-medium text-green-700">Low (pooled + cached)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-medium text-gray-900">
            Implementation Notes
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Uses @ottabase/cf Hyperdrive wrapper for type-safe operations</li>
            <li>• Works with any PostgreSQL or MySQL database</li>
            <li>• Compatible with all standard database drivers and ORMs</li>
            <li>• Not available in local dev - use environment-specific configuration</li>
            <li>• Connection strings are encrypted and never exposed</li>
            <li>• Perfect for reducing database costs and improving response times</li>
          </ul>
        </div>

        <div className="mt-8 rounded-lg border border-yellow-200 bg-yellow-50 p-6">
          <h3 className="mb-3 text-sm font-medium text-yellow-900">
            Local Development Note
          </h3>
          <p className="text-sm text-yellow-700">
            Hyperdrive is not available in local development with <code className="rounded bg-yellow-100 px-1">wrangler dev</code>.
            For local testing, you can:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-yellow-700">
            <li>• Use a direct database connection string in development</li>
            <li>• Use <code className="rounded bg-yellow-100 px-1">wrangler dev --remote</code> to test against real Hyperdrive</li>
            <li>• Configure environment-specific connection logic</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
