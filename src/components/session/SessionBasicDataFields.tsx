import { useId } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberAutocompleteInput } from "@/components/session/MemberAutocompleteInput";
import { getMemberDisplayName } from "@/lib/memberDisplay";
import { allowsTransmission } from "@/lib/sessionData";
import { requiresExplanadorLeitor } from "@/lib/sessionForm";
import type { InvalidRoleFields, SessionBasicData } from "@/lib/sessionForm";
import {
  getDirigenteRuleDescription,
  getEligibleDirigentes,
  getEligibleExplanadores,
  getEligibleMestresAssistentes,
} from "@/lib/sessionRoleEligibility";
import type { MemberRoleData } from "@/lib/sessionRoleEligibility";
import { cn } from "@/lib/utils";
import { SESSION_TYPES } from "@/types/database";

const INVALID_FIELD_CLASS = "border-destructive focus-visible:ring-destructive";

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <Label>
      {children} <span className="text-destructive">*</span>
    </Label>
  );
}

interface SessionBasicDataFieldsProps {
  value: SessionBasicData;
  onChange: Dispatch<SetStateAction<SessionBasicData>>;
  members: MemberRoleData[];
  invalidFields: InvalidRoleFields;
  /** O cadastro pede quem registrou; a edição não altera esse campo. */
  showRegisteredBy?: boolean;
}

export function SessionBasicDataFields({
  value,
  onChange,
  members,
  invalidFields,
  showRegisteredBy = false,
}: SessionBasicDataFieldsProps) {
  const transmissionCheckboxId = useId();
  const update = (changes: Partial<SessionBasicData>) => onChange((current) => ({ ...current, ...changes }));

  const showExplanadorLeitor = requiresExplanadorLeitor(value.type);
  const showTransmissionOption = allowsTransmission(value.type);
  const dirigenteOptions = getEligibleDirigentes(value.type, members, value.is_transmissao_assistencia)
    .map(getMemberDisplayName);
  const dirigenteRule = getDirigenteRuleDescription(value.type, value.is_transmissao_assistencia);
  const memberNames = members.map(getMemberDisplayName);

  const handleTypeChange = (type: string) => onChange((current) => {
    // Tipos sem transmissão descartam a marcação e o segundo dirigente.
    const transmissionAllowed = allowsTransmission(type);
    return {
      ...current,
      type,
      is_transmissao_assistencia: transmissionAllowed && current.is_transmissao_assistencia,
      segundo_dirigente: transmissionAllowed ? current.segundo_dirigente : "",
    };
  });

  const handleTransmissionChange = (enabled: boolean) => onChange((current) => ({
    ...current,
    is_transmissao_assistencia: enabled,
    segundo_dirigente: enabled ? current.segundo_dirigente : "",
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <RequiredLabel>Data</RequiredLabel>
          <Input
            type="date"
            value={value.date}
            onChange={(e) => update({ date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel>Tipo de Sessão</RequiredLabel>
          <Select value={value.type} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {SESSION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showTransmissionOption && (
        <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
          <Checkbox
            id={transmissionCheckboxId}
            checked={value.is_transmissao_assistencia}
            onCheckedChange={(checked) => handleTransmissionChange(checked === true)}
          />
          <Label htmlFor={transmissionCheckboxId} className="cursor-pointer font-medium">
            Sessão da Transmissão da Assistência
          </Label>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <RequiredLabel>Dirigente</RequiredLabel>
          <MemberAutocompleteInput
            options={dirigenteOptions}
            value={value.dirigente}
            onValueChange={(dirigente) => update({ dirigente })}
            placeholder="Nome do dirigente"
            aria-invalid={invalidFields.dirigente}
            className={cn(invalidFields.dirigente && INVALID_FIELD_CLASS)}
          />
          <p className="text-xs text-muted-foreground">{dirigenteRule}</p>
        </div>

        {value.is_transmissao_assistencia && (
          <div className="space-y-2 animate-fade-in">
            <RequiredLabel>Segundo Dirigente</RequiredLabel>
            <MemberAutocompleteInput
              options={dirigenteOptions}
              value={value.segundo_dirigente}
              onValueChange={(segundo_dirigente) => update({ segundo_dirigente })}
              placeholder="Nome do segundo dirigente"
              aria-invalid={invalidFields.segundoDirigente}
              className={cn(invalidFields.segundoDirigente && INVALID_FIELD_CLASS)}
            />
            <p className="text-xs text-muted-foreground">{dirigenteRule}</p>
          </div>
        )}

        <div className="space-y-2">
          <RequiredLabel>Mestre Assistente</RequiredLabel>
          <MemberAutocompleteInput
            options={getEligibleMestresAssistentes(members).map(getMemberDisplayName)}
            value={value.mestre_assistente}
            onValueChange={(mestre_assistente) => update({ mestre_assistente })}
            placeholder="Nome do mestre assistente"
            aria-invalid={invalidFields.mestreAssistente}
            className={cn(invalidFields.mestreAssistente && INVALID_FIELD_CLASS)}
          />
          <p className="text-xs text-muted-foreground">Apenas membros do Quadro de Mestres.</p>
        </div>
      </div>

      {showRegisteredBy && (
        <div className="space-y-2">
          <RequiredLabel>Registrado por</RequiredLabel>
          <MemberAutocompleteInput
            options={memberNames}
            value={value.registered_by_name}
            onValueChange={(registered_by_name) => update({ registered_by_name })}
            placeholder="Nome de quem registrou"
          />
        </div>
      )}

      {showExplanadorLeitor && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <RequiredLabel>Explanador</RequiredLabel>
            <MemberAutocompleteInput
              options={getEligibleExplanadores(members).map(getMemberDisplayName)}
              value={value.explanador}
              onValueChange={(explanador) => update({ explanador })}
              placeholder="Nome do explanador"
              aria-invalid={invalidFields.explanador}
              className={cn(invalidFields.explanador && INVALID_FIELD_CLASS)}
            />
          </div>
          <div className="space-y-2">
            <RequiredLabel>Leitor</RequiredLabel>
            <MemberAutocompleteInput
              options={memberNames}
              value={value.leitor}
              onValueChange={(leitor) => update({ leitor })}
              placeholder="Nome do leitor"
            />
          </div>
        </div>
      )}
    </div>
  );
}
