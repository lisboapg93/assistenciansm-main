import type { Dispatch, SetStateAction } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { SESSION_TYPES } from "@/types/database";
import { todayBrazilianIsoDate } from "@/lib/date";

export interface HistoryFiltersValue {
  search: string;
  year: number | undefined;
  month: number | undefined;
  types: string[];
  lastMonths: number | undefined;
}

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

const currentYear = Number(todayBrazilianIsoDate().slice(0, 4));
const YEARS = Array.from({ length: Math.max(1, currentYear - 2024 + 1) }, (_, i) => currentYear - i);

const LAST_MONTHS_OPTIONS = [
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "9", label: "Últimos 9 meses" },
  { value: "12", label: "Últimos 12 meses" },
];

interface HistoryFiltersProps {
  filters: HistoryFiltersValue;
  setFilters: Dispatch<SetStateAction<HistoryFiltersValue>>;
}

export function HistoryFilters({ filters, setFilters }: HistoryFiltersProps) {
  return (
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
                year: undefined,
                month: undefined,
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
              setFilters({
                ...filters,
                year: value === "all" ? undefined : parseInt(value),
                month: value === "all" ? undefined : filters.month,
              })
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

          {/* Mês exige um ano explícito e não se aplica ao período relativo */}
          <Select
            value={filters.month?.toString() || "all"}
            onValueChange={(value) =>
              setFilters({
                ...filters,
                month: value === "all" ? undefined : parseInt(value),
              })
            }
            disabled={!!filters.lastMonths || filters.year === undefined}
          >
            <SelectTrigger
              className={filters.lastMonths || filters.year === undefined ? "opacity-50" : ""}
              title={filters.year === undefined ? "Selecione um ano para filtrar por mês" : undefined}
            >
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
  );
}
