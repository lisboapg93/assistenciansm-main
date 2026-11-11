import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Droplets, Search } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/QueryError";
import { StockSummaryCard } from "@/components/vegetal/StockSummaryCard";
import { VegetalDetailModal } from "@/components/vegetal/VegetalDetailModal";
import { VegetalTable } from "@/components/vegetal/VegetalTable";
import { useAuthContext } from "@/hooks/useAuthContext";
import { useMembers } from "@/hooks/useMembers";
import { useSessions } from "@/hooks/useSessions";
import { useStatistics } from "@/hooks/useStatistics";
import { useVegetais, useStockForecast } from "@/hooks/useVegetais";
import { getStockForecastLabels } from "@/lib/stockForecast";
import { filterVegetaisBySearch } from "@/lib/stockLots";
import { formatLiters, getTotalStock } from "@/lib/stockQuantity";
import { Vegetal } from "@/types/database";

const SKELETON_ROW_COUNT = 5;

export default function Estoque() {
  const { isEditor, isAssistant } = useAuthContext();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedVegetal, setSelectedVegetal] = useState<Vegetal | null>(null);

  const vegetalQuery = useVegetais(showArchived);
  const stockQuery = useVegetais();
  // Assistentes não leem o histórico de sessões; a previsão deles vem do RPC.
  const sessionQuery = useSessions(undefined, !isAssistant);
  const memberQuery = useMembers();
  const { data: vegetais, isLoading } = vegetalQuery;
  const { data: sessions } = sessionQuery;
  const { data: members } = memberQuery;
  const stats = useStatistics(isAssistant ? undefined : sessions, undefined, members);
  const forecastQuery = useStockForecast(isAssistant);

  const assistantForecast = forecastQuery.data;
  const { forecast: forecastLabel, duration: durationLabel } = getStockForecastLabels(isAssistant
    ? {
      isLoading: !assistantForecast && !forecastQuery.isError,
      isUnavailable: !assistantForecast && forecastQuery.isError,
      hasSessionHistory: true,
      sessionsRemaining: Number(assistantForecast?.sessions_remaining || 0),
      monthsRemaining: Number(assistantForecast?.months_remaining || 0),
    }
    : {
      isLoading: sessionQuery.isLoading,
      isUnavailable: false,
      hasSessionHistory: Boolean(sessions?.length),
      sessionsRemaining: stats.sessionsRemaining,
      monthsRemaining: stats.monthsRemaining,
    });
  const totalStockLabel = stockQuery.isLoading ? "Carregando..." : formatLiters(getTotalStock(stockQuery.data));

  const filteredVegetais = filterVegetaisBySearch(vegetais, search, members);
  // Prefere a versão mais recente do lote (após saída/ajuste) à cópia selecionada.
  const detailVegetal = vegetais?.find((lot) => lot.id === selectedVegetal?.id) || selectedVegetal;

  const queries = [vegetalQuery, stockQuery, memberQuery, ...(!isAssistant ? [sessionQuery] : [])];
  const failedQuery = queries.find((query) => query.isError && query.data === undefined);
  if (failedQuery) return <MainLayout><QueryError error={failedQuery.error} onRetry={() => {
    queries.forEach((query) => { void query.refetch(); });
  }} /></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Sala do Vegetal</h1>
            <p className="text-muted-foreground mt-1">
              Gerenciamento de estoque e lotes
            </p>
          </div>
          {isEditor && (
            <Button asChild className="gap-2">
              <Link to="/estoque/novo">
                <Plus className="h-4 w-4" />
                Nova Entrada
              </Link>
            </Button>
          )}
        </div>

        <StockSummaryCard
          totalStockLabel={totalStockLabel}
          forecastLabel={forecastLabel}
          durationLabel={durationLabel}
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou mestre..."
              aria-label="Buscar por nome ou mestre"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-sm">
              Mostrar zerados
            </Label>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !filteredVegetais?.length ? (
              <div className="p-12 text-center">
                <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhum vegetal encontrado</p>
                <p className="text-muted-foreground mt-1">
                  {search.trim()
                    ? "Tente buscar por outro nome ou mestre"
                    : isEditor ? "Cadastre um novo lote para começar" : "Nenhum lote disponível no momento"}
                </p>
              </div>
            ) : (
              <VegetalTable vegetais={filteredVegetais} members={members} onSelect={setSelectedVegetal} />
            )}
          </CardContent>
        </Card>
      </div>

      <VegetalDetailModal
        key={selectedVegetal?.id ?? "closed"}
        vegetal={detailVegetal}
        members={members}
        open={!!selectedVegetal}
        onClose={() => setSelectedVegetal(null)}
      />
    </MainLayout>
  );
}
