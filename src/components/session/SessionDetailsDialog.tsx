import type { ReactNode } from "react";
import { Calendar, Camera, Edit, Mic, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBrazilianDateTime } from "@/lib/date";
import { getMemberDisplayNameForValue } from "@/lib/memberDisplay";
import type { MemberDisplayData } from "@/lib/memberDisplay";
import { formatSessionDate } from "@/lib/sessionDisplay";
import { formatLiters } from "@/lib/stockQuantity";
import type { Session } from "@/types/database";

interface SessionDetailsDialogProps {
  session: Session | null;
  members: MemberDisplayData[] | undefined;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (session: Session) => void;
  onDelete: (session: Session) => void;
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function SessionDetailsDialog({
  session,
  members,
  canEdit,
  onClose,
  onEdit,
  onDelete,
}: SessionDetailsDialogProps) {
  const displayName = (name: string) => getMemberDisplayNameForValue(name, members);
  const sources = session?.consumption?.sources ?? [];
  const optionalRoles = session ? [
    ["Mestre Assistente", session.mestre_assistente],
    ["Registrado por", session.registered_by_name],
    ["Explanador", session.explanador],
    ["Leitor", session.leitor],
  ] as const : [];

  return (
    <Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {session && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Detalhes da Sessão ({session.type})
              </DialogTitle>
              <div className="space-y-1 text-left text-sm text-muted-foreground">
                <p>
                  Cadastrado em {formatBrazilianDateTime(session.created_at)}
                </p>
                {new Date(session.updated_at) > new Date(session.created_at) && (
                  <p>
                    Atualizado em {formatBrazilianDateTime(session.updated_at)}
                  </p>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                <DetailField label="Data">
                  <p className="font-medium">{formatSessionDate(session.date)}</p>
                </DetailField>
                <DetailField label="Tipo">
                  <Badge variant="secondary" className="text-base font-semibold">
                    {session.type}
                  </Badge>
                </DetailField>
                <DetailField label="Dirigente">
                  <p className="font-medium">{displayName(session.dirigente)}</p>
                </DetailField>
                {optionalRoles.map(([label, name]) => name && (
                  <DetailField key={label} label={label}>
                    <p className="font-medium">{displayName(name)}</p>
                  </DetailField>
                ))}
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Participantes</h4>
                <div className="p-3 rounded-lg bg-primary/10 text-center">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold text-primary">
                    {session.total_participants}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Consumo</h4>
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Total consumido:
                    </span>
                    <span className="font-medium text-primary">
                      {formatLiters(session.consumption?.total_consumed ?? 0)}
                    </span>
                  </div>
                  {session.consumption?.is_united && (
                    <Badge className="mt-2">Vegetal Unido</Badge>
                  )}
                  {sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">Vegetais utilizados:</p>
                      {sources.map((source, index) => (
                        <p key={`${source.vegetal_id}-${index}`} className="text-sm">
                          • {source.vegetal_name} ({formatLiters(source.amount_available)})
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                {session.has_photo && (
                  <Badge variant="outline" className="gap-1">
                    <Camera className="h-3 w-3" />
                    Registro Fotográfico
                  </Badge>
                )}
                {session.has_audio && (
                  <Badge variant="outline" className="gap-1">
                    <Mic className="h-3 w-3" />
                    Registro de Áudio
                  </Badge>
                )}
              </div>

              {session.observation && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Acontecimento na Sessão</h4>
                  <p className="text-sm text-muted-foreground">
                    {session.observation}
                  </p>
                </div>
              )}

              {canEdit && (
                <div className="pt-4 border-t flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => onEdit(session)}
                  >
                    <Edit className="h-4 w-4" />
                    Editar Sessão
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => onDelete(session)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir Sessão
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
