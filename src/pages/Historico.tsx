import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { History, Upload, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { CsvImportDialog } from "@/components/session/CsvImportDialog";
import { DeleteSessionDialog } from "@/components/session/DeleteSessionDialog";
import { HistoryFilters } from "@/components/session/HistoryFilters";
import type { HistoryFiltersValue } from "@/components/session/HistoryFilters";
import { SessionDetailsDialog } from "@/components/session/SessionDetailsDialog";
import { SessionHistoryTable } from "@/components/session/SessionHistoryTable";
import { usePaginatedSessions, useDeleteSession, useSessionChangesSubscription } from "@/hooks/useSessions";
import type { SessionFilters } from "@/hooks/useSessions";
import type { Session } from "@/types/database";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthContext } from "@/hooks/useAuthContext";
import { useMembers } from "@/hooks/useMembers";
import { exportHistoryToXlsx } from "@/lib/exportHistory";
import { getErrorMessage } from "@/lib/errorLogging";
import { toast } from "sonner";
import { QueryError } from "@/components/QueryError";

const SESSIONS_PAGE_SIZE = 25;
const LOADING_ROW_COUNT = 5;

// O histórico é compartilhado entre os perfis. Abrir restringindo ao ano
// atual escondia sessões legítimas cadastradas em anos anteriores.
const INITIAL_FILTERS: HistoryFiltersValue = {
  search: "",
  year: undefined,
  month: undefined,
  types: [],
  lastMonths: undefined,
};

/** O período relativo tem prioridade e o mês só vale com um ano explícito. */
function toSessionFilters(filters: HistoryFiltersValue): SessionFilters {
  return {
    search: filters.search,
    year: filters.lastMonths ? undefined : filters.year,
    month: filters.lastMonths || filters.year === undefined ? undefined : filters.month,
    types: filters.types.length > 0 ? filters.types : undefined,
    lastMonths: filters.lastMonths,
  };
}

export default function Historico() {
  const navigate = useNavigate();
  const { isEditor } = useAuthContext();
  const { data: members } = useMembers();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [filters, setFilters] = useState<HistoryFiltersValue>(INITIAL_FILTERS);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(0);
  const deleteSession = useDeleteSession();

  useSessionChangesSubscription("historico-sessoes");

  const sessionFilters = useMemo(() => toSessionFilters(filters), [filters]);
  const { data: sessionPage, isLoading, error, isError, refetch } = usePaginatedSessions(
    sessionFilters,
    page,
    SESSIONS_PAGE_SIZE,
  );
  const sessions = sessionPage?.items;
  const totalSessions = sessionPage?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalSessions / SESSIONS_PAGE_SIZE));

  // Volta à primeira página no mesmo render da troca de filtro, sem buscar
  // antes a página antiga com os filtros novos.
  const handleFiltersChange = (nextFilters: HistoryFiltersValue) => {
    setFilters(nextFilters);
    setPage(0);
  };

  // Deletar o único item de uma página (ex.: a última página) reduz
  // totalPages sem que `page` acompanhe, deixando a tabela "vazia" com dados
  // restantes só na página anterior. Corrige o índice quando ele fica fora
  // do intervalo válido após o total encolher. Só roda com `!isLoading`:
  // enquanto uma página nunca buscada antes ainda carrega, sessionPage é
  // undefined e totalPages cai para 1 momentaneamente, o que faria isso
  // "clampar" de volta pra página 0 a cada avanço de página normal.
  useEffect(() => {
    if (!isLoading && !isError && page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [isLoading, isError, page, totalPages]);

  const handleEdit = (session: Session) => {
    if (!isEditor) return;
    setSelectedSession(null);
    navigate(`/sessao/editar/${session.id}`);
  };

  const handleConfirmDelete = async () => {
    if (!isEditor || !sessionToDelete) return;
    try {
      await deleteSession.mutateAsync(sessionToDelete.id);
      setSessionToDelete(null);
      setSelectedSession(null);
    } catch {
      // A mutação já registra o erro e exibe a mensagem ao usuário.
    }
  };

  const handleExport = async () => {
    if (!isEditor || !sessions?.length) return;
    setIsExporting(true);
    try {
      await exportHistoryToXlsx(sessions);
      toast.success("Backup do histórico exportado com sucesso!");
    } catch (error) {
      toast.error(`Não foi possível exportar o histórico: ${getErrorMessage(error)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const renderSessions = () => {
    if (isError) return <QueryError error={error} onRetry={() => void refetch()} />;

    if (isLoading) {
      return (
        <div className="p-6 space-y-4">
          {Array.from({ length: LOADING_ROW_COUNT }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      );
    }

    if (!sessions?.length) {
      return (
        <div className="p-12 text-center">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium">Nenhuma sessão encontrada</p>
          <p className="text-muted-foreground mt-1">
            Ajuste os filtros ou registre uma nova sessão
          </p>
        </div>
      );
    }

    return <SessionHistoryTable sessions={sessions} members={members} onSelect={setSelectedSession} />;
  };

  const summary = isError
    ? "Consulta indisponível"
    : isLoading ? "Consultando sessões..." : `${totalSessions} sessões encontradas`;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Histórico de Sessões</h1>
            <p className="text-muted-foreground mt-1">{summary}</p>
          </div>
          {isEditor && (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleExport}
                variant="outline"
                className="gap-2"
                disabled={!sessions?.length || isExporting}
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Exportando..." : "Exportar página XLSX"}
              </Button>
              <Button onClick={() => setShowImportDialog(true)} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Importar CSV
              </Button>
            </div>
          )}
        </div>

        <HistoryFilters filters={filters} onChange={handleFiltersChange} />

        <Card>
          <CardContent className="p-0">{renderSessions()}</CardContent>
        </Card>

        {totalSessions > SESSIONS_PAGE_SIZE && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((currentPage) => Math.min(totalPages - 1, currentPage + 1))}
              >
                Próxima
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <SessionDetailsDialog
        session={selectedSession}
        members={members}
        canEdit={isEditor}
        onClose={() => setSelectedSession(null)}
        onEdit={handleEdit}
        onDelete={setSessionToDelete}
      />

      <CsvImportDialog open={showImportDialog} onOpenChange={setShowImportDialog} />

      <DeleteSessionDialog
        session={sessionToDelete}
        isDeleting={deleteSession.isPending}
        onCancel={() => setSessionToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </MainLayout>
  );
}
