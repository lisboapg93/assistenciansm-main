import { useMemo, useState } from "react";
import { BookOpen, Mic, User } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/QueryError";
import { ReportKpis } from "@/components/reports/ReportKpis";
import {
  MovementsByTypeChart,
  SessionsByTypeChart,
  StockEvolutionChart,
} from "@/components/reports/ReportCharts";
import { AssistanceReportTable, StockEvolutionTable } from "@/components/reports/ReportTables";
import { RankingCard } from "@/components/reports/RankingCard";
import { useSessions } from "@/hooks/useSessions";
import { useStatistics } from "@/hooks/useStatistics";
import { useVegetais } from "@/hooks/useVegetais";
import { useStockMovements } from "@/hooks/useStockMovements";
import { useMembers } from "@/hooks/useMembers";
import {
  getAssistanceReport,
  getAssistantNames,
  getConsumptionBySessionId,
  getCurrentBrazilianYear,
  getReportYears,
} from "@/lib/reports";
import { getMovementsByType, getStockEvolution } from "@/lib/stockReports";

const KPI_SKELETON_COUNT = 4;

function ReportsSkeleton() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: KPI_SKELETON_COUNT }, (_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}

export default function Relatorios() {
  const [currentYear] = useState(getCurrentBrazilianYear);
  const years = useMemo(() => getReportYears(currentYear), [currentYear]);
  const [year, setYear] = useState(currentYear);
  const [averageType, setAverageType] = useState("");
  const [assistantFilter, setAssistantFilter] = useState("");

  const changeYear = (value: string) => {
    setYear(Number(value));
    // O mestre assistente selecionado pode não existir nas sessões do novo ano.
    setAssistantFilter("");
  };

  const sessionQuery = useSessions({ year });
  const memberQuery = useMembers();
  const vegetalQuery = useVegetais();
  const movementQuery = useStockMovements();
  const { data: sessions } = sessionQuery;
  const { data: members } = memberQuery;
  const { data: movements } = movementQuery;

  const stats = useStatistics(sessions, undefined, members);
  const filteredStats = useStatistics(sessions, { type: averageType || undefined }, members);
  const currentStock = stats.totalStock;

  const consumptionBySessionId = useMemo(() => getConsumptionBySessionId(sessions), [sessions]);
  const sessionsByTypeData = useMemo(
    () => Object.entries(stats.sessionsByType).map(([name, value]) => ({ name, value })),
    [stats.sessionsByType],
  );
  const movementsByTypeData = useMemo(
    () => getMovementsByType(movements, year, consumptionBySessionId),
    [movements, year, consumptionBySessionId],
  );
  const stockEvolutionData = useMemo(
    () => getStockEvolution(movements, year, currentStock, consumptionBySessionId, currentYear),
    [movements, year, currentStock, consumptionBySessionId, currentYear],
  );
  const assistantNames = useMemo(() => getAssistantNames(sessions, members), [sessions, members]);
  const assistanceReport = useMemo(
    () => getAssistanceReport(sessions, members, assistantFilter),
    [sessions, members, assistantFilter],
  );

  const queries = [sessionQuery, memberQuery, vegetalQuery, movementQuery];
  const failedQuery = queries.find((query) => query.isError && query.data === undefined);
  if (failedQuery) {
    return (
      <MainLayout>
        <QueryError
          error={failedQuery.error}
          onRetry={() => queries.forEach((query) => { void query.refetch(); })}
        />
      </MainLayout>
    );
  }

  if (queries.some((query) => query.isLoading)) return <ReportsSkeleton />;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground mt-1">Análise e estatísticas do sistema</p>
          </div>
          <div className="flex gap-2">
            <Select value={year.toString()} onValueChange={changeYear}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((option) => (
                  <SelectItem key={option} value={option.toString()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ReportKpis
          year={year}
          stats={stats}
          filteredStats={filteredStats}
          averageType={averageType}
          onAverageTypeChange={setAverageType}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <SessionsByTypeChart data={sessionsByTypeData} />
          <MovementsByTypeChart data={movementsByTypeData} />
        </div>

        <StockEvolutionChart data={stockEvolutionData} />
        <StockEvolutionTable year={year} rows={stockEvolutionData} />
        <AssistanceReportTable
          year={year}
          rows={assistanceReport}
          assistants={assistantNames}
          selectedAssistant={assistantFilter}
          onAssistantChange={setAssistantFilter}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <RankingCard icon={User} title="Top 5 Dirigentes" items={stats.topDirigentes} />
          <RankingCard icon={BookOpen} title="Top 5 Explanadores" items={stats.topExplanadores} />
          <RankingCard icon={Mic} title="Top 5 Leitores" items={stats.topLeitores} />
        </div>
      </div>
    </MainLayout>
  );
}
