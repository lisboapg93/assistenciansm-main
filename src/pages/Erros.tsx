import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Bug, Eye, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage, logAndThrow } from "@/lib/errorLogging";
import { QueryError } from "@/components/QueryError";
import { formatBrazilianDateTime } from "@/lib/date";

type JsonObject = Record<string, unknown>;

interface TechnicalErrorLog {
  id: string;
  error_message: string;
  error_location: string;
  operation: string | null;
  entity: string | null;
  entity_id: string | null;
  metadata: JsonObject;
  user_id: string | null;
  occurred_at: string;
}

interface OperationFailureLog {
  id: string;
  operation: "create" | "update" | "delete" | "import";
  entity: string;
  entity_id: string | null;
  error_message: string;
  error_code: string | null;
  error_location: string;
  input_payload: JsonObject;
  metadata: JsonObject;
  user_id: string | null;
  occurred_at: string;
}

interface ErrorEntry {
  id: string;
  source: "operacional" | "técnico";
  operation: string | null;
  entity: string | null;
  entityId: string | null;
  message: string;
  code: string | null;
  location: string;
  userId: string | null;
  occurredAt: string;
  inputPayload: JsonObject | null;
  metadata: JsonObject;
}

type OperationFailureLogsRpc = (
  functionName: "list_operation_failure_logs",
  args: { p_limit: number },
) => Promise<{ data: OperationFailureLog[] | null; error: { message: string } | null }>;

function formatDateTime(value: string) {
  return formatBrazilianDateTime(value, true);
}

export default function Erros() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | ErrorEntry["source"]>("all");
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);

  const { data: errors = [], isLoading, isFetching, isError, error: queryError, refetch } = useQuery({
    queryKey: ["error-logs"],
    queryFn: async (): Promise<ErrorEntry[]> => {
      const operationFailureRpc = supabase.rpc.bind(supabase) as unknown as OperationFailureLogsRpc;
      const [technicalResult, operationalResult] = await Promise.all([
        supabase
          .from("error_logs")
          .select("id, error_message, error_location, operation, entity, entity_id, metadata, user_id, occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(200),
        operationFailureRpc("list_operation_failure_logs", { p_limit: 200 }),
      ]);

      if (technicalResult.error) {
        return logAndThrow(technicalResult.error, {
          location: "Erros.listTechnical",
          operation: "read",
          entity: "error_logs",
        });
      }
      if (operationalResult.error) {
        return logAndThrow(operationalResult.error, {
          location: "Erros.listOperational",
          operation: "read",
          entity: "operation_failure_logs",
        });
      }

      const technicalErrors = (technicalResult.data as TechnicalErrorLog[]).map((error) => ({
        id: `technical-${error.id}`,
        source: "técnico" as const,
        operation: error.operation,
        entity: error.entity,
        entityId: error.entity_id,
        message: getErrorMessage(error.error_message),
        code: null,
        location: error.error_location,
        userId: error.user_id,
        occurredAt: error.occurred_at,
        inputPayload: null,
        metadata: error.metadata,
      }));
      const operationalErrors = (operationalResult.data || []).map((error) => ({
        id: `operational-${error.id}`,
        source: "operacional" as const,
        operation: error.operation,
        entity: error.entity,
        entityId: error.entity_id,
        message: getErrorMessage(error.error_message),
        code: error.error_code,
        location: error.error_location,
        userId: error.user_id,
        occurredAt: error.occurred_at,
        inputPayload: error.input_payload,
        metadata: error.metadata,
      }));

      return [...operationalErrors, ...technicalErrors]
        .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt));
    },
  });

  const filteredErrors = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return errors.filter((error) => {
      if (sourceFilter !== "all" && error.source !== sourceFilter) return false;
      if (!normalizedSearch) return true;
      return [error.message, error.location, error.operation, error.entity, error.code]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    });
  }, [errors, search, sourceFilter]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["error-logs"] });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <ShieldAlert className="h-7 w-7 text-destructive" />
              Erros do sistema
            </h1>
            <p className="mt-1 text-muted-foreground">
              Falhas técnicas e operacionais registradas no banco.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={refresh} disabled={isFetching}>
            <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar erro, operação ou entidade..." />
            </div>
            <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as typeof sourceFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os registros</SelectItem>
                <SelectItem value="operacional">Operacionais</SelectItem>
                <SelectItem value="técnico">Técnicos</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isError ? <QueryError error={queryError} onRetry={() => void refetch()} /> : isLoading ? (
              <div className="space-y-3 p-6">{[...Array(6)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div>
            ) : filteredErrors.length === 0 ? (
              <div className="p-12 text-center">
                <Bug className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">Nenhum erro encontrado</p>
                <p className="mt-1 text-muted-foreground">Os novos erros aparecerão aqui automaticamente após atualizar.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 p-4 md:hidden">
                  {filteredErrors.map((error) => (
                    <button
                      key={error.id}
                      type="button"
                      className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
                      onClick={() => setSelectedError(error)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">{formatDateTime(error.occurredAt)}</p>
                          <p className="mt-1 truncate font-medium">{error.message}</p>
                        </div>
                        <Eye className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant={error.source === "operacional" ? "destructive" : "secondary"}>{error.source}</Badge>
                        <span>{error.operation || "—"}</span>
                        {error.entity && <span>• {error.entity}</span>}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data e hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Operação</TableHead>
                        <TableHead>Entidade</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead className="w-[52px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredErrors.map((error) => (
                        <TableRow key={error.id}>
                          <TableCell className="whitespace-nowrap text-sm">{formatDateTime(error.occurredAt)}</TableCell>
                          <TableCell><Badge variant={error.source === "operacional" ? "destructive" : "secondary"}>{error.source}</Badge></TableCell>
                          <TableCell>{error.operation || "—"}</TableCell>
                          <TableCell>{error.entity || "—"}</TableCell>
                          <TableCell className="max-w-64 truncate">{error.message}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" aria-label="Ver detalhes do erro" onClick={() => setSelectedError(error)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selectedError && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" />Detalhes do erro</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
                  <p><span className="text-muted-foreground">Data e hora:</span><br />{formatDateTime(selectedError.occurredAt)}</p>
                  <p><span className="text-muted-foreground">Tipo:</span><br />{selectedError.source}</p>
                  <p><span className="text-muted-foreground">Operação:</span><br />{selectedError.operation || "—"}</p>
                  <p><span className="text-muted-foreground">Entidade:</span><br />{selectedError.entity || "—"}</p>
                  <p className="sm:col-span-2"><span className="text-muted-foreground">Local:</span><br />{selectedError.location}</p>
                  {selectedError.code && <p><span className="text-muted-foreground">Código:</span><br />{selectedError.code}</p>}
                  {selectedError.userId && <p><span className="text-muted-foreground">Conta:</span><br />{selectedError.userId}</p>}
                </div>
                <div>
                  <p className="mb-1 font-medium">Mensagem</p>
                  <p className="rounded-lg border p-3 text-muted-foreground">{selectedError.message}</p>
                </div>
                {selectedError.inputPayload && (
                  <div>
                    <p className="mb-1 font-medium">Dados enviados</p>
                    <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(selectedError.inputPayload, null, 2)}</pre>
                  </div>
                )}
                <div>
                  <p className="mb-1 font-medium">Metadados</p>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(selectedError.metadata, null, 2)}</pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
