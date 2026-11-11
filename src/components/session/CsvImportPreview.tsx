import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getParsedSessionParticipants } from "@/lib/sessionCsvImport";
import type { ParsedSession } from "@/lib/sessionCsvValidation";
import { sumParticipants } from "@/lib/sessionData";
import { formatLiters } from "@/lib/stockQuantity";

function StatusIcon({ valid }: { valid: boolean }) {
  return valid
    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : <XCircle className="h-4 w-4 text-destructive" />;
}

function FlagCell({ checked }: { checked: boolean }) {
  return checked
    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : <span className="text-muted-foreground">-</span>;
}

export function CsvImportPreview({ sessions }: { sessions: ParsedSession[] }) {
  const validCount = sessions.filter((session) => session.isValid).length;
  const invalidCount = sessions.length - validCount;

  return (
    <>
      <div className="flex gap-4">
        <Badge variant="outline" className="gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          {validCount} válidas
        </Badge>
        <Badge variant="outline" className="gap-1">
          <XCircle className="h-3 w-3 text-destructive" />
          {invalidCount} inválidas
        </Badge>
      </div>

      <ScrollArea className="h-[400px] border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Dirigente</TableHead>
              <TableHead>Registrado por</TableHead>
              <TableHead>Leitor</TableHead>
              <TableHead>Transmissão</TableHead>
              <TableHead>Participantes</TableHead>
              <TableHead>Consumo</TableHead>
              <TableHead>Lotes</TableHead>
              <TableHead>Foto</TableHead>
              <TableHead>Áudio</TableHead>
              <TableHead>Erros</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.rowNumber} className={session.isValid ? "" : "bg-destructive/10"}>
                <TableCell>
                  <StatusIcon valid={session.isValid} />
                </TableCell>
                <TableCell>{session.date || "-"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {session.type || "-"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[120px] truncate">{session.dirigente || "-"}</TableCell>
                <TableCell className="max-w-[120px] truncate">{session.registered_by_name || "-"}</TableCell>
                <TableCell className="max-w-[120px] truncate">{session.leitor || "-"}</TableCell>
                <TableCell>{session.is_transmissao_assistencia ? "Sim" : "Não"}</TableCell>
                <TableCell>{sumParticipants(getParsedSessionParticipants(session))}</TableCell>
                <TableCell>{formatLiters(session.total_consumed)}</TableCell>
                <TableCell className="max-w-[180px] text-xs">
                  {session.sources.map((source) => source.vegetal_name).join(", ") || "-"}
                </TableCell>
                <TableCell>
                  <FlagCell checked={session.has_photo} />
                </TableCell>
                <TableCell>
                  <FlagCell checked={session.has_audio} />
                </TableCell>
                <TableCell>
                  {session.errors.length > 0 && (
                    <span className="text-xs text-destructive">
                      {session.errors.join(", ")}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </>
  );
}
