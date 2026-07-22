import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Vegetal } from "@/types/database";
import { useUpdateVegetal } from "@/hooks/useVegetais";
import { useStockMovements } from "@/hooks/useStockMovements";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownRight, ArrowUpRight, Settings, Droplets } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";

interface VegetalDetailModalProps {
  vegetal: Vegetal | null;
  open: boolean;
  onClose: () => void;
}

export function VegetalDetailModal({
  vegetal,
  open,
  onClose,
}: VegetalDetailModalProps) {
  const { isEditor } = useAuthContext();
  const [saidaQtd, setSaidaQtd] = useState("");
  const [saidaMotivo, setSaidaMotivo] = useState("");
  const [saidaRegistradoPor, setSaidaRegistradoPor] = useState("");
  const [ajusteQtd, setAjusteQtd] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  const [ajusteRegistradoPor, setAjusteRegistradoPor] = useState("");

  const updateVegetal = useUpdateVegetal();
  const { data: movements } = useStockMovements(vegetal?.id);

  if (!vegetal) return null;

  const availableQuantity = Number(vegetal.quantity);
  const requestedQuantity = Number.parseFloat(saidaQtd);
  const exceedsAvailableQuantity =
    saidaQtd !== "" && Number.isFinite(requestedQuantity) && requestedQuantity > availableQuantity;

  const handleSaida = () => {
    const qtd = parseFloat(saidaQtd);
    if (isNaN(qtd) || qtd <= 0) return;
    if (qtd > vegetal.quantity) return;

    const registeredBy = saidaRegistradoPor.trim();
    updateVegetal.mutate(
      {
        id: vegetal.id,
        updates: { quantity: vegetal.quantity - qtd },
        movementType: "Saída",
        movementDetails: `${saidaMotivo || "Saída manual de estoque"}${registeredBy ? ` - Registrado por: ${registeredBy}` : ""}`,
      },
      {
        onSuccess: () => {
          setSaidaQtd("");
          setSaidaMotivo("");
          setSaidaRegistradoPor("");
          onClose();
        },
      }
    );
  };

  const handleAjuste = () => {
    const qtd = parseFloat(ajusteQtd);
    if (isNaN(qtd) || qtd < 0) return;

    const registeredBy = ajusteRegistradoPor.trim();
    updateVegetal.mutate(
      {
        id: vegetal.id,
        updates: { quantity: qtd },
        movementType: "Ajuste",
        movementDetails: `${ajusteMotivo || "Ajuste/correção de estoque"}${registeredBy ? ` - Registrado por: ${registeredBy}` : ""}`,
      },
      {
        onSuccess: () => {
          setAjusteQtd("");
          setAjusteMotivo("");
          setAjusteRegistradoPor("");
          onClose();
        },
      }
    );
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "Entrada":
      case "Saldo":
        return <ArrowUpRight className="h-4 w-4 text-primary" />;
      case "Saída":
      case "Consumo":
        return <ArrowDownRight className="h-4 w-4 text-destructive" />;
      default:
        return <Settings className="h-4 w-4 text-warning" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            {vegetal.name}
          </DialogTitle>
        </DialogHeader>

        {/* All Information Visible */}
        <div className="grid grid-cols-2 gap-4 py-4 border-y border-border">
          <div>
            <p className="text-sm text-muted-foreground">Mestre do Preparo</p>
            <p className="font-medium">{vegetal.master}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Auxiliar</p>
            <p className="font-medium">{vegetal.auxiliary || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Data Envase</p>
            <p className="font-medium">
              {format(new Date(vegetal.envase_date), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Quantidade Atual</p>
            <p className="font-medium text-primary">
              {Number(vegetal.quantity).toFixed(2)} L
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Quantidade Inicial</p>
            <p className="font-medium">{Number(vegetal.initial_quantity).toFixed(2)} L</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Espécie Mariri</p>
            <p className="font-medium">{vegetal.mariri_species || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Espécie Chacrona</p>
            <p className="font-medium">{vegetal.chacrona_species || "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Registrado por</p>
            <p className="font-medium">{vegetal.registered_by_name || "-"}</p>
          </div>
        </div>

        <Tabs defaultValue={isEditor ? "saida" : "historico"} className="mt-4">
          <TabsList className={isEditor ? "grid w-full grid-cols-3" : "w-full"}>
            {isEditor && <TabsTrigger value="saida">Saída</TabsTrigger>}
            {isEditor && <TabsTrigger value="ajuste">Ajuste</TabsTrigger>}
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          {isEditor && (
            <TabsContent value="saida" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Quantidade (L)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={vegetal.quantity}
                  inputMode="decimal"
                  value={saidaQtd}
                  onChange={(e) => setSaidaQtd(e.target.value)}
                  placeholder="Ex: 1.5"
                />
                <p className="text-xs text-muted-foreground">
                  Disponível: {availableQuantity.toFixed(2)} L
                </p>
                {exceedsAvailableQuantity && (
                  <p className="text-xs text-destructive" role="alert">
                    A quantidade informada é maior que o saldo disponível.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Textarea
                  value={saidaMotivo}
                  onChange={(e) => setSaidaMotivo(e.target.value)}
                  placeholder="Descarte, doação, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Registrado por</Label>
                <Input
                  value={saidaRegistradoPor}
                  onChange={(e) => setSaidaRegistradoPor(e.target.value)}
                  placeholder="Nome de quem está registrando"
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={
                      !saidaQtd ||
                      !Number.isFinite(requestedQuantity) ||
                      requestedQuantity <= 0 ||
                      exceedsAvailableQuantity
                    }
                  >
                    Registrar Saída
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Saída</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja registrar a saída de {saidaQtd} L do estoque?
                      Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSaida}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>
          )}

          {isEditor && (
            <TabsContent value="ajuste" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nova Quantidade (L)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ajusteQtd}
                  onChange={(e) => setAjusteQtd(e.target.value)}
                  placeholder={`Atual: ${vegetal.quantity}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Justificativa</Label>
                <Textarea
                  value={ajusteMotivo}
                  onChange={(e) => setAjusteMotivo(e.target.value)}
                  placeholder="Correção de inventário, erro de medição, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Registrado por</Label>
                <Input
                  value={ajusteRegistradoPor}
                  onChange={(e) => setAjusteRegistradoPor(e.target.value)}
                  placeholder="Nome de quem está registrando"
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full" disabled={!ajusteQtd}>
                    Aplicar Ajuste
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Ajuste</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja ajustar a quantidade de {vegetal.quantity} L
                      para {ajusteQtd} L? Esta ação será registrada no histórico.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleAjuste}>Confirmar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>
          )}

          <TabsContent value="historico" className="mt-4">
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {movements?.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                movements?.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <span className="mt-0.5 shrink-0">{getMovementIcon(m.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{m.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(m.date), "dd/MM/yy HH:mm")}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground break-words">
                        {m.details}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-medium ${
                        m.type === "Entrada" || m.type === "Saldo"
                          ? "text-primary"
                          : "text-destructive"
                      }`}
                    >
                      {m.type === "Entrada" || m.type === "Saldo" ? "+" : "-"}
                      {Number(m.quantity).toFixed(2)} L
                    </p>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
