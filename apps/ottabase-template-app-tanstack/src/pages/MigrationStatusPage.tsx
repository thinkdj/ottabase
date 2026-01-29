import { useApiMutation } from "@ottabase/ottaorm/client";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@ottabase/ui-shadcn";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

interface InitResult {
  success: boolean;
  message: string;
  details: {
    tablesCreated: string[];
    columnsAdded: string[];
    customMigrationsRun: string[];
    customMigrationsSkipped: string[];
    tablesDetected: string[];
    tablesSkipped: string[];
    errors: string[];
  };
  timestamp: string;
}

export function MigrationStatusPage() {
  const [initResult, setInitResult] = useState<InitResult | null>(null);

  const initDb = useApiMutation<InitResult>({
    endpoint: "/api/ottaorm/init",
    method: "POST",
  });

  // Auto-run on mount
  useEffect(() => {
    // Get secret from URL query params
    const searchParams = new URLSearchParams(window.location.search);
    const secret = searchParams.get("secret");

    // Pass secret in the body (supported by checkMigrationAuth)
    initDb.mutate(secret ? { secret } : {});
  }, []);

  useEffect(() => {
    if (initDb.data) {
      setInitResult(initDb.data);
    }
  }, [initDb.data]);

  const isLoading = initDb.isPending;
  const error = initDb.error;

  // Map table variable names to actual table names and categories
  const getTableInfo = (tableVarName: string) => {
    // Core tables mapping
    const coreTableMap: Record<string, string> = {
      accountsTable: "accounts",
      authenticatorsTable: "authenticators",
      postsTable: "posts",
      postTagsTable: "post_tags",
      sessionsTable: "sessions",
      tagsTable: "tags",
      usersTable: "users",
      verificationTokensTable: "verification_tokens",
    };

    // App tables mapping
    const appTableMap: Record<string, string> = {
      todosTable: "todos",
    };

    // Package tables mapping
    const packageTableMap: Record<string, string> = {
      shortlinksTable: "shortlinks",
    };

    if (coreTableMap[tableVarName]) {
      return { actualName: coreTableMap[tableVarName], category: "Core" };
    }
    if (appTableMap[tableVarName]) {
      return { actualName: appTableMap[tableVarName], category: "App" };
    }
    if (packageTableMap[tableVarName]) {
      return { actualName: packageTableMap[tableVarName], category: "Package" };
    }

    // Fallback - try to derive from variable name
    const actualName = tableVarName
      .replace(/Table$/, "")
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");
    return { actualName, category: "Unknown" };
  };

  // Build table status map
  const getTableStatus = (tableVarName: string) => {
    if (!initResult)
      return { status: "Unknown", icon: "❓", color: "text-gray-500" };

    const { actualName } = getTableInfo(tableVarName);

    // Check if created
    if (initResult.details.tablesCreated.includes(actualName)) {
      return { status: "Created", icon: "🆕", color: "text-green-600" };
    }

    // Check if existing/skipped
    if (initResult.details.tablesSkipped.includes(actualName)) {
      return { status: "Existing", icon: "✓", color: "text-blue-600" };
    }

    return { status: "Unknown", icon: "❓", color: "text-gray-500" };
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <Button asChild variant="ghost" className="w-fit">
        <Link to="/">← Back to Home</Link>
      </Button>

      <div>
        <h1 className="mb-2 text-3xl font-semibold">
          Database Migration Status
        </h1>
        <p className="text-muted-foreground">
          Running database initialization and migration checks...
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          This ensures all schemas (core, app, and packages) are migrated
          properly.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <h3 className="font-semibold text-destructive">Error</h3>
          <p className="text-sm text-destructive">{error.message}</p>
        </div>
      ) : null}

      {isLoading && (
        <div className="rounded-lg border bg-muted/50 p-8 text-center animate-pulse">
          <p>Initializing database...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Checking core tables, app tables, and enabled package tables...
          </p>
        </div>
      )}

      {initResult && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Status:{" "}
                {initResult.success ? (
                  <span className="text-green-500">Success</span>
                ) : (
                  <span className="text-red-500">Failed</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm border rounded-md p-4 bg-muted/30 font-mono whitespace-pre-wrap">
                {initResult.message}
              </div>

              {/* Success summary */}
              {initResult.success && (
                <div className="border rounded-md p-4 bg-green-50 dark:bg-green-950/20">
                  <h3 className="font-medium text-green-700 dark:text-green-400 mb-2">
                    ✅ Migration Summary
                  </h3>
                  <div className="text-sm space-y-1">
                    <p>
                      • {initResult.details.tablesDetected.length} table(s)
                      detected in schema
                    </p>
                    <p>
                      • {initResult.details.tablesCreated.length} new table(s)
                      created
                    </p>
                    <p>
                      • {initResult.details.tablesSkipped.length} table(s)
                      already exist
                    </p>
                    <p>
                      • {initResult.details.columnsAdded.length} column(s) added
                    </p>
                    <p>
                      • {initResult.details.customMigrationsRun.length} custom
                      migration(s) executed
                    </p>
                  </div>
                </div>
              )}

              {/* Single Table View */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b">
                  <h3 className="font-medium text-sm">
                    📊 All Tables ({initResult.details.tablesDetected.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 border-b">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">
                          Table Name
                        </th>
                        <th className="text-left px-4 py-2 font-medium">
                          Type
                        </th>
                        <th className="text-left px-4 py-2 font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {initResult.details.tablesDetected.map(
                        (tableVarName, i) => {
                          const { actualName, category } =
                            getTableInfo(tableVarName);
                          const statusInfo = getTableStatus(tableVarName);

                          const categoryColors: Record<string, string> = {
                            Core: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                            App: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
                            Package:
                              "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                            Unknown:
                              "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                          };

                          return (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="px-4 py-2 font-mono text-xs">
                                {actualName}
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[category]}`}
                                >
                                  {category}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`flex items-center gap-1 ${statusInfo.color}`}
                                >
                                  <span>{statusInfo.icon}</span>
                                  <span className="text-xs">
                                    {statusInfo.status}
                                  </span>
                                </span>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Columns Added Section - only show if there are columns */}
              {initResult.details.columnsAdded.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b">
                    <h3 className="font-medium text-sm">
                      ➕ Columns Added ({initResult.details.columnsAdded.length}
                      )
                    </h3>
                  </div>
                  <div className="p-4">
                    <ul className="list-disc list-inside text-xs space-y-1">
                      {initResult.details.columnsAdded.map((col, i) => (
                        <li key={i} className="font-mono text-muted-foreground">
                          {col}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Migrations Section - only show if there are migrations */}
              {(initResult.details.customMigrationsRun.length > 0 ||
                initResult.details.customMigrationsSkipped.length > 0) && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b">
                    <h3 className="font-medium text-sm">
                      ⚡ Custom Migrations
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {initResult.details.customMigrationsRun.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-green-600 mb-1">
                          ✓ Executed (
                          {initResult.details.customMigrationsRun.length})
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                          {initResult.details.customMigrationsRun.map(
                            (mig, i) => (
                              <li
                                key={i}
                                className="font-mono text-muted-foreground"
                              >
                                {mig}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                    {initResult.details.customMigrationsSkipped.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-blue-600 mb-1">
                          ⏭️ Skipped (Already Run) (
                          {initResult.details.customMigrationsSkipped.length})
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                          {initResult.details.customMigrationsSkipped.map(
                            (mig, i) => (
                              <li
                                key={i}
                                className="font-mono text-muted-foreground"
                              >
                                {mig}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {initResult.details.errors.length > 0 && (
                <div className="border border-destructive/30 rounded-md p-4 bg-destructive/5">
                  <h3 className="font-semibold text-destructive mb-2">
                    Detailed Errors
                  </h3>
                  <ul className="list-disc list-inside text-sm text-destructive space-y-1">
                    {initResult.details.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Timestamp */}
              <div className="text-xs text-muted-foreground text-right">
                Last run: {new Date(initResult.timestamp).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                const searchParams = new URLSearchParams(
                  window.location.search,
                );
                const secret = searchParams.get("secret");
                initDb.mutate(secret ? { secret } : {});
              }}
            >
              Run Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
