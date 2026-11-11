import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMemberDisplayNameForValue, type MemberDisplayData } from "@/lib/memberDisplay";
import { formatEnvaseDate, getStockLevel, type StockLevel } from "@/lib/stockLots";
import { formatLiters } from "@/lib/stockQuantity";
import type { Vegetal } from "@/types/database";

const QUANTITY_CLASS_BY_LEVEL: Record<StockLevel, string> = {
  empty: "font-bold text-destructive",
  low: "text-warning",
  normal: "text-primary font-medium",
};

interface VegetalTableProps {
  vegetais: Vegetal[];
  members: MemberDisplayData[] | undefined;
  onSelect: (vegetal: Vegetal) => void;
}

export function VegetalTable({ vegetais, members, onSelect }: VegetalTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome / Lote</TableHead>
          <TableHead className="hidden md:table-cell">Mestre do Preparo</TableHead>
          <TableHead className="hidden md:table-cell">Data Envase</TableHead>
          <TableHead className="text-right">Quantidade</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vegetais.map((vegetal) => {
          const masterName = getMemberDisplayNameForValue(vegetal.master, members);
          return (
            <TableRow
              key={vegetal.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelect(vegetal)}
            >
              <TableCell>
                <div>
                  <p className="font-medium">{vegetal.name}</p>
                  <p className="text-sm text-muted-foreground md:hidden">{masterName}</p>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">{masterName}</TableCell>
              <TableCell className="hidden md:table-cell">{formatEnvaseDate(vegetal.envase_date)}</TableCell>
              <TableCell className="text-right">
                <span className={QUANTITY_CLASS_BY_LEVEL[getStockLevel(vegetal.quantity)]}>
                  {formatLiters(vegetal.quantity)}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Ver detalhes de ${vegetal.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(vegetal);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
