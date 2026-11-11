import { Droplets, Eye, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMemberDisplayNameForValue } from "@/lib/memberDisplay";
import type { MemberDisplayData } from "@/lib/memberDisplay";
import { formatSessionDate } from "@/lib/sessionDisplay";
import { formatLiters } from "@/lib/stockQuantity";
import type { Session } from "@/types/database";

interface SessionHistoryTableProps {
  sessions: Session[];
  members: MemberDisplayData[] | undefined;
  onSelect: (session: Session) => void;
}

export function SessionHistoryTable({ sessions, members, onSelect }: SessionHistoryTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Dirigente</TableHead>
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
        {sessions.map((session) => (
          <TableRow
            key={session.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onSelect(session)}
          >
            <TableCell>
              <div>
                <p className="font-medium">{formatSessionDate(session.date, "dd/MM")}</p>
                <p className="text-xs text-muted-foreground hidden md:block">
                  {formatSessionDate(session.date, "EEEE")}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs">
                {session.type}
              </Badge>
            </TableCell>
            <TableCell>
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
                {formatLiters(session.consumption?.total_consumed ?? 0)}
              </div>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ver detalhes da sessão"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(session);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
