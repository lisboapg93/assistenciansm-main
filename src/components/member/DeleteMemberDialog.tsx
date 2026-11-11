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
import { useDeleteMember, type Member } from "@/hooks/useMembers";
import { getMemberDisplayName } from "@/lib/memberDisplay";

interface DeleteMemberDialogProps {
  member: Member | null;
  onClose: () => void;
}

export function DeleteMemberDialog({ member, onClose }: DeleteMemberDialogProps) {
  const deleteMember = useDeleteMember();

  const handleDelete = () => {
    if (!member || deleteMember.isPending) return;
    deleteMember.mutate(member, { onSettled: onClose });
  };

  return (
    <AlertDialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o membro "{member ? getMemberDisplayName(member) : ""}"? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMember.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMember.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
