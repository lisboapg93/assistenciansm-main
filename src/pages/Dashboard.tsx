import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplets, User, BookOpen, Mic, ArrowRight, Users, UserX } from "lucide-react";
import { useStatistics } from "@/hooks/useStatistics";
import { useSessions } from "@/hooks/useSessions";
import { useMembers } from "@/hooks/useMembers";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseDbDateToLocal } from "@/lib/date";

type ModalType = "dirigentes" | "explanadores" | "leitores" | "mestresAssistentes" | "naoExplanaram" | "naoLeram" | null;

const GRAU_FILTERS = [
  { value: "Quadro de Mestre", label: "QM" },
  { value: "Corpo do Conselho", label: "CDC" },
  { value: "Corpo Instrutivo", label: "CI" },
  { value: "Quadro de Sócios", label: "QS" },
] as const;

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: sessions } = useSessions();
  const { data: members } = useMembers();
  const stats = useStatistics(sessions);
  const [modalOpen, setModalOpen] = useState<ModalType>(null);
  const [grauFilters, setGrauFilters] = useState<string[]>([]);

  // Calculate sócios do núcleo who haven't participated
  const sociosNaoParticiparam = useMemo(() => {
    const sociosNucleo = members?.filter(m => m.is_socio_nucleo) || [];
    
    // Get all unique explanadores and leitores from sessions
    const explanadores = new Set<string>();
    const leitores = new Set<string>();
    
    sessions?.forEach(s => {
      if (s.explanador) explanadores.add(s.explanador.toLowerCase().trim());
      if (s.leitor) leitores.add(s.leitor.toLowerCase().trim());
    });

    const naoExplanaram = sociosNucleo.filter(
      m => !explanadores.has(m.name.toLowerCase().trim())
    ).sort((a, b) => a.name.localeCompare(b.name));

    const naoLeram = sociosNucleo.filter(
      m => !leitores.has(m.name.toLowerCase().trim())
    ).sort((a, b) => a.name.localeCompare(b.name));

    return { naoExplanaram, naoLeram };
  }, [members, sessions]);

  if (stats.totalStock === undefined) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40" />
          <div className="grid gap-6 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  const getModalTitle = () => {
    switch (modalOpen) {
      case "dirigentes":
        return "Dirigentes";
      case "explanadores":
        return "Explanadores";
      case "leitores":
        return "Leitores";
      case "mestresAssistentes":
        return "Mestres Assistentes";
      case "naoExplanaram":
        return "Sócios do Núcleo que não Explanaram";
      case "naoLeram":
        return "Sócios do Núcleo que não Leram";
      default:
        return "";
    }
  };

  const getModalData = () => {
    switch (modalOpen) {
      case "dirigentes":
        return stats.recentDirigentes;
      case "explanadores":
        return stats.recentExplanadores;
      case "leitores":
        return stats.recentLeitores;
      case "mestresAssistentes":
        return stats.sequenciaMestresAssistentes;
      case "naoExplanaram": {
        const filtered = grauFilters.length > 0
          ? sociosNaoParticiparam.naoExplanaram.filter(m => m.grau && grauFilters.includes(m.grau))
          : sociosNaoParticiparam.naoExplanaram;
        return filtered.map(m => ({ name: m.name, date: "", type: "", grau: m.grau }));
      }
      case "naoLeram": {
        const filtered = grauFilters.length > 0
          ? sociosNaoParticiparam.naoLeram.filter(m => m.grau && grauFilters.includes(m.grau))
          : sociosNaoParticiparam.naoLeram;
        return filtered.map(m => ({ name: m.name, date: "", type: "", grau: m.grau }));
      }
      default:
        return [];
    }
  };

  const isSimpleListModal = modalOpen === "mestresAssistentes" || modalOpen === "naoExplanaram" || modalOpen === "naoLeram";

  const formatDate = (dateStr: string) => {
    try {
      return format(parseDbDateToLocal(dateStr), "dd/MM", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do sistema de Gestão Vegetal
          </p>
        </div>

        {/* Main KPI Card - Stock */}
        <Card className="bg-gradient-to-br from-primary/20 via-primary/10 to-card border-primary/30 glow-primary">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20">
                  <Droplets className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Estoque Disponível
                  </p>
                  <p className="text-4xl md:text-5xl font-bold text-primary">
                    {stats.totalStock.toFixed(2)} L
                  </p>
                  {stats.sessionsRemaining > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ≈ {Math.floor(stats.sessionsRemaining)} sessões / {stats.monthsRemaining.toFixed(1)} meses
                    </p>
                  )}
                </div>
              </div>
              <Button 
                onClick={() => navigate("/estoque")}
                className="hidden md:flex gap-2"
              >
                Sala do Vegetal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <Button 
              onClick={() => navigate("/estoque")}
              className="w-full md:hidden mt-4 gap-2"
            >
              Sala do Vegetal
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Activity Cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Dirigentes */}
          <Card className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                Dirigentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentDirigentes.slice(0, 5).map((d, i) => (
                  <div key={`${d.name}-${i}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {i + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm truncate max-w-[120px]">{d.name}</span>
                        <span className="text-xs text-muted-foreground">{d.type}</span>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatDate(d.date)}</span>
                  </div>
                ))}
                {stats.recentDirigentes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum registro</p>
                )}
              </div>
              {stats.recentDirigentes.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={() => setModalOpen("dirigentes")}
                >
                  Ver todos
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Recent Explanadores */}
          <Card className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-primary" />
                Explanação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentExplanadores.slice(0, 5).map((d, i) => (
                  <div key={`${d.name}-${i}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {i + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm truncate max-w-[120px]">{d.name}</span>
                        <span className="text-xs text-muted-foreground">{d.type}</span>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatDate(d.date)}</span>
                  </div>
                ))}
                {stats.recentExplanadores.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum registro</p>
                )}
              </div>
              {stats.recentExplanadores.length > 0 && (
                <div className="flex flex-col gap-2 mt-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setModalOpen("explanadores")}
                  >
                    Ver todos
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setModalOpen("naoExplanaram")}
                  >
                    <UserX className="h-3 w-3 mr-1" />
                    Quem não participou
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Leitores */}
          <Card className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="h-4 w-4 text-primary" />
                Leitores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentLeitores.slice(0, 5).map((d, i) => (
                  <div key={`${d.name}-${i}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {i + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm truncate max-w-[120px]">{d.name}</span>
                        <span className="text-xs text-muted-foreground">{d.type}</span>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatDate(d.date)}</span>
                  </div>
                ))}
                {stats.recentLeitores.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum registro</p>
                )}
              </div>
              {stats.recentLeitores.length > 0 && (
                <div className="flex flex-col gap-2 mt-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setModalOpen("leitores")}
                  >
                    Ver todos
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setModalOpen("naoLeram")}
                  >
                    <UserX className="h-3 w-3 mr-1" />
                    Quem não participou
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sequência de Mestres Assistentes - por último */}
        {stats.sequenciaMestresAssistentes.length > 0 && (
          <Card className="animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                Mestres Assistentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.sequenciaMestresAssistentes.slice(0, 5).map((d, i) => (
                  <div key={`${d.name}-${i}`} className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm">{d.name}</span>
                  </div>
                ))}
              </div>
              {stats.sequenciaMestresAssistentes.length > 5 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={() => setModalOpen("mestresAssistentes")}
                >
                  Ver todos
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal for viewing all names */}
      <Dialog open={modalOpen !== null} onOpenChange={(open) => {
        if (!open) {
          setModalOpen(null);
          setGrauFilters([]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{getModalTitle()}</DialogTitle>
          </DialogHeader>
          
          {/* Grau filters for participation modals */}
          {(modalOpen === "naoExplanaram" || modalOpen === "naoLeram") && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Filtrar por grau:</p>
              <ToggleGroup
                type="multiple"
                value={grauFilters}
                onValueChange={setGrauFilters}
                className="justify-start flex-wrap gap-1"
              >
                {GRAU_FILTERS.map((grau) => (
                  <ToggleGroupItem
                    key={grau.value}
                    value={grau.value}
                    size="sm"
                    className="px-3 text-xs"
                    title={grau.value}
                  >
                    {grau.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-4">
              {getModalData().map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {i + 1}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm">{item.name}</span>
                      {!isSimpleListModal && (
                        <span className="text-xs text-muted-foreground">{item.type}</span>
                      )}
                    </div>
                  </div>
                  {!isSimpleListModal && (
                    <span className="text-sm text-muted-foreground">{formatDate(item.date)}</span>
                  )}
                </div>
              ))}
              {getModalData().length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum registro encontrado
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
