import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Droplets, Save } from "lucide-react";
import { useCreateVegetal } from "@/hooks/useVegetais";
import { useMembers } from "@/hooks/useMembers";
import { getMemberDisplayName } from "@/lib/memberDisplay";
import { toast } from "sonner";
import { QueryError } from "@/components/QueryError";
import { buildVegetalInput, EMPTY_VEGETAL_ENTRY_FORM, type VegetalEntryForm } from "@/lib/stockEntry";
import {
  MEMBER_SUGGESTIONS_LIST_ID,
  VegetalEntryField,
  type VegetalEntryFieldConfig,
} from "@/components/vegetal/VegetalEntryField";

const STOCK_ROUTE = "/estoque";

interface FieldGroup {
  columnsClassName: string;
  fields: VegetalEntryFieldConfig[];
}

const FIELD_GROUPS: FieldGroup[] = [
  {
    columnsClassName: "",
    fields: [
      { name: "name", label: "Nome / Identificação", required: true, placeholder: "Ex: Mestre Fulano - Grau X - Maio/2024" },
    ],
  },
  {
    columnsClassName: "grid gap-4 md:grid-cols-2",
    fields: [
      {
        name: "quantity",
        label: "Quantidade (L)",
        required: true,
        placeholder: "Ex: 10.5",
        inputProps: { type: "number", step: "0.01", min: "0", inputMode: "decimal" },
      },
      { name: "envase_date", label: "Data do Envase", required: true, inputProps: { type: "date" } },
    ],
  },
  {
    columnsClassName: "grid gap-4 md:grid-cols-2",
    fields: [
      { name: "master", label: "Mestre do Preparo", required: true, suggestMembers: true, placeholder: "Nome do mestre" },
      { name: "auxiliary", label: "Auxiliar", suggestMembers: true, placeholder: "Nome do auxiliar (opcional)" },
    ],
  },
  {
    columnsClassName: "grid gap-4 md:grid-cols-3",
    fields: [
      { name: "mensageiro", label: "Mensageiro", suggestMembers: true, placeholder: "Nome do mensageiro" },
      { name: "responsavel_chacrona", label: "Resp. Chacrona", suggestMembers: true, placeholder: "Responsável pela chacrona" },
      { name: "responsavel_baticao", label: "Resp. Batição", suggestMembers: true, placeholder: "Responsável pela batição" },
    ],
  },
  {
    columnsClassName: "grid gap-4 md:grid-cols-2",
    fields: [
      { name: "mariri_species", label: "Espécie do Mariri", placeholder: "Opcional" },
      { name: "chacrona_species", label: "Espécie da Chacrona", placeholder: "Opcional" },
    ],
  },
  {
    columnsClassName: "",
    fields: [
      { name: "registered_by_name", label: "Registrado por", suggestMembers: true, placeholder: "Seu nome (opcional)" },
    ],
  },
];

export default function NovaEntrada() {
  const navigate = useNavigate();
  const createVegetal = useCreateVegetal();
  const memberQuery = useMembers();
  const { data: members } = memberQuery;
  const [formData, setFormData] = useState<VegetalEntryForm>(EMPTY_VEGETAL_ENTRY_FORM);

  const updateField = (name: keyof VegetalEntryForm, value: string) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (createVegetal.isPending) return;

    const result = buildVegetalInput(formData);
    if (result.ok === false) {
      toast.error(result.error);
      return;
    }

    createVegetal.mutate(result.vegetal, {
      onSuccess: () => navigate(STOCK_ROUTE),
    });
  };

  // Nomes exibidos podem coincidir (ex.: "Mestre João" e "M. João").
  const memberNames = [...new Set(members?.map(getMemberDisplayName) ?? [])];

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {memberQuery.isError && <QueryError error={memberQuery.error} onRetry={() => void memberQuery.refetch()} />}
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
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
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {FIELD_GROUPS.map((group) => {
                const fields = group.fields.map((field) => (
                  <VegetalEntryField
                    key={field.name}
                    field={field}
                    value={formData[field.name]}
                    onChange={updateField}
                  />
                ));
                return group.columnsClassName
                  ? <div key={group.fields[0].name} className={group.columnsClassName}>{fields}</div>
                  : fields;
              })}

              <datalist id={MEMBER_SUGGESTIONS_LIST_ID}>
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
