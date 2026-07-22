import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  BarChart3,
  Calendar,
  Droplets,
  Users,
  TrendingUp,
  User,
  BookOpen,
  Mic,
  ArrowUpDown,
} from "lucide-react";
import { useSessions } from "@/hooks/useSessions";
import { useStatistics } from "@/hooks/useStatistics";
import { useStockMovements } from "@/hooks/useStockMovements";
import { SESSION_TYPES, MovementType } from "@/types/database";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const currentYear = new Date().getFullYear();
const START_YEAR = 2025;
const YEARS = Array.from({ length: currentYear - START_YEAR + 1 }, (_, i) => currentYear - i);

const COLORS = [
  "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(200, 80%, 50%)",
  "hsl(280, 70%, 50%)",
  "hsl(120, 60%, 40%)",
  "hsl(30, 80%, 50%)",
  "hsl(180, 70%, 45%)",
];

const MOVEMENT_COLORS: Record<MovementType, string> = {
  Entrada: "hsl(160, 84%, 39%)",
  Saída: "hsl(38, 92%, 50%)",
  Consumo: "hsl(0, 72%, 51%)",
  Ajuste: "hsl(200, 80%, 50%)",
  Saldo: "hsl(280, 70%, 50%)",
};

const movementEffect = (type: MovementType, quantity: number) => {
  if (type === "Entrada" || type === "Saldo") return Math.abs(quantity);
  if (type === "Ajuste") return -quantity;
  return -Math.abs(quantity);
};

export default function Relatorios() {
  const [year, setYear] = useState(currentYear);
  const [averageType, setAverageType] = useState("");

  const { data: sessions, isLoading } = useSessions({ year });
  const stats = useStatistics(sessions);
  const statsFiltered = useStatistics(sessions, { type: averageType || undefined });
  const { data: movements, isLoading: isLoadingMovements } = useStockMovements();

  // Prepare chart data
  const sessionsByTypeData = Object.entries(stats.sessionsByType).map(
    ([name, value]) => ({ name, value })
  );

  // Movements by type chart data
  const movementsByTypeData = useMemo(() => {
    if (!movements) return [];
    
    const yearMovements = movements.filter((m) => {
      const moveYear = new Date(m.date).getFullYear();
      return moveYear === year;
    });

    const counts: Record<string, { type: string; quantidade: number; litros: number }> = {};
    yearMovements.forEach((m) => {
      if (!counts[m.type]) {
        counts[m.type] = { type: m.type, quantidade: 0, litros: 0 };
      }
      counts[m.type].quantidade += 1;
      counts[m.type].litros += Math.abs(m.quantity);
    });

    return Object.values(counts).sort((a, b) => b.litros - a.litros);
  }, [movements, year]);

  // Monthly flows and cumulative balance for the selected year.
  const stockEvolutionData = useMemo(() => {
    if (!movements) return [];

    const yearStart = new Date(year, 0, 1).getTime();
    let accumulatedBalance = movements
      .filter((m) => new Date(m.date).getTime() < yearStart)
      .reduce((sum, m) => sum + movementEffect(m.type, Number(m.quantity)), 0);

    const yearMovements = movements
      .filter((m) => new Date(m.date).getFullYear() === year)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (yearMovements.length === 0) return [];

    // Group by month
    const monthlyData: Record<string, { month: string; entrada: number; saida: number; consumo: number }> = {};

    yearMovements.forEach((m) => {
      const monthIndex = new Date(m.date).getMonth();
      const monthKey = String(monthIndex).padStart(2, "0");
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: format(parseISO(m.date), "MMM", { locale: ptBR }),
          entrada: 0,
          saida: 0,
          consumo: 0,
        };
      }

      if (m.type === "Entrada" || m.type === "Saldo") {
        monthlyData[monthKey].entrada += Math.abs(Number(m.quantity));
      } else if (m.type === "Saída") {
        monthlyData[monthKey].saida += Math.abs(Number(m.quantity));
      } else if (m.type === "Ajuste") {
        if (Number(m.quantity) >= 0) monthlyData[monthKey].saida += Number(m.quantity);
        else monthlyData[monthKey].entrada += Math.abs(Number(m.quantity));
      } else if (m.type === "Consumo") {
        monthlyData[monthKey].consumo += Math.abs(Number(m.quantity));
      }
    });

    return Object.keys(monthlyData).sort().map((key) => {
      const data = monthlyData[key];
      accumulatedBalance += data.entrada - data.saida - data.consumo;
      return {
        month: data.month,
        entrada: Number(data.entrada.toFixed(2)),
        saida: Number(data.saida.toFixed(2)),
        consumo: Number(data.consumo.toFixed(2)),
        saldo: Number(Math.max(0, accumulatedBalance).toFixed(2)),
      };
    });
  }, [movements, year]);

  const assistanceReport = useMemo(() => {
    const grouped: Record<string, { type: string; sessions: number; consumption: number; members: number }> = {};
    (sessions || []).forEach((session) => {
      grouped[session.type] ||= { type: session.type, sessions: 0, consumption: 0, members: 0 };
      grouped[session.type].sessions += 1;
      grouped[session.type].consumption += Number(session.consumption?.total_consumed || 0);
      grouped[session.type].members += Number(session.participants?.socios || 0);
    });
    return Object.values(grouped).sort((a, b) => b.sessions - a.sessions);
  }, [sessions]);

  if (isLoading || isLoadingMovements) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground mt-1">
              Análise e estatísticas do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Select
              value={year.toString()}
              onValueChange={(value) => setYear(parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Total de Sessões"
            value={stats.totalSessions}
            subtitle={`Em ${year}`}
            icon={Calendar}
            variant="primary"
          />
          <StatCard
            title="Total Consumido"
            value={`${stats.totalConsumed.toFixed(2)} L`}
            subtitle="Consumo acumulado"
            icon={Droplets}
            variant="destructive"
          />
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média por Sessão</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsFiltered.averageConsumption.toFixed(2)} L
              </div>
              <Select
                value={averageType || "all"}
                onValueChange={(value) => setAverageType(value === "all" ? "" : value)}
              >
                <SelectTrigger className="w-full mt-2 h-8 text-xs">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {SESSION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média por Sócio</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsFiltered.averageConsumptionPerMember.toFixed(3)} L
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Por presença de sócio · {averageType || "Todos os tipos"}
              </p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-green-200 dark:border-green-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média Participantes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(statsFiltered.averageParticipants)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {averageType ? averageType : "Todos os tipos"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sessions by Type */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-primary" />
                Sessões por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessionsByTypeData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhuma sessão registrada
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={sessionsByTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Movimentações por Tipo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowUpDown className="h-5 w-5 text-primary" />
                Movimentações por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movementsByTypeData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Nenhuma movimentação registrada
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={movementsByTypeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      dataKey="type"
                      type="category"
                      width={80}
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => [
                        name === "litros" ? `${value.toFixed(2)} L` : value,
                        name === "litros" ? "Volume" : "Qtd. Movimentações",
                      ]}
                    />
                    <Bar 
                      dataKey="litros" 
                      fill="hsl(var(--primary))" 
                      radius={4}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stock Evolution Chart - Full Width */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Visão Acumulada do Estoque por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockEvolutionData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Sem movimentações para exibir
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stockEvolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(2)} L`,
                      name === "entrada"
                        ? "Entradas"
                        : name === "saida"
                          ? "Saídas"
                          : name === "saldo"
                            ? "Saldo acumulado"
                            : "Consumo",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="entrada"
                    stroke={MOVEMENT_COLORS.Entrada}
                    strokeWidth={2}
                    dot={{ fill: MOVEMENT_COLORS.Entrada, strokeWidth: 2 }}
                    name="entrada"
                  />
                  <Line
                    type="monotone"
                    dataKey="saida"
                    stroke={MOVEMENT_COLORS.Saída}
                    strokeWidth={2}
                    dot={{ fill: MOVEMENT_COLORS.Saída, strokeWidth: 2 }}
                    name="saida"
                  />
                  <Line
                    type="monotone"
                    dataKey="consumo"
                    stroke={MOVEMENT_COLORS.Consumo}
                    strokeWidth={2}
                    dot={{ fill: MOVEMENT_COLORS.Consumo, strokeWidth: 2 }}
                    name="consumo"
                  />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    stroke={MOVEMENT_COLORS.Saldo}
                    strokeWidth={3}
                    dot={{ fill: MOVEMENT_COLORS.Saldo, strokeWidth: 2 }}
                    name="saldo"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MOVEMENT_COLORS.Entrada }} />
                <span>Entradas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MOVEMENT_COLORS.Saída }} />
                <span>Saídas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MOVEMENT_COLORS.Consumo }} />
                <span>Consumo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MOVEMENT_COLORS.Saldo }} />
                <span>Saldo acumulado</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpDown className="h-5 w-5 text-primary" />
              Ocorrências de Estoque por Período em {year}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {stockEvolutionData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Sem ocorrências no período</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead className="text-right">Saída</TableHead>
                    <TableHead className="text-right">Consumo</TableHead>
                    <TableHead className="text-right">Saldo acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockEvolutionData.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium capitalize">{row.month}</TableCell>
                      <TableCell className="text-right">{row.entrada.toFixed(2)} L</TableCell>
                      <TableCell className="text-right">{row.saida.toFixed(2)} L</TableCell>
                      <TableCell className="text-right">{row.consumo.toFixed(2)} L</TableCell>
                      <TableCell className="text-right font-medium">{row.saldo.toFixed(2)} L</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-primary" />
              Ocorrências por Assistência em {year}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {assistanceReport.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Sem ocorrências no período</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assistência</TableHead>
                    <TableHead className="text-right">Sessões</TableHead>
                    <TableHead className="text-right">Consumo</TableHead>
                    <TableHead className="text-right">Média/sessão</TableHead>
                    <TableHead className="text-right">Média/sócio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assistanceReport.map((row) => (
                    <TableRow key={row.type}>
                      <TableCell className="font-medium">{row.type}</TableCell>
                      <TableCell className="text-right">{row.sessions}</TableCell>
                      <TableCell className="text-right">{row.consumption.toFixed(2)} L</TableCell>
                      <TableCell className="text-right">{(row.consumption / row.sessions).toFixed(2)} L</TableCell>
                      <TableCell className="text-right">
                        {row.members > 0 ? (row.consumption / row.members).toFixed(3) : "0.000"} L
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Rankings */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top Dirigentes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-primary" />
                Top 5 Dirigentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topDirigentes.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Sem dados
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.topDirigentes.map((d, i) => (
                    <div
                      key={d.name}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                        style={{ backgroundColor: `${COLORS[i]}20`, color: COLORS[i] }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="font-medium">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Explanadores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5 text-primary" />
                Top 5 Explanadores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topExplanadores.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Sem dados
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.topExplanadores.map((d, i) => (
                    <div
                      key={d.name}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                        style={{ backgroundColor: `${COLORS[i]}20`, color: COLORS[i] }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="font-medium">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Leitores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="h-5 w-5 text-primary" />
                Top 5 Leitores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topLeitores.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Sem dados
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.topLeitores.map((d, i) => (
                    <div
                      key={d.name}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <span
                        className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                        style={{ backgroundColor: `${COLORS[i]}20`, color: COLORS[i] }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="font-medium">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
