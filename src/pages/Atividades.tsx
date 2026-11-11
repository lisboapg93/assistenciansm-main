import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { AuditActionBadge } from "@/components/activity/AuditActionBadge";
import { AuditEntryDialog } from "@/components/activity/AuditEntryDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  brazilianDateBoundaryIso,
  formatBrazilianDateTime,
  subtractMonthsFromIsoDate,
  todayBrazilianIsoDate,
} from "@/lib/date";
import {
  AUDIT_ACTION_FILTER_LABELS,
  AUDIT_ENTITY_LABELS,
  getAuditActorName,
  getAuditOriginLabel,
} from "@/lib/auditLabels";
import { AUDIT_LOGS_QUERY_KEY, useAuditLogs } from "@/hooks/useAuditLogs";
import type { AuditAction, AuditEntityType, AuditLog } from "@/hooks/useAuditLogs";

const PAGE_SIZE = 25;
const DEFAULT_PERIOD_MONTHS = 3;
const ACTOR_SEARCH_DEBOUNCE_MS = 300;
const LOADING_ROWS = 6;

type ActionFilter = AuditAction | "all";
type EntityFilter = AuditEntityType | "all";
interface FilterState {
  action: ActionFilter;
  entityType: EntityFilter;
  actorQuery: string;
  occurredFrom: string;
  occurredTo: string;
}

function getInitialFilters(): FilterState {
  const occurredTo = todayBrazilianIsoDate();

  return {
    action: "all",
    entityType: "all",
    actorQuery: "",
    occurredFrom: subtractMonthsFromIsoDate(occurredTo, DEFAULT_PERIOD_MONTHS),
    occurredTo,
  };
}

function AuditCards({ entries, onSelect }: { entries: AuditLog[]; onSelect: (entry: AuditLog) => void }) {
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
              <p className="text-sm text-muted-foreground">{formatBrazilianDateTime(entry.occurredAt)}</p>
              <p className="mt-1 font-medium">{AUDIT_ENTITY_LABELS[entry.entityType]}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{getAuditActorName(entry)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{getAuditOriginLabel(entry)}</p>
            </div>
            <Eye className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
          <div className="mt-3"><AuditActionBadge action={entry.action} /></div>
        </button>
      ))}
    </div>
  );
}

function AuditTable({ entries, onSelect }: { entries: AuditLog[]; onSelect: (entry: AuditLog) => void }) {
  return (
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
              <TableCell className="whitespace-nowrap text-sm">{formatBrazilianDateTime(entry.occurredAt)}</TableCell>
              <TableCell className="max-w-56 truncate">{getAuditActorName(entry)}</TableCell>
              <TableCell><AuditActionBadge action={entry.action} /></TableCell>
              <TableCell>{AUDIT_ENTITY_LABELS[entry.entityType]}</TableCell>
              <TableCell>{getAuditOriginLabel(entry)}</TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" aria-label="Ver detalhes da atividade" onClick={() => onSelect(entry)}>
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

export default function Atividades() {
  const queryClient = useQueryClient();
  const [initialFilters] = useState(getInitialFilters);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [actorInput, setActorInput] = useState(initialFilters.actorQuery);
  const [page, setPage] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<AuditLog | null>(null);

  const updateFilters = (updates: Partial<FilterState>) => {
    setFilters((currentFilters) => ({ ...currentFilters, ...updates }));
    setPage(0);
  };

  // Evita uma consulta ao banco a cada tecla digitada na busca por responsável.
  useEffect(() => {
    if (actorInput === filters.actorQuery) return;
    const timeout = window.setTimeout(() => {
      setFilters((currentFilters) => ({ ...currentFilters, actorQuery: actorInput }));
      setPage(0);
    }, ACTOR_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [actorInput, filters.actorQuery]);

  const queryFilters = useMemo(() => ({
    action: filters.action === "all" ? undefined : filters.action,
    entityType: filters.entityType === "all" ? undefined : filters.entityType,
    actorQuery: filters.actorQuery,
    occurredFrom: brazilianDateBoundaryIso(filters.occurredFrom),
    occurredUntil: brazilianDateBoundaryIso(filters.occurredTo, true),
  }), [filters]);

  const { data: auditPage, isLoading, isFetching, isError, refetch } = useAuditLogs(queryFilters, page, PAGE_SIZE);
  const entries = auditPage?.items || [];
  const total = auditPage?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Volta uma página quando a atual ficou vazia (ex.: registros removidos).
  useEffect(() => {
    if (!isLoading && !isError && auditPage && auditPage.items.length === 0 && page > 0) {
      setPage((currentPage) => Math.max(0, currentPage - 1));
    }
  }, [auditPage, isLoading, isError, page]);

  const hasFilters = filters.action !== "all"
    || filters.entityType !== "all"
    || Boolean(actorInput)
    || filters.occurredFrom !== initialFilters.occurredFrom
    || filters.occurredTo !== initialFilters.occurredTo;

  const resetFilters = () => {
    setActorInput(initialFilters.actorQuery);
    updateFilters(initialFilters);
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: AUDIT_LOGS_QUERY_KEY });
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-3 p-6">
          {Array.from({ length: LOADING_ROWS }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}
        </div>
      );
    }
    if (isError) {
      return (
        <div className="p-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">Não foi possível carregar as atividades</p>
          <p className="mt-1 text-muted-foreground">Verifique sua conexão e tente novamente.</p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()} disabled={isFetching}>
            Tentar novamente
          </Button>
        </div>
      );
    }
    if (entries.length === 0) {
      return (
        <div className="p-12 text-center">
          <ClipboardList className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Nenhuma atividade encontrada</p>
          <p className="mt-1 text-muted-foreground">
            As próximas alterações nos dados aparecerão após atualizar.
          </p>
        </div>
      );
    }
    return (
      <>
        <AuditCards entries={entries} onSelect={setSelectedEntry} />
        <AuditTable entries={entries} onSelect={setSelectedEntry} />
      </>
    );
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
                value={actorInput}
                onChange={(event) => setActorInput(event.target.value)}
                className="pl-9"
                placeholder="Buscar responsável..."
                aria-label="Buscar responsável"
              />
            </div>
            <Select value={filters.action} onValueChange={(value) => updateFilters({ action: value as ActionFilter })}>
              <SelectTrigger aria-label="Filtrar por ação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {Object.entries(AUDIT_ACTION_FILTER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.entityType} onValueChange={(value) => updateFilters({ entityType: value as EntityFilter })}>
              <SelectTrigger aria-label="Filtrar por tipo de item"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os itens</SelectItem>
                {Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.occurredFrom}
              onChange={(event) => updateFilters({ occurredFrom: event.target.value })}
              className="min-w-0 max-w-full"
              aria-label="Data inicial"
            />
            <Input
              type="date"
              value={filters.occurredTo}
              onChange={(event) => updateFilters({ occurredTo: event.target.value })}
              className="min-w-0 max-w-full"
              aria-label="Data final"
            />
            {hasFilters && (
              <Button variant="ghost" className="gap-2" onClick={resetFilters}>
                <X className="h-4 w-4" />
                Últimos {DEFAULT_PERIOD_MONTHS} meses
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">{renderContent()}</CardContent>
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

      <AuditEntryDialog entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </MainLayout>
  );
}
