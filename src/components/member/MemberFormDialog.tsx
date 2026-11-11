import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSaveMember, type Member, type MemberInput } from "@/hooks/useMembers";
import {
  MEMBER_GRAU_OPTIONS,
  findMemberWithSameIdentity,
  getMemberDisplayName,
  usesDegreePrefix,
} from "@/lib/memberDisplay";

const NO_GRAU_VALUE = "__none__";
const EMPTY_MEMBER_FORM: MemberInput = { name: "", is_socio_nucleo: false, grau: null };

interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Membro em edição; `null` para cadastrar um novo. */
  member: Member | null;
  /** Lista usada para impedir identificações duplicadas. */
  members: Member[] | undefined;
}

/**
 * Formulário de cadastro/edição de membro. O estado é inicializado a partir de
 * `member`; o componente pai deve trocar a `key` ao abrir para outro membro.
 */
export function MemberFormDialog({ open, onOpenChange, member, members }: MemberFormDialogProps) {
  const saveMember = useSaveMember();
  const [form, setForm] = useState<MemberInput>(() =>
    member
      ? { name: member.name, is_socio_nucleo: member.is_socio_nucleo, grau: member.grau }
      : EMPTY_MEMBER_FORM,
  );
  const isEditing = Boolean(member);

  const handleSave = () => {
    if (saveMember.isPending) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("Nome é obrigatório");
      return;
    }

    const duplicateMember = findMemberWithSameIdentity(members, { name, grau: form.grau }, member?.id);
    if (duplicateMember) {
      toast.error(`Já existe um membro cadastrado como "${getMemberDisplayName(duplicateMember)}"`);
      return;
    }

    saveMember.mutate(
      { id: member?.id, member: { ...form, name } },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Membro" : "Novo Membro"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="member-name">Nome</Label>
            <Input
              id="member-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Digite o nome do membro"
            />
            {usesDegreePrefix(form.grau) && (
              <p className="text-xs text-muted-foreground">
                Será exibido como {getMemberDisplayName({ name: form.name.trim() || "Nome", grau: form.grau })}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-grau">Grau</Label>
            <Select
              value={form.grau || NO_GRAU_VALUE}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, grau: value === NO_GRAU_VALUE ? null : value }))
              }
            >
              <SelectTrigger id="member-grau">
                <SelectValue placeholder="Selecione o grau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_GRAU_VALUE}>Nenhum</SelectItem>
                {MEMBER_GRAU_OPTIONS.map((grau) => (
                  <SelectItem key={grau} value={grau}>
                    {grau}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="member-is-socio-nucleo"
              checked={form.is_socio_nucleo}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, is_socio_nucleo: checked === true }))
              }
            />
            <Label htmlFor="member-is-socio-nucleo" className="cursor-pointer">
              Sócio do Núcleo
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saveMember.isPending}>
            {saveMember.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
