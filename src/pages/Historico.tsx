import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  History,
  Calendar,
  Users,
  Droplets,
  Eye,
  Camera,
  Mic,
  Edit,
  Trash2,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CsvImportDialog } from "@/components/session/CsvImportDialog";
import { HistoryFilters } from "@/components/session/HistoryFilters";
import type { HistoryFiltersValue } from "@/components/session/HistoryFilters";
import { useQueryClient } from "@tanstack/react-query";
import { usePaginatedSessions, useDeleteSession } from "@/hooks/useSessions";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@/types/database";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBrazilianDateTime, parseDbDateToLocal } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/contexts/AuthContext";
import { useMembers } from "@/hooks/useMembers";
import { getMemberDisplayNameForValue } from "@/lib/memberDisplay";
import { exportHistoryToXlsx } from "@/lib/exportHistory";
import { getErrorMessage } from "@/lib/errorLogging";
import { toast } from "sonner";
import { QueryError } from "@/components/QueryError";

const SESSIONS_PAGE_SIZE = 25;

export default function Historico() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isEditor } = useAuthContext();
  const { data: members } = useMembers();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [filters, setFilters] = useState<HistoryFiltersValue>({
    search: "",
    // O histórico é compartilhado entre os perfis. Abrir restringindo ao ano
    // atual escondia sessões legítimas cadastradas em anos anteriores.
    year: undefined,
    month: undefined,
    types: [],
    lastMonths: undefined,
  });
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(0);
  const deleteSession = useDeleteSession();

  const sessionFilters = useMemo(() => ({
    search: filters.search,
    year: filters.lastMonths ? undefined : filters.year,
    month: filters.lastMonths || filters.year === undefined ? undefined : filters.month,
    types: filters.types.length > 0 ? filters.types : undefined,
    lastMonths: filters.lastMonths,
  }), [filters]);

  const { data: sessionPage, isLoading, error, isError, refetch } = usePaginatedSessions(
    sessionFilters,
    page,
    SESSIONS_PAGE_SIZE,
  );
  const sessions = sessionPage?.items;
  const totalSessions = sessionPage?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalSessions / SESSIONS_PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [filters]);

  // Cadastros feitos por outra conta não passam pelo cache deste navegador.
  // Atualiza a lista ativa assim que o banco recebe uma inclusão, edição ou
  // exclusão de sessão.
  useEffect(() => {
    const channel = supabase
      .channel("historico-sessoes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["sessions"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  const handleEdit = (sessionId: string) => {
    if (!isEditor) return;
    setSelectedSession(null);
    navigate(`/sessao/editar/${sessionId}`);
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

  const handleImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    queryClient.invalidateQueries({ queryKey: ["vegetais"] });
    queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
    queryClient.invalidateQueries({ queryKey: ["stock_forecast"] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
  };

  const handleExport = async () => {
    if (!isEditor || !sessions?.length) return;
    setIsExporting(true);
    try {
      await exportHistoryToXlsx(sessions);
      toast.success("Backup do histórico exportado com sucesso!");
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(`Não foi possível exportar o histórico: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Histórico de Sessões</h1>
            <p className="text-muted-foreground mt-1">
              {isError ? "Consulta indisponível" : isLoading ? "Consultando sessões..." : `${totalSessions} sessões encontradas`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isEditor && (
              <Button
                onClick={handleExport}
                variant="outline"
                className="gap-2"
                disabled={!sessions?.length || isExporting}
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Exportando..." : "Exportar página XLSX"}
              </Button>
            )}
            {isEditor && (
              <Button onClick={() => setShowImportDialog(true)} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Importar CSV
              </Button>
            )}
          </div>
        </div>

        <HistoryFilters filters={filters} setFilters={setFilters} />

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isError ? (
              <QueryError error={error} onRetry={() => void refetch()} />
            ) : isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : sessions?.length === 0 ? (
              <div className="p-12 text-center">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhuma sessão encontrada</p>
                <p className="text-muted-foreground mt-1">
                  Ajuste os filtros ou registre uma nova sessão
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="table-cell md:hidden">
                      Dirigente
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Dirigente
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Participantes
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Consumo
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions?.map((session) => (
                    <TableRow
                      key={session.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedSession(session)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {format(parseDbDateToLocal(session.date), "dd/MM", {
                              locale: ptBR,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground hidden md:block">
                            {format(parseDbDateToLocal(session.date), "EEEE", {
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {session.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="table-cell">
                        {getMemberDisplayNameForValue(session.dirigente, members)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {session.total_participants}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <Droplets className="h-4 w-4 text-primary" />
                          {session.consumption?.total_consumed?.toFixed(2) || 0} L
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSession(session);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
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

      {/* Detail Modal */}
      <Dialog
        open={!!selectedSession}
        onOpenChange={() => setSelectedSession(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedSession && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Detalhes da Sessão ({selectedSession.type})
                </DialogTitle>
                <div className="space-y-1 text-left text-sm text-muted-foreground">
                  <p>
                    Cadastrado em {formatBrazilianDateTime(selectedSession.created_at)}
                  </p>
                  {new Date(selectedSession.updated_at) > new Date(selectedSession.created_at) && (
                    <p>
                      Atualizado em {formatBrazilianDateTime(selectedSession.updated_at)}
                    </p>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm text-muted-foreground">Data</p>
                    <p className="font-medium">
                      {format(parseDbDateToLocal(selectedSession.date), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <Badge variant="secondary" className="text-base font-semibold">
                      {selectedSession.type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dirigente</p>
                    <p className="font-medium">{getMemberDisplayNameForValue(selectedSession.dirigente, members)}</p>
                  </div>
                  {selectedSession.mestre_assistente && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Mestre Assistente
                      </p>
                      <p className="font-medium">
                        {getMemberDisplayNameForValue(selectedSession.mestre_assistente, members)}
                      </p>
                    </div>
                  )}
                  {selectedSession.registered_by_name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Registrado por</p>
                      <p className="font-medium">
                        {getMemberDisplayNameForValue(selectedSession.registered_by_name, members)}
                      </p>
                    </div>
                  )}
                  {selectedSession.explanador && (
                    <div>
                      <p className="text-sm text-muted-foreground">Explanador</p>
                      <p className="font-medium">{getMemberDisplayNameForValue(selectedSession.explanador, members)}</p>
                    </div>
                  )}
                  {selectedSession.leitor && (
                    <div>
                      <p className="text-sm text-muted-foreground">Leitor</p>
                      <p className="font-medium">{getMemberDisplayNameForValue(selectedSession.leitor, members)}</p>
                    </div>
                  )}
                </div>

                {/* Participants */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Participantes</h4>
                  <div className="p-3 rounded-lg bg-primary/10 text-center">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-xl font-bold text-primary">
                      {selectedSession.total_participants}
                    </p>
                  </div>
                </div>

                {/* Consumption */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Consumo</h4>
                  <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Total consumido:
                      </span>
                      <span className="font-medium text-primary">
                        {selectedSession.consumption?.total_consumed?.toFixed(2) ||
                          0}{" "}
                        L
                      </span>
                    </div>
                    {selectedSession.consumption?.is_united && (
                      <Badge className="mt-2">Vegetal Unido</Badge>
                    )}
                    {selectedSession.consumption?.sources && selectedSession.consumption.sources.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">Vegetais utilizados:</p>
                        {selectedSession.consumption.sources.map((source, idx) => (
                          <p key={idx} className="text-sm">
                            • {source.vegetal_name} ({source.amount_available.toFixed(2)} L)
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Media */}
                <div className="flex gap-4">
                  {selectedSession.has_photo && (
                    <Badge variant="outline" className="gap-1">
                      <Camera className="h-3 w-3" />
                      Registro Fotográfico
                    </Badge>
                  )}
                  {selectedSession.has_audio && (
                    <Badge variant="outline" className="gap-1">
                      <Mic className="h-3 w-3" />
                      Registro de Áudio
                    </Badge>
                  )}
                </div>

                {selectedSession.observation && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Acontecimento na Sessão</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedSession.observation}
                    </p>
                  </div>
                )}

                {/* Actions */}
                {isEditor && (
                  <div className="pt-4 border-t flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => handleEdit(selectedSession.id)}
                    >
                      <Edit className="h-4 w-4" />
                      Editar Sessão
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full gap-2"
                      onClick={() => setSessionToDelete(selectedSession)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir Sessão
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CsvImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSuccess={handleImportSuccess}
      />

      <AlertDialog
        open={!!sessionToDelete}
        onOpenChange={(open) => !open && setSessionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A sessão
              {sessionToDelete && (
                <>
                  {" "}de{" "}
                  {format(parseDbDateToLocal(sessionToDelete.date), "dd/MM/yyyy", {
                    locale: ptBR,
                  })}{" "}
                  ({sessionToDelete.type})
                </>
              )}{" "}
              será removida permanentemente do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteSession.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSession.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
