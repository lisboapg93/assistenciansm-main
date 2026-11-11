import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useMembers, type Member } from "@/hooks/useMembers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Plus, Pencil, Trash2, Search, UserCheck } from "lucide-react";
import { filterMembersBySearch, getMemberDisplayName } from "@/lib/memberDisplay";
import { QueryError } from "@/components/QueryError";
import { MemberFormDialog } from "@/components/member/MemberFormDialog";
import { DeleteMemberDialog } from "@/components/member/DeleteMemberDialog";

const TABLE_COLUMN_COUNT = 4;

interface MemberFormState {
  open: boolean;
  member: Member | null;
  /** Muda a cada abertura para reiniciar o formulário sem perder a animação de fechamento. */
  key: number;
}

export default function Membros() {
  const { data: members, isLoading, isError, error: queryError, refetch } = useMembers();

  const [search, setSearch] = useState("");
  const [memberForm, setMemberForm] = useState<MemberFormState>({ open: false, member: null, key: 0 });
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);

  const filteredMembers = filterMembersBySearch(members, search);
  const socioCount = members?.filter((m) => m.is_socio_nucleo).length ?? 0;

  const openMemberForm = (member: Member | null) =>
    setMemberForm((prev) => ({ open: true, member, key: prev.key + 1 }));
  const closeMemberForm = () => setMemberForm((prev) => ({ ...prev, open: false }));

  if (isError && !members) return <MainLayout><QueryError error={queryError} onRetry={() => void refetch()} /></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Membros
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os membros cadastrados no sistema
            </p>
          </div>
          <Button onClick={() => openMemberForm(null)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Membro
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Total de Membros
            </div>
            <p className="text-2xl font-bold mt-1">{members?.length ?? 0}</p>
          </div>
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <UserCheck className="h-4 w-4" />
              Sócios do Núcleo
            </div>
            <p className="text-2xl font-bold mt-1">{socioCount}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar membros..."
            aria-label="Buscar membros"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Grau</TableHead>
                <TableHead className="w-[140px] text-center">Sócio do Núcleo</TableHead>
                <TableHead className="w-[100px] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={TABLE_COLUMN_COUNT} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredMembers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={TABLE_COLUMN_COUNT} className="text-center py-8 text-muted-foreground">
                    {search ? "Nenhum membro encontrado" : "Nenhum membro cadastrado"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers?.map((member) => {
                  const displayName = getMemberDisplayName(member);
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{displayName}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {member.grau || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {member.is_socio_nucleo && (
                          <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            <UserCheck className="h-3 w-3" />
                            Sócio
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${displayName}`}
                            onClick={() => openMemberForm(member)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Excluir ${displayName}`}
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingMember(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <MemberFormDialog
        key={memberForm.key}
        open={memberForm.open}
        onOpenChange={(open) => !open && closeMemberForm()}
        member={memberForm.member}
        members={members}
      />

      <DeleteMemberDialog member={deletingMember} onClose={() => setDeletingMember(null)} />
    </MainLayout>
  );
}
