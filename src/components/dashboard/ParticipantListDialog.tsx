import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatSessionDayMonth } from "@/components/dashboard/participantDates";

export interface ParticipantListItem {
  name: string;
  date?: string;
  type?: string;
}

const GRAU_FILTERS = [
  { value: "Quadro de Mestre", label: "QM" },
  { value: "Corpo do Conselho", label: "CDC" },
  { value: "Corpo Instrutivo", label: "CI" },
  { value: "Quadro de Sócios", label: "QS" },
] as const;

interface GrauFilterProps {
  value: string[];
  onChange: (value: string[]) => void;
}

interface ParticipantListDialogProps {
  open: boolean;
  title: string;
  items: ParticipantListItem[];
  /** Exibe tipo e data da sessão de cada registro. */
  showSessionDetails: boolean;
  /** Filtro por grau, exibido apenas nas listas de sócios. */
  grauFilter?: GrauFilterProps;
  onClose: () => void;
}

export function ParticipantListDialog({
  open,
  title,
  items,
  showSessionDetails,
  grauFilter,
  onClose,
}: ParticipantListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {grauFilter && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Filtrar por grau:</p>
            <ToggleGroup
              type="multiple"
              value={grauFilter.value}
              onValueChange={grauFilter.onChange}
              className="justify-start flex-wrap gap-1"
            >
              {GRAU_FILTERS.map((grau) => (
                <ToggleGroupItem key={grau.value} value={grau.value} size="sm" className="px-3 text-xs" title={grau.value}>
                  {grau.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 pr-4">
            {items.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {index + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm">{item.name}</span>
                    {showSessionDetails && <span className="text-xs text-muted-foreground">{item.type}</span>}
                  </div>
                </div>
                {showSessionDetails && item.date && (
                  <span className="text-sm text-muted-foreground">{formatSessionDayMonth(item.date)}</span>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro encontrado</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
