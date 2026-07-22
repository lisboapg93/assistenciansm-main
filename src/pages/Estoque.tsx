import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Droplets, Calendar, TrendingDown, Search, Eye } from "lucide-react";
import { useVegetais, useTotalStock } from "@/hooks/useVegetais";
import { useSessions } from "@/hooks/useSessions";
import { useStatistics } from "@/hooks/useStatistics";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Vegetal } from "@/types/database";
import { VegetalDetailModal } from "@/components/vegetal/VegetalDetailModal";
import { useAuthContext } from "@/contexts/AuthContext";

export default function Estoque() {
  const { isEditor } = useAuthContext();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedVegetal, setSelectedVegetal] = useState<Vegetal | null>(null);

  const { data: vegetais, isLoading } = useVegetais(showArchived);
  const { data: sessions } = useSessions();
  const totalStock = useTotalStock();
  const stats = useStatistics(sessions);

  const filteredVegetais = vegetais?.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.master.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Sala do Vegetal</h1>
            <p className="text-muted-foreground mt-1">
              Gerenciamento de estoque e lotes
            </p>
          </div>
          {isEditor && (
            <Link to="/estoque/novo">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Entrada
              </Button>
            </Link>
          )}
        </div>

        {/* KPI Header */}
        <Card className="bg-gradient-to-r from-primary/15 to-card border-primary/20">
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/20">
                  <Droplets className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estoque Total</p>
                  <p className="text-2xl font-bold text-primary">
                    {totalStock.toFixed(2)} L
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-success/20">
                  <Calendar className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Previsão</p>
                  <p className="text-2xl font-bold">
                    ~{Math.floor(stats.sessionsRemaining)} sessões
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-warning/20">
                  <TrendingDown className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duração</p>
                  <p className="text-2xl font-bold">
                    ~{stats.monthsRemaining.toFixed(1)} meses
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou mestre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-sm">
              Mostrar zerados
            </Label>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredVegetais?.length === 0 ? (
              <div className="p-12 text-center">
                <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhum vegetal encontrado</p>
                <p className="text-muted-foreground mt-1">
                  Cadastre um novo lote para começar
                </p>
              </div>
            ) : (
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
                  {filteredVegetais?.map((vegetal) => (
                    <TableRow
                      key={vegetal.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedVegetal(vegetal)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{vegetal.name}</p>
                          <p className="text-sm text-muted-foreground md:hidden">
                            {vegetal.master}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {vegetal.master}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(new Date(vegetal.envase_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            vegetal.quantity <= 0
                              ? "text-destructive"
                              : vegetal.quantity < 2
                              ? "text-warning"
                              : "text-primary font-medium"
                          }
                        >
                          {Number(vegetal.quantity).toFixed(2)} L
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVegetal(vegetal);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <VegetalDetailModal
        vegetal={selectedVegetal}
        open={!!selectedVegetal}
        onClose={() => setSelectedVegetal(null)}
      />
    </MainLayout>
  );
}
