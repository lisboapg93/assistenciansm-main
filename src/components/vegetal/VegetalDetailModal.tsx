import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Droplets } from "lucide-react";
import { Vegetal } from "@/types/database";
import { useAuthContext } from "@/hooks/useAuthContext";
import { MemberDisplayData } from "@/lib/memberDisplay";
import { VegetalInfoGrid } from "@/components/vegetal/VegetalInfoGrid";
import { StockChangeForm } from "@/components/vegetal/StockChangeForm";
import { StockMovementHistory } from "@/components/vegetal/StockMovementHistory";

interface VegetalDetailModalProps {
  vegetal: Vegetal | null;
  open: boolean;
  onClose: () => void;
  members?: MemberDisplayData[];
}

export function VegetalDetailModal({
  vegetal,
  open,
  onClose,
  members,
}: VegetalDetailModalProps) {
  // Saída e ajuste são exclusivos de editores; o banco também valida o papel.
  const { isEditor: canChangeStock } = useAuthContext();

  if (!vegetal) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            {vegetal.name}
          </DialogTitle>
        </DialogHeader>

        <VegetalInfoGrid vegetal={vegetal} members={members} />

        <Tabs defaultValue={canChangeStock ? "saida" : "historico"} className="mt-4">
          <TabsList className={canChangeStock ? "grid w-full grid-cols-3" : "w-full"}>
            {canChangeStock && <TabsTrigger value="saida">Saída</TabsTrigger>}
            {canChangeStock && <TabsTrigger value="ajuste">Ajuste</TabsTrigger>}
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {/* forceMount preserva o que foi digitado ao alternar entre as abas. */}
          {canChangeStock && (
            <>
              <TabsContent value="saida" forceMount className="mt-4 data-[state=inactive]:hidden">
                <StockChangeForm operation="Saída" vegetal={vegetal} onSuccess={onClose} />
              </TabsContent>
              <TabsContent value="ajuste" forceMount className="mt-4 data-[state=inactive]:hidden">
                <StockChangeForm operation="Ajuste" vegetal={vegetal} onSuccess={onClose} />
              </TabsContent>
            </>
          )}

          <TabsContent value="historico" className="mt-4">
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              <StockMovementHistory
                vegetalId={vegetal.id}
                currentQuantity={Number(vegetal.quantity)}
                enabled={open}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
