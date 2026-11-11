import { ArrowRight } from "lucide-react";
import { formatBrazilianDateTime } from "@/lib/date";
import { getAuditChanges, isAuditData } from "@/lib/auditData";
import type { AuditData } from "@/lib/auditData";

const auditFieldLabels: Record<string, string> = {
  id: "Identificação",
  name: "Nome",
  grau: "Grau",
  is_socio_nucleo: "Sócio do Núcleo",
  date: "Data",
  type: "Tipo",
  quantity: "Quantidade",
  initial_quantity: "Quantidade inicial",
  envase_date: "Data de envase",
  master: "Mestre responsável",
  auxiliary: "Auxiliar",
  mariri_species: "Espécie de mariri",
  chacrona_species: "Espécie de chacrona",
  is_archived: "Arquivado",
  registered_by_name: "Cadastrado por",
  mensageiro: "Mensageiro",
  responsavel_chacrona: "Responsável pela chacrona",
  responsavel_baticao: "Responsável pela batição",
  dirigente: "Dirigente",
  explanador: "Explanador",
  leitor: "Leitor",
  mestre_assistente: "Mestre assistente",
  observation: "Observação",
  participants: "Participantes",
  total_participants: "Total de participantes",
  consumption: "Consumo",
  total_consumed: "Total consumido",
  is_united: "União de vegetal",
  sources: "Fontes",
  vegetal_id: "Lote de vegetal",
  vegetal_name: "Nome do vegetal",
  amount_available: "Quantidade disponível",
  has_photo: "Possui foto",
  has_audio: "Possui áudio",
  session_id: "Sessão relacionada",
  details: "Detalhes",
  created_at: "Cadastrado em",
  updated_at: "Atualizado em",
  mestres: "Mestres",
  conselheiros: "Conselheiros",
  instrutivo: "Instrutivo",
  socios: "Sócios",
  visitantes: "Visitantes",
  jovens: "Jovens",
};

function getAuditFieldLabel(field: string) {
  if (auditFieldLabels[field]) return auditFieldLabels[field];

  return field
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function AuditValue({ field, value }: { field: string; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">Não informado</span>;
  }

  if (typeof value === "boolean") return <>{value ? "Sim" : "Não"}</>;
  if (typeof value === "number") return <>{value.toLocaleString("pt-BR")}</>;

  if (typeof value === "string") {
    if (field.endsWith("_at")) return <>{formatBrazilianDateTime(value)}</>;
    if (field === "date" || field.endsWith("_date")) return <>{formatCalendarDate(value)}</>;
    return <>{value}</>;
  }

  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2">
        {value.map((item, index) => (
          <li key={`${field}-${index}`} className="rounded border bg-background p-2">
            {isAuditData(item) ? <AuditDataDetails data={item} /> : <AuditValue field={field} value={item} />}
          </li>
        ))}
      </ul>
    );
  }

  if (isAuditData(value)) return <AuditDataDetails data={value} />;

  return <>{String(value)}</>;
}

export function AuditDataDetails({ data }: { data: AuditData }) {
  return (
    <dl className="divide-y rounded-lg border bg-background">
      {Object.entries(data).map(([field, value]) => (
        <div key={field} className="grid gap-1 p-3 sm:grid-cols-[180px_1fr] sm:gap-3">
          <dt className="text-muted-foreground">{getAuditFieldLabel(field)}</dt>
          <dd className="break-words"><AuditValue field={field} value={value} /></dd>
        </div>
      ))}
    </dl>
  );
}

export function AuditChangesDetails({ oldData, newData }: { oldData: AuditData; newData: AuditData }) {
  const changes = getAuditChanges(oldData, newData);

  if (changes.length === 0) {
    return <p className="rounded-lg border bg-muted/50 p-3 text-muted-foreground">Nenhuma alteração de dado identificada.</p>;
  }

  return (
    <dl className="divide-y rounded-lg border bg-background">
      {changes.map(({ field, oldValue, newValue }) => (
        <div key={field} className="grid gap-2 p-3 sm:grid-cols-[180px_1fr] sm:gap-3">
          <dt className="text-muted-foreground">{getAuditFieldLabel(field)}</dt>
          <dd className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="break-words">
              <span className="text-xs text-muted-foreground">Antes</span>
              <div><AuditValue field={field} value={oldValue} /></div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" aria-label="alterado para" />
            <div className="break-words">
              <span className="text-xs text-muted-foreground">Depois</span>
              <div><AuditValue field={field} value={newValue} /></div>
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}
