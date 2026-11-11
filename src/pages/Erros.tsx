import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bug, Eye, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QueryError } from "@/components/QueryError";
import { ErrorDetailsDialog } from "@/components/errors/ErrorDetailsDialog";
import { ErrorSourceBadge } from "@/components/errors/ErrorSourceBadge";
import { ERROR_LOGS_QUERY_KEY, useErrorLogs } from "@/hooks/useErrorLogs";
import { formatBrazilianDateTime } from "@/lib/date";
import { filterErrorEntries } from "@/lib/errorLogEntry";
import type { ErrorEntry, ErrorSourceFilter } from "@/lib/errorLogEntry";

const EMPTY_VALUE = "—";
const LOADING_ROWS = 6;

const formatOccurredAt = (value: string) => formatBrazilianDateTime(value, true);

function ErrorCards({ entries, onSelect }: { entries: ErrorEntry[]; onSelect: (entry: ErrorEntry) => void }) {
  return (
    <div className="space-y-3 p-4 md:hidden">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
          onClick={() => onSelect(entry)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{formatOccurredAt(entry.occurredAt)}</p>
              <p className="mt-1 truncate font-medium">{entry.message}</p>
            </div>
            <Eye className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ErrorSourceBadge source={entry.source} />
            <span>{entry.operation || EMPTY_VALUE}</span>
            {entry.entity && <span>• {entry.entity}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

function ErrorTable({ entries, onSelect }: { entries: ErrorEntry[]; onSelect: (entry: ErrorEntry) => void }) {
  return (
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
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="whitespace-nowrap text-sm">{formatOccurredAt(entry.occurredAt)}</TableCell>
              <TableCell><ErrorSourceBadge source={entry.source} /></TableCell>
              <TableCell>{entry.operation || EMPTY_VALUE}</TableCell>
              <TableCell>{entry.entity || EMPTY_VALUE}</TableCell>
              <TableCell className="max-w-64 truncate">{entry.message}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" aria-label="Ver detalhes do erro" onClick={() => onSelect(entry)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Erros() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<ErrorSourceFilter>("all");
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);

  const { data: errors, isLoading, isFetching, isError, error: queryError, refetch } = useErrorLogs();

  const filteredErrors = useMemo(
    () => filterErrorEntries(errors, search, sourceFilter),
    [errors, search, sourceFilter],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ERROR_LOGS_QUERY_KEY });
  };

  const renderContent = () => {
    if (isError && !errors) return <QueryError error={queryError} onRetry={() => void refetch()} />;
    if (isLoading) {
      return (
        <div className="space-y-3 p-6">
          {Array.from({ length: LOADING_ROWS }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
        </div>
      );
    }
    if (filteredErrors.length === 0) {
      return (
        <div className="p-12 text-center">
          <Bug className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Nenhum erro encontrado</p>
          <p className="mt-1 text-muted-foreground">Os novos erros aparecerão aqui automaticamente após atualizar.</p>
        </div>
      );
    }
    return (
      <>
        <ErrorCards entries={filteredErrors} onSelect={setSelectedError} />
        <ErrorTable entries={filteredErrors} onSelect={setSelectedError} />
      </>
    );
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
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Buscar erro, operação ou entidade..."
                aria-label="Buscar erro"
              />
            </div>
            <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as ErrorSourceFilter)}>
              <SelectTrigger aria-label="Filtrar por tipo de registro"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os registros</SelectItem>
                <SelectItem value="operacional">Operacionais</SelectItem>
                <SelectItem value="técnico">Técnicos</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">{renderContent()}</CardContent>
        </Card>
      </div>

      <ErrorDetailsDialog entry={selectedError} onClose={() => setSelectedError(null)} />
    </MainLayout>
  );
}
