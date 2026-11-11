import { ArrowUpDown, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyTable, ReportCard } from "@/components/reports/ReportCard";
import type { StockEvolutionRow } from "@/components/reports/ReportCharts";
import { formatLiters } from "@/lib/stockQuantity";
import type { AssistanceReportRow } from "@/lib/reports";

const ALL_ASSISTANTS = "all";
const TABLE_CONTENT_CLASS = "p-0 overflow-x-auto";
const EMPTY_PERIOD_MESSAGE = "Sem ocorrências no período";

export function StockEvolutionTable({ year, rows }: { year: number; rows: StockEvolutionRow[] }) {
  return (
    <ReportCard
      icon={ArrowUpDown}
      title={`Ocorrências de Estoque por Período em ${year}`}
      contentClassName={TABLE_CONTENT_CLASS}
    >
      {rows.length === 0 ? (
        <EmptyTable message={EMPTY_PERIOD_MESSAGE} />
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
            {rows.map((row) => (
              <TableRow key={row.month}>
                <TableCell className="font-medium capitalize">{row.month}</TableCell>
                <TableCell className="text-right">{formatLiters(row.entrada)}</TableCell>
                <TableCell className="text-right">{formatLiters(row.saida)}</TableCell>
                <TableCell className="text-right">{formatLiters(row.consumo)}</TableCell>
                <TableCell className="text-right font-medium">{formatLiters(row.saldo)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ReportCard>
  );
}

interface AssistanceReportTableProps {
  year: number;
  rows: AssistanceReportRow[];
  assistants: string[];
  selectedAssistant: string;
  onAssistantChange: (assistant: string) => void;
}

export function AssistanceReportTable({
  year,
  rows,
  assistants,
  selectedAssistant,
  onAssistantChange,
}: AssistanceReportTableProps) {
  const assistantFilter = (
    <Select
      value={selectedAssistant || ALL_ASSISTANTS}
      onValueChange={(value) => onAssistantChange(value === ALL_ASSISTANTS ? "" : value)}
    >
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder="Todos os assistentes" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_ASSISTANTS}>Todos os assistentes</SelectItem>
        {assistants.map((assistant) => (
          <SelectItem key={assistant} value={assistant}>
            {assistant}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <ReportCard
      icon={Calendar}
      title={`Ocorrências por Assistência em ${year}`}
      action={assistantFilter}
      contentClassName={TABLE_CONTENT_CLASS}
    >
      {rows.length === 0 ? (
        <EmptyTable message={EMPTY_PERIOD_MESSAGE} />
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
            {rows.map((row) => (
              <TableRow key={row.type}>
                <TableCell className="font-medium">{row.type}</TableCell>
                <TableCell className="text-right">{row.sessions}</TableCell>
                <TableCell className="text-right">{formatLiters(row.consumption)}</TableCell>
                <TableCell className="text-right">{formatLiters(row.averageConsumption)}</TableCell>
                <TableCell className="text-right">{formatLiters(row.averageConsumptionPerMember, 3)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ReportCard>
  );
}
