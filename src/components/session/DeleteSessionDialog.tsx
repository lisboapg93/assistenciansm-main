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
import { formatSessionDate } from "@/lib/sessionDisplay";
import type { Session } from "@/types/database";

interface DeleteSessionDialogProps {
  session: Session | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteSessionDialog({ session, isDeleting, onCancel, onConfirm }: DeleteSessionDialogProps) {
  return (
    <AlertDialog open={!!session} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir sessão?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. A sessão
            {session && (
              <>
                {" "}de{" "}
                {formatSessionDate(session.date)}{" "}
                ({session.type})
              </>
            )}{" "}
            será removida permanentemente do histórico.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
