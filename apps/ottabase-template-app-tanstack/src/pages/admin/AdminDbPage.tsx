import { api, isApiError } from "@/lib/api";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ottabase/ui-shadcn";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TableDataResponse {
  tableName: string;
  columns: { name: string; type: string; pk: number }[];
  rows: Record<string, any>[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export function AdminDbPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/admin/db" });
  const selectedTable = search.table;
  const page = search.page;
  const perPage = search.perPage;

  const queryClient = useQueryClient();

  // Load tables list
  const { data: tablesData, isLoading: tablesLoading } = useQuery({
    queryKey: ["admin", "db", "tables"],
    queryFn: async () => {
      return api<{ tables: string[] }>("/api/admin/db/tables");
    },
  });

  // Load table data
  const {
    data: tableData,
    isLoading: tableLoading,
    error: tableError,
  } = useQuery({
    queryKey: ["admin", "db", "table", selectedTable, page, perPage],
    queryFn: async () => {
      if (!selectedTable) return null;
      return api<TableDataResponse>(
        `/api/admin/db/tables/${selectedTable}?page=${page}&perPage=${perPage}`,
      );
    },
    enabled: !!selectedTable,
  });

  // Delete row mutation
  const deleteRowMutation = useMutation({
    mutationFn: async ({
      id,
      pkField,
    }: {
      id: string | number;
      pkField: string;
    }) => {
      return api(`/api/admin/db/tables/${selectedTable}/${id}?pk=${pkField}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast.success("Row deleted");
      queryClient.invalidateQueries({
        queryKey: ["admin", "db", "table", selectedTable],
      });
    },
    onError: (err) => {
      toast.error(isApiError(err) ? err.message : "Failed to delete row");
    },
  });

  const handleTableSelect = (tableName: string) => {
    navigate({
      to: "/admin/db",
      search: { table: tableName, page: 1, perPage: 25 },
    });
  };

  const handlePageChange = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
    });
  };

  const handleDelete = (row: Record<string, any>) => {
    if (!tableData) return;

    // Find PK field
    const pkColumn = tableData.columns.find((c) => c.pk > 0);
    const pkField = pkColumn ? pkColumn.name : "id";
    const id = row[pkField];

    if (id === undefined) {
      toast.error("Could not determine primary key for this row");
      return;
    }

    if (
      confirm(`Are you sure you want to delete this row? (${pkField}: ${id})`)
    ) {
      deleteRowMutation.mutate({ id, pkField });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin">← Back to Admin</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">
            Database Manager
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Table List */}
        <div className="col-span-12 md:col-span-3">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4" />
                Tables
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tablesLoading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <div className="flex flex-col max-h-[calc(100vh-300px)] overflow-y-auto">
                  {tablesData?.tables.map((table) => (
                    <button
                      key={table}
                      onClick={() => handleTableSelect(table)}
                      className={`px-4 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors ${
                        selectedTable === table
                          ? "bg-accent text-accent-foreground font-medium border-l-2 border-primary"
                          : "border-l-2 border-transparent"
                      }`}
                    >
                      {table}
                    </button>
                  ))}
                  {tablesData?.tables.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">
                      No tables found
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Data View */}
        <div className="col-span-12 md:col-span-9">
          {!selectedTable ? (
            <Card className="h-full min-h-[400px] flex items-center justify-center bg-muted/20 border-dashed">
              <div className="text-center text-muted-foreground">
                <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a table to view data</p>
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-xl font-mono">
                    {selectedTable}
                  </CardTitle>
                  <CardDescription>
                    {tableLoading
                      ? "Loading..."
                      : `${tableData?.pagination.total || 0} rows`}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {tableLoading ? (
                  <div className="py-20 text-center text-muted-foreground">
                    Loading data...
                  </div>
                ) : tableError ? (
                  <div className="py-10 text-center text-destructive">
                    {/* error handling */}
                    Error:{" "}
                    {isApiError(tableError)
                      ? tableError.message
                      : (tableError as Error).message}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            {tableData?.columns.map((col) => (
                              <TableHead
                                key={col.name}
                                className="whitespace-nowrap font-mono text-xs"
                              >
                                {col.name}
                                {col.pk > 0 && (
                                  <span className="ml-1 text-primary text-[10px]">
                                    (PK)
                                  </span>
                                )}
                                <span className="ml-1 text-muted-foreground text-[10px] font-normal">
                                  ({col.type})
                                </span>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableData?.rows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={(tableData?.columns.length || 0) + 1}
                                className="h-24 text-center text-muted-foreground"
                              >
                                No data found
                              </TableCell>
                            </TableRow>
                          ) : (
                            tableData?.rows.map((row, i) => (
                              <TableRow
                                key={i}
                                className="group hover:bg-muted/50"
                              >
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDelete(row)}
                                    title="Delete row"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                                {tableData?.columns.map((col) => (
                                  <TableCell
                                    key={col.name}
                                    className="font-mono text-xs max-w-[200px] truncate"
                                    title={String(row[col.name])}
                                  >
                                    {row[col.name] === null ? (
                                      <span className="text-muted-foreground italic">
                                        null
                                      </span>
                                    ) : (
                                      String(row[col.name])
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {(tableData?.pagination.totalPages || 0) > 1 && (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Page {page} of {tableData?.pagination.totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page <= 1}
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Prev
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(page + 1)}
                            disabled={
                              page >= (tableData?.pagination.totalPages || 1)
                            }
                          >
                            Next
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
