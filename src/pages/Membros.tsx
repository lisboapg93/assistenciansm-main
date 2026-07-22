import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useMembers } from "@/hooks/useMembers";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Search, UserCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const GRAU_OPTIONS = [
  "Quadro de Mestre",
  "Corpo do Conselho",
  "Corpo Instrutivo",
  "Quadro de Sócios",
] as const;

type Grau = typeof GRAU_OPTIONS[number] | null;

interface MemberForm {
  name: string;
  is_socio_nucleo: boolean;
  grau: Grau;
}

export default function Membros() {
  const { data: members, isLoading } = useMembers();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<{ id: string } | null>(null);
  const [deletingMember, setDeletingMember] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState<MemberForm>({ name: "", is_socio_nucleo: false, grau: null });
  const [isSaving, setIsSaving] = useState(false);

  const filteredMembers = members?.filter((member) =>
    member.name.toLowerCase().includes(search.toLowerCase())
  );

  const socioCount = members?.filter((m) => m.is_socio_nucleo).length ?? 0;

  const openCreateDialog = () => {
    setEditingMember(null);
    setForm({ name: "", is_socio_nucleo: false, grau: null });
    setIsDialogOpen(true);
  };

  const openEditDialog = (member: { id: string; name: string; is_socio_nucleo: boolean; grau: string | null }) => {
    setEditingMember({ id: member.id });
    setForm({ name: member.name, is_socio_nucleo: member.is_socio_nucleo, grau: member.grau as Grau });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (member: { id: string; name: string }) => {
    setDeletingMember(member);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error("Nome é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      if (editingMember) {
        const { error } = await supabase
          .from("members")
          .update({ name: trimmedName, is_socio_nucleo: form.is_socio_nucleo, grau: form.grau })
          .eq("id", editingMember.id);

        if (error) throw error;
        toast.success("Membro atualizado com sucesso");
      } else {
        // Check if name already exists
        const { data: existing } = await supabase
          .from("members")
          .select("id")
          .eq("name", trimmedName)
          .maybeSingle();

        if (existing) {
          toast.error("Já existe um membro com este nome");
          setIsSaving(false);
          return;
        }

        const { error } = await supabase
          .from("members")
          .insert({ name: trimmedName, is_socio_nucleo: form.is_socio_nucleo, grau: form.grau });

        if (error) throw error;
        toast.success("Membro adicionado com sucesso");
      }

      queryClient.invalidateQueries({ queryKey: ["members"] });
      setIsDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar membro");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMember) return;

    try {
      const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", deletingMember.id);

      if (error) throw error;
      toast.success("Membro excluído com sucesso");
      queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir membro");
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingMember(null);
    }
  };

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
          <Button onClick={openCreateDialog} className="gap-2">
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
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredMembers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {search ? "Nenhum membro encontrado" : "Nenhum membro cadastrado"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMembers?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
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
                          onClick={() => openEditDialog(member)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openDeleteDialog(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Editar Membro" : "Novo Membro"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Digite o nome do membro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grau">Grau</Label>
              <Select
                value={form.grau || "__none__"}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, grau: value === "__none__" ? null : value as Grau }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o grau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {GRAU_OPTIONS.map((grau) => (
                    <SelectItem key={grau} value={grau}>
                      {grau}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_socio_nucleo"
                checked={form.is_socio_nucleo}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_socio_nucleo: checked === true }))
                }
              />
              <Label htmlFor="is_socio_nucleo" className="cursor-pointer">
                Sócio do Núcleo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o membro "{deletingMember?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
