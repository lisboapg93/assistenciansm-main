import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Droplets, Save } from "lucide-react";
import { useCreateVegetal } from "@/hooks/useVegetais";
import { useMembers, addMemberIfNotExists } from "@/hooks/useMembers";
import { toast } from "sonner";

export default function NovaEntrada() {
  const navigate = useNavigate();
  const createVegetal = useCreateVegetal();
  const { data: members } = useMembers();

  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    envase_date: "",
    master: "",
    auxiliary: "",
    mariri_species: "",
    chacrona_species: "",
    registered_by_name: "",
    mensageiro: "",
    responsavel_chacrona: "",
    responsavel_baticao: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.quantity || !formData.envase_date || !formData.master) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const quantity = parseFloat(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Quantidade inválida");
      return;
    }

    // Add members to the database for autocomplete
    const namesToAdd = [
      formData.master,
      formData.auxiliary,
      formData.registered_by_name,
      formData.mensageiro,
      formData.responsavel_chacrona,
      formData.responsavel_baticao,
    ].filter(Boolean);

    for (const name of namesToAdd) {
      await addMemberIfNotExists(name);
    }

    createVegetal.mutate(
      {
        name: formData.name,
        quantity,
        initial_quantity: quantity,
        envase_date: formData.envase_date,
        master: formData.master,
        auxiliary: formData.auxiliary || null,
        mariri_species: formData.mariri_species || null,
        chacrona_species: formData.chacrona_species || null,
        registered_by_name: formData.registered_by_name || null,
        mensageiro: formData.mensageiro || null,
        responsavel_chacrona: formData.responsavel_chacrona || null,
        responsavel_baticao: formData.responsavel_baticao || null,
      },
      {
        onSuccess: () => {
          navigate("/estoque");
        },
      }
    );
  };

  const memberNames = members?.map((m) => m.name) || [];

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nova Entrada</h1>
            <p className="text-muted-foreground">Cadastrar novo lote de vegetal</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              Dados do Lote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome/Identificação */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Nome / Identificação <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: Mestre Fulano - Grau X - Maio/2024"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              {/* Quantidade e Data */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quantity">
                    Quantidade (L) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 10.5"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="envase_date">
                    Data do Envase <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="envase_date"
                    type="date"
                    value={formData.envase_date}
                    onChange={(e) =>
                      setFormData({ ...formData, envase_date: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Mestre e Auxiliar */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="master">
                    Mestre do Preparo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="master"
                    list="members-list"
                    placeholder="Nome do mestre"
                    value={formData.master}
                    onChange={(e) =>
                      setFormData({ ...formData, master: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auxiliary">Auxiliar</Label>
                  <Input
                    id="auxiliary"
                    list="members-list"
                    placeholder="Nome do auxiliar (opcional)"
                    value={formData.auxiliary}
                    onChange={(e) =>
                      setFormData({ ...formData, auxiliary: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Mensageiro e Responsáveis */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="mensageiro">Mensageiro</Label>
                  <Input
                    id="mensageiro"
                    list="members-list"
                    placeholder="Nome do mensageiro"
                    value={formData.mensageiro}
                    onChange={(e) =>
                      setFormData({ ...formData, mensageiro: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsavel_chacrona">Resp. Chacrona</Label>
                  <Input
                    id="responsavel_chacrona"
                    list="members-list"
                    placeholder="Responsável pela chacrona"
                    value={formData.responsavel_chacrona}
                    onChange={(e) =>
                      setFormData({ ...formData, responsavel_chacrona: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responsavel_baticao">Resp. Batição</Label>
                  <Input
                    id="responsavel_baticao"
                    list="members-list"
                    placeholder="Responsável pela batição"
                    value={formData.responsavel_baticao}
                    onChange={(e) =>
                      setFormData({ ...formData, responsavel_baticao: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Espécies */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mariri_species">Espécie do Mariri</Label>
                  <Input
                    id="mariri_species"
                    placeholder="Opcional"
                    value={formData.mariri_species}
                    onChange={(e) =>
                      setFormData({ ...formData, mariri_species: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chacrona_species">Espécie da Chacrona</Label>
                  <Input
                    id="chacrona_species"
                    placeholder="Opcional"
                    value={formData.chacrona_species}
                    onChange={(e) =>
                      setFormData({ ...formData, chacrona_species: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Registrado por */}
              <div className="space-y-2">
                <Label htmlFor="registered_by_name">Registrado por</Label>
                <Input
                  id="registered_by_name"
                  list="members-list"
                  placeholder="Seu nome (opcional)"
                  value={formData.registered_by_name}
                  onChange={(e) =>
                    setFormData({ ...formData, registered_by_name: e.target.value })
                  }
                />
              </div>

              {/* Datalist for autocomplete */}
              <datalist id="members-list">
                {memberNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>

              {/* Submit */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(-1)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 gap-2"
                  disabled={createVegetal.isPending}
                >
                  <Save className="h-4 w-4" />
                  {createVegetal.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}