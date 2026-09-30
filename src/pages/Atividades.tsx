import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ClipboardList,
  Eye,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AuditAction,
  AuditEntityType,
  AuditLog,
  useAuditLogs,
} from "@/hooks/useAuditLogs";

const PAGE_SIZE = 25;

const actionLabels: Record<AuditAction, string> = {
  create: "Cadastro",
  update: "Edição",
  delete: "Exclusão",
};

const entityLabels: Record<AuditEntityType, string> = {
  session: "Sessão",
  vegetal: "Lote de vegetal",
  stock_movement: "Movimentação de estoque",
  members: "Membro",
};

type ActionFilter = AuditAction | "all";
type EntityFilter = AuditEntityType | "all";

interface FilterState {
  action: ActionFilter;
  entityType: EntityFilter;
  actorQuery: string;
  occurredFrom: string;
  occurredTo: string;
}

const initialFilters: FilterState = {
  action: "all",
  entityType: "all",
  actorQuery: "",
  occurredFrom: "",
  occurredTo: "",
};

function formatDateTime(value: string) {
  return format(new Date(value), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
}

function localDateBoundary(value: string, nextDay = false) {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }

  return new Date(year, month - 1, day + (nextDay ? 1 : 0)).toISOString();
}

function formatAuditData(data: Record<string, unknown> | null) {
  return data ? JSON.stringify(data, null, 2) : "—";
}

function getActorName(entry: AuditLog) {
  if (entry.actorName) return entry.actorName;
  return entry.actorId ? `Conta ${entry.actorId}` : "Operação interna";
}

function getOriginLabel(entry: AuditLog) {
  if (entry.origin === "session") return "Automática da sessão";
  if (entry.origin === "direct") return "Direta";
  return "Não identificada";
}

function AuditActionBadge({ action }: { action: AuditAction }) {
  const variant = action === "delete" ? "destructive" : action === "update" ? "secondary" : "default";
  return <Badge variant={variant}>{actionLabels[action]}</Badge>;
}

export default function Atividades() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<AuditLog | null>(null);

  const queryFilters = useMemo(() => ({
    action: filters.action === "all" ? undefined : filters.action,
    entityType: filters.entityType === "all" ? undefined : filters.entityType,
    actorQuery: filters.actorQuery,
    occurredFrom: localDateBoundary(filters.occurredFrom),
    occurredUntil: localDateBoundary(filters.occurredTo, true),
  }), [filters]);

  const { data: auditPage, isLoading, isFetching, isError, refetch } = useAuditLogs(queryFilters, page, PAGE_SIZE);
  const entries = auditPage?.items || [];
  const total = auditPage?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    if (!isLoading && !isError && auditPage && auditPage.items.length === 0 && page > 0) {
      setPage((currentPage) => Math.max(0, currentPage - 1));
    }
  }, [auditPage, isLoading, isError, page]);

  const hasFilters = filters.action !== "all"
    || filters.entityType !== "all"
    || Boolean(filters.actorQuery)
    || Boolean(filters.occurredFrom)
    || Boolean(filters.occurredTo);

  const updateFilters = (updates: Partial<FilterState>) => {
    setFilters((currentFilters) => ({ ...currentFilters, ...updates }));
    setPage(0);
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
              <ClipboardList className="h-7 w-7 text-primary" />
              Registro de atividades
            </h1>
            <p className="mt-1 text-muted-foreground">
              Cadastros, edições e exclusões feitos nos dados do sistema.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={refresh} disabled={isFetching}>
            <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Atualizar
          </Button>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1.2fr_180px_200px_150px_150px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.actorQuery}
                onChange={(event) => updateFilters({ actorQuery: event.target.value })}
                className="pl-9"
                placeholder="Buscar responsável..."
                aria-label="Buscar responsável"
              />
            </div>
            <Select value={filters.action} onValueChange={(value) => updateFilters({ action: value as ActionFilter })}>
              <SelectTrigger aria-label="Filtrar por ação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="create">Cadastros</SelectItem>
                <SelectItem value="update">Edições</SelectItem>
                <SelectItem value="delete">Exclusões</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.entityType} onValueChange={(value) => updateFilters({ entityType: value as EntityFilter })}>
              <SelectTrigger aria-label="Filtrar por tipo de item"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os itens</SelectItem>
                {Object.entries(entityLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.occurredFrom}
              onChange={(event) => updateFilters({ occurredFrom: event.target.value })}
              aria-label="Data inicial"
            />
            <Input
              type="date"
              value={filters.occurredTo}
              onChange={(event) => updateFilters({ occurredTo: event.target.value })}
              aria-label="Data final"
            />
            {hasFilters && (
              <Button variant="ghost" className="gap-2" onClick={() => updateFilters(initialFilters)}>
                <X className="h-4 w-4" />
                Limpar
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {[...Array(6)].map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
              </div>
            ) : isError ? (
              <div className="p-12 text-center">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
                <p className="text-lg font-medium">Não foi possível carregar as atividades</p>
                <p className="mt-1 text-muted-foreground">Verifique sua conexão e tente novamente.</p>
                <Button variant="outline" className="mt-4" onClick={() => void refetch()} disabled={isFetching}>
                  Tentar novamente
                </Button>
              </div>
            ) : entries.length === 0 ? (
              <div className="p-12 text-center">
                <ClipboardList className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">Nenhuma atividade encontrada</p>
                <p className="mt-1 text-muted-foreground">
                  As próximas alterações nos dados aparecerão após atualizar.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 p-4 md:hidden">
                  {entries.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">{formatDateTime(entry.occurredAt)}</p>
                          <p className="mt-1 font-medium">{entityLabels[entry.entityType]}</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{getActorName(entry)}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{getOriginLabel(entry)}</p>
                        </div>
                        <Eye className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-3"><AuditActionBadge action={entry.action} /></div>
                    </button>
                  ))}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data e hora</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="w-[52px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap text-sm">{formatDateTime(entry.occurredAt)}</TableCell>
                          <TableCell className="max-w-56 truncate">{getActorName(entry)}</TableCell>
                          <TableCell><AuditActionBadge action={entry.action} /></TableCell>
                          <TableCell>{entityLabels[entry.entityType]}</TableCell>
                          <TableCell>{getOriginLabel(entry)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" aria-label="Ver detalhes da atividade" onClick={() => setSelectedEntry(entry)}>
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

        {totalPages > 1 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((currentPage) => currentPage - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((currentPage) => currentPage + 1)}>
                Próxima
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {selectedEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Detalhes da atividade
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
                  <p><span className="text-muted-foreground">Data e hora:</span><br />{formatDateTime(selectedEntry.occurredAt)}</p>
                  <p><span className="text-muted-foreground">Responsável:</span><br />{getActorName(selectedEntry)}</p>
                  <p><span className="text-muted-foreground">Ação:</span><br />{actionLabels[selectedEntry.action]}</p>
                  <p><span className="text-muted-foreground">Item:</span><br />{entityLabels[selectedEntry.entityType]}</p>
                  <p><span className="text-muted-foreground">Origem:</span><br />{getOriginLabel(selectedEntry)}</p>
                  {selectedEntry.actorId && (
                    <p className="break-all"><span className="text-muted-foreground">ID da conta:</span><br />{selectedEntry.actorId}</p>
                  )}
                  {selectedEntry.relatedSessionId && (
                    <p className="sm:col-span-2 break-all"><span className="text-muted-foreground">Sessão relacionada:</span><br />{selectedEntry.relatedSessionId}</p>
                  )}
                  <p className="sm:col-span-2 break-all"><span className="text-muted-foreground">Identificação:</span><br />{selectedEntry.entityId}</p>
                </div>

                {selectedEntry.oldData && (
                  <div>
                    <p className="mb-1 font-medium">Dados antes da alteração</p>
                    <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{formatAuditData(selectedEntry.oldData)}</pre>
                  </div>
                )}
                {selectedEntry.newData && (
                  <div>
                    <p className="mb-1 font-medium">
                      {selectedEntry.action === "create" ? "Dados cadastrados" : "Dados após a alteração"}
                    </p>
                    <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{formatAuditData(selectedEntry.newData)}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
