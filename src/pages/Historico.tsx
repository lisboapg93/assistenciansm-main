import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  History,
  Search,
  Calendar,
  Users,
  Droplets,
  Eye,
  Camera,
  Mic,
  Edit,
  Upload,
  Download,
  ChevronDown,
} from "lucide-react";
import { CsvImportDialog } from "@/components/session/CsvImportDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useSessions } from "@/hooks/useSessions";
import { Session, SESSION_TYPES, PARTICIPANT_LABELS } from "@/types/database";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDbDateToLocal } from "@/lib/date";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/contexts/AuthContext";
import { exportHistoryToXlsx } from "@/lib/exportHistory";
import { toast } from "sonner";

const MONTHS = [
  { value: "0", label: "Janeiro" },
  { value: "1", label: "Fevereiro" },
  { value: "2", label: "Março" },
  { value: "3", label: "Abril" },
  { value: "4", label: "Maio" },
  { value: "5", label: "Junho" },
  { value: "6", label: "Julho" },
  { value: "7", label: "Agosto" },
  { value: "8", label: "Setembro" },
  { value: "9", label: "Outubro" },
  { value: "10", label: "Novembro" },
  { value: "11", label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2024 }, (_, i) => currentYear - i);

const LAST_MONTHS_OPTIONS = [
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "9", label: "Últimos 9 meses" },
  { value: "12", label: "Últimos 12 meses" },
];

export default function Historico() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isEditor } = useAuthContext();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [filters, setFilters] = useState({
    search: "",
    year: currentYear as number | undefined,
    month: undefined as number | undefined,
    types: [] as string[],
    lastMonths: undefined as number | undefined,
  });
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { data: sessions, isLoading } = useSessions({
    search: filters.search,
    year: filters.lastMonths ? undefined : filters.year,
    month: filters.lastMonths ? undefined : filters.month,
    types: filters.types.length > 0 ? filters.types : undefined,
    lastMonths: filters.lastMonths,
  });

  const handleEdit = (sessionId: string) => {
    // For now, just close the modal - edit functionality can be added later
    setSelectedSession(null);
    navigate(`/sessao/editar/${sessionId}`);
  };

  const handleImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  const handleExport = async () => {
    if (!sessions?.length) return;
    setIsExporting(true);
    try {
      await exportHistoryToXlsx(sessions);
      toast.success("Backup do histórico exportado com sucesso!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
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
              {sessions?.length || 0} sessões encontradas
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleExport}
              variant="outline"
              className="gap-2"
              disabled={!sessions?.length || isExporting}
            >
              <Download className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar XLSX"}
            </Button>
            {isEditor && (
              <Button onClick={() => setShowImportDialog(true)} variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Importar CSV
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="relative md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  className="pl-10"
                />
              </div>

              {/* Período (últimos meses) */}
              <Select
                value={filters.lastMonths?.toString() || "none"}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    lastMonths: value === "none" ? undefined : parseInt(value),
                    year: value === "none" ? currentYear : undefined,
                    month: value === "none" ? undefined : filters.month,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Por ano/mês</SelectItem>
                  {LAST_MONTHS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Ano - desabilitado quando período está selecionado */}
              <Select
                value={filters.year?.toString() || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, year: value === "all" ? undefined : parseInt(value) })
                }
                disabled={!!filters.lastMonths}
              >
                <SelectTrigger className={filters.lastMonths ? "opacity-50" : ""}>
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Mês - desabilitado quando período está selecionado */}
              <Select
                value={filters.month?.toString() || "all"}
                onValueChange={(value) =>
                  setFilters({
                    ...filters,
                    month: value === "all" ? undefined : parseInt(value),
                  })
                }
                disabled={!!filters.lastMonths}
              >
                <SelectTrigger className={filters.lastMonths ? "opacity-50" : ""}>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Tipos de Sessão - Multi-select */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between w-full">
                    <span className="truncate">
                      {filters.types.length === 0
                        ? "Todos os tipos"
                        : filters.types.length === 1
                        ? filters.types[0]
                        : `${filters.types.length} tipos`}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-muted-foreground"
                      onClick={() => setFilters({ ...filters, types: [] })}
                    >
                      Limpar seleção
                    </Button>
                    <div className="border-t pt-2 space-y-1">
                      {SESSION_TYPES.map((type) => (
                        <label
                          key={type}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={filters.types.includes(type)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilters({
                                  ...filters,
                                  types: [...filters.types, type],
                                });
                              } else {
                                setFilters({
                                  ...filters,
                                  types: filters.types.filter((t) => t !== type),
                                });
                              }
                            }}
                          />
                          <span className="text-sm">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
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
                        {session.dirigente}
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
                  Detalhes da Sessão
                </DialogTitle>
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
                    <Badge variant="secondary">{selectedSession.type}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dirigente</p>
                    <p className="font-medium">{selectedSession.dirigente}</p>
                  </div>
                  {selectedSession.mestre_assistente && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Mestre Assistente
                      </p>
                      <p className="font-medium">
                        {selectedSession.mestre_assistente}
                      </p>
                    </div>
                  )}
                  {selectedSession.explanador && (
                    <div>
                      <p className="text-sm text-muted-foreground">Explanador</p>
                      <p className="font-medium">{selectedSession.explanador}</p>
                    </div>
                  )}
                  {selectedSession.leitor && (
                    <div>
                      <p className="text-sm text-muted-foreground">Leitor</p>
                      <p className="font-medium">{selectedSession.leitor}</p>
                    </div>
                  )}
                </div>

                {/* Participants */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Participantes</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(selectedSession.participants).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="p-2 rounded-lg bg-muted/50 text-center"
                        >
                          <p className="text-xs text-muted-foreground">
                            {PARTICIPANT_LABELS[key as keyof typeof PARTICIPANT_LABELS] || key}
                          </p>
                          <p className="font-medium">{value}</p>
                        </div>
                      )
                    )}
                  </div>
                  <div className="mt-2 p-3 rounded-lg bg-primary/10 text-center">
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

                {/* Content */}
                {selectedSession.chamadas && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Chamadas</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedSession.chamadas}
                    </p>
                  </div>
                )}
                {selectedSession.historias && (
                  <div>
                    <h4 className="text-sm font-medium mb-1">Histórias</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedSession.historias}
                    </p>
                  </div>
                )}
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
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => handleEdit(selectedSession.id)}
                    >
                      <Edit className="h-4 w-4" />
                      Editar Sessão
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
    </MainLayout>
  );
}
