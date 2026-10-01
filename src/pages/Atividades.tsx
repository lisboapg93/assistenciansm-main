import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Eye,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
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
  brazilianDateBoundaryIso,
  formatBrazilianDateTime,
  subtractMonthsFromIsoDate,
  todayBrazilianIsoDate,
} from "@/lib/date";
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
type AuditData = Record<string, unknown>;
type AuditChange = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

const auditTechnicalFields = new Set(["id", "created_at", "updated_at"]);

const auditFieldLabels: Record<string, string> = {
  id: "Identificação",
  name: "Nome",
  grau: "Grau",
  is_socio_nucleo: "Sócio do Núcleo",
  date: "Data",
  type: "Tipo",
  quantity: "Quantidade",
  initial_quantity: "Quantidade inicial",
  envase_date: "Data de envase",
  master: "Mestre responsável",
  auxiliary: "Auxiliar",
  mariri_species: "Espécie de mariri",
  chacrona_species: "Espécie de chacrona",
  is_archived: "Arquivado",
  registered_by_name: "Cadastrado por",
  mensageiro: "Mensageiro",
  responsavel_chacrona: "Responsável pela chacrona",
  responsavel_baticao: "Responsável pela batição",
  dirigente: "Dirigente",
  explanador: "Explanador",
  leitor: "Leitor",
  mestre_assistente: "Mestre assistente",
  observation: "Observação",
  participants: "Participantes",
  total_participants: "Total de participantes",
  consumption: "Consumo",
  total_consumed: "Total consumido",
  is_united: "União de vegetal",
  sources: "Fontes",
  vegetal_id: "Lote de vegetal",
  vegetal_name: "Nome do vegetal",
  amount_available: "Quantidade disponível",
  has_photo: "Possui foto",
  has_audio: "Possui áudio",
  session_id: "Sessão relacionada",
  details: "Detalhes",
  created_at: "Cadastrado em",
  updated_at: "Atualizado em",
  mestres: "Mestres",
  conselheiros: "Conselheiros",
  instrutivo: "Instrutivo",
  socios: "Sócios",
  visitantes: "Visitantes",
  jovens: "Jovens",
};

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
    occurredFrom: subtractMonthsFromIsoDate(occurredTo, 3),
    occurredTo,
  };
}

function getAuditFieldLabel(field: string) {
  if (auditFieldLabels[field]) return auditFieldLabels[field];

  return field
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function isAuditData(value: unknown): value is AuditData {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function areAuditValuesEqual(firstValue: unknown, secondValue: unknown): boolean {
  if (Object.is(firstValue, secondValue)) return true;

  if (Array.isArray(firstValue) && Array.isArray(secondValue)) {
    return firstValue.length === secondValue.length
      && firstValue.every((value, index) => areAuditValuesEqual(value, secondValue[index]));
  }

  if (isAuditData(firstValue) && isAuditData(secondValue)) {
    const firstKeys = Object.keys(firstValue);
    const secondKeys = Object.keys(secondValue);

    return firstKeys.length === secondKeys.length
      && firstKeys.every((key) => (
        Object.prototype.hasOwnProperty.call(secondValue, key)
        && areAuditValuesEqual(firstValue[key], secondValue[key])
      ));
  }

  return false;
}

function getAuditChanges(oldData: AuditData, newData: AuditData): AuditChange[] {
  const fields = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  return [...fields]
    .filter((field) => !auditTechnicalFields.has(field))
    .filter((field) => !areAuditValuesEqual(oldData[field], newData[field]))
    .map((field) => ({
      field,
      oldValue: oldData[field],
      newValue: newData[field],
    }));
}

function AuditValue({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">Não informado</span>;
  }

  if (typeof value === "boolean") return <>{value ? "Sim" : "Não"}</>;
  if (typeof value === "number") return <>{value.toLocaleString("pt-BR")}</>;

  if (typeof value === "string") {
    if (field.endsWith("_at")) return <>{formatBrazilianDateTime(value)}</>;
    if (field === "date" || field.endsWith("_date")) return <>{formatCalendarDate(value)}</>;
    return <>{value}</>;
  }

  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={`${field}-${index}`} className="rounded border bg-background p-2">
            {isAuditData(item) ? <AuditDataDetails data={item} /> : <AuditValue field={field} value={item} />}
          </li>
        ))}
      </ul>
    );
  }

  if (isAuditData(value)) return <AuditDataDetails data={value} />;

  return <>{String(value)}</>;
}

function AuditDataDetails({ data }: { data: AuditData }) {
  return (
    <dl className="divide-y rounded-lg border bg-background">
      {Object.entries(data).map(([field, value]) => (
        <div key={field} className="grid gap-1 p-3 sm:grid-cols-[180px_1fr] sm:gap-3">
          <dt className="text-muted-foreground">{getAuditFieldLabel(field)}</dt>
          <dd className="break-words"><AuditValue field={field} value={value} /></dd>
        </div>
      ))}
    </dl>
  );
}

function AuditChangesDetails({ oldData, newData }: { oldData: AuditData; newData: AuditData }) {
  const changes = getAuditChanges(oldData, newData);

  if (changes.length === 0) {
    return <p className="rounded-lg border bg-muted/50 p-3 text-muted-foreground">Nenhuma alteração de dado identificada.</p>;
  }

  return (
    <dl className="divide-y rounded-lg border bg-background">
      {changes.map(({ field, oldValue, newValue }) => (
        <div key={field} className="grid gap-2 p-3 sm:grid-cols-[180px_1fr] sm:gap-3">
          <dt className="text-muted-foreground">{getAuditFieldLabel(field)}</dt>
          <dd className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="break-words">
              <span className="text-xs text-muted-foreground">Antes</span>
              <div><AuditValue field={field} value={oldValue} /></div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-label="alterado para" />
            <div className="break-words">
              <span className="text-xs text-muted-foreground">Depois</span>
              <div><AuditValue field={field} value={newValue} /></div>
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
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
  const [initialFilters] = useState(getInitialFilters);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<AuditLog | null>(null);

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

  useEffect(() => {
    if (!isLoading && !isError && auditPage && auditPage.items.length === 0 && page > 0) {
      setPage((currentPage) => Math.max(0, currentPage - 1));
    }
  }, [auditPage, isLoading, isError, page]);

  const hasFilters = filters.action !== "all"
    || filters.entityType !== "all"
    || Boolean(filters.actorQuery)
    || filters.occurredFrom !== initialFilters.occurredFrom
    || filters.occurredTo !== initialFilters.occurredTo;

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
                Últimos 3 meses
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
                          <p className="text-sm text-muted-foreground">{formatBrazilianDateTime(entry.occurredAt)}</p>
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
                          <TableCell className="whitespace-nowrap text-sm">{formatBrazilianDateTime(entry.occurredAt)}</TableCell>
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
                  <p><span className="text-muted-foreground">Data e hora:</span><br />{formatBrazilianDateTime(selectedEntry.occurredAt)}</p>
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

                {selectedEntry.action === "update" && selectedEntry.oldData && selectedEntry.newData ? (
                  <div>
                    <p className="mb-1 font-medium">Alterações realizadas</p>
                    <AuditChangesDetails oldData={selectedEntry.oldData} newData={selectedEntry.newData} />
                  </div>
                ) : selectedEntry.action === "delete" && selectedEntry.oldData ? (
                  <div>
                    <p className="mb-1 font-medium">Dados excluídos</p>
                    <AuditDataDetails data={selectedEntry.oldData} />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
