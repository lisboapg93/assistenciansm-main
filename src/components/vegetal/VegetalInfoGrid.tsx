import { Vegetal } from "@/types/database";
import { MemberDisplayData, getMemberDisplayNameForValue } from "@/lib/memberDisplay";
import { formatEnvaseDate } from "@/lib/stockLots";
import { formatLiters } from "@/lib/stockQuantity";

const EMPTY_VALUE = "-";

interface VegetalInfoGridProps {
  vegetal: Vegetal;
  members?: MemberDisplayData[];
}

function InfoItem({ label, value, valueClassName = "" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`font-medium ${valueClassName}`.trim()}>{value}</p>
    </div>
  );
}

export function VegetalInfoGrid({ vegetal, members }: VegetalInfoGridProps) {
  const memberName = (value: string | null) =>
    value ? getMemberDisplayNameForValue(value, members) : EMPTY_VALUE;

  return (
    <div className="grid grid-cols-2 gap-4 py-4 border-y border-border">
      <InfoItem label="Mestre do Preparo" value={memberName(vegetal.master)} />
      <InfoItem label="Auxiliar" value={memberName(vegetal.auxiliary)} />
      <InfoItem label="Mensageiro" value={memberName(vegetal.mensageiro)} />
      <InfoItem label="Resp. Chacrona" value={memberName(vegetal.responsavel_chacrona)} />
      <InfoItem label="Resp. Batição" value={memberName(vegetal.responsavel_baticao)} />
      <InfoItem label="Data Envase" value={formatEnvaseDate(vegetal.envase_date)} />
      <InfoItem label="Quantidade Atual" value={formatLiters(vegetal.quantity)} valueClassName="text-primary" />
      <InfoItem label="Quantidade Inicial" value={formatLiters(vegetal.initial_quantity)} />
      <InfoItem label="Espécie Mariri" value={vegetal.mariri_species || EMPTY_VALUE} />
      <InfoItem label="Espécie Chacrona" value={vegetal.chacrona_species || EMPTY_VALUE} />
      <InfoItem label="Registrado por" value={memberName(vegetal.registered_by_name)} />
    </div>
  );
}
