import type { ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AuditChangesDetails, AuditDataDetails } from "@/components/activity/AuditDetails";
import type { AuditLog } from "@/hooks/useAuditLogs";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  getAuditActorName,
  getAuditOriginLabel,
} from "@/lib/auditLabels";
import { formatBrazilianDateTime } from "@/lib/date";

function DetailField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <p className={className}>
      <span className="text-muted-foreground">{label}:</span>
      <br />
      {children}
    </p>
  );
}

function AuditDataSection({ entry }: { entry: AuditLog }) {
  if (entry.action === "update" && entry.oldData && entry.newData) {
    return (
      <div>
        <p className="mb-1 font-medium">Alterações realizadas</p>
        <AuditChangesDetails oldData={entry.oldData} newData={entry.newData} />
      </div>
    );
  }

  if (entry.action === "delete" && entry.oldData) {
    return (
      <div>
        <p className="mb-1 font-medium">Dados excluídos</p>
        <AuditDataDetails data={entry.oldData} />
      </div>
    );
  }

  return null;
}

function AuditEntryDetails({ entry }: { entry: AuditLog }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          Detalhes da atividade
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
          <DetailField label="Data e hora">{formatBrazilianDateTime(entry.occurredAt)}</DetailField>
          <DetailField label="Responsável">{getAuditActorName(entry)}</DetailField>
          <DetailField label="Ação">{AUDIT_ACTION_LABELS[entry.action]}</DetailField>
          <DetailField label="Item">{AUDIT_ENTITY_LABELS[entry.entityType]}</DetailField>
          <DetailField label="Origem">{getAuditOriginLabel(entry)}</DetailField>
          {entry.actorId && (
            <DetailField label="ID da conta" className="break-all">{entry.actorId}</DetailField>
          )}
          {entry.relatedSessionId && (
            <DetailField label="Sessão relacionada" className="sm:col-span-2 break-all">
              {entry.relatedSessionId}
            </DetailField>
          )}
          <DetailField label="Identificação" className="sm:col-span-2 break-all">{entry.entityId}</DetailField>
        </div>
        <AuditDataSection entry={entry} />
      </div>
    </>
  );
}

export function AuditEntryDialog({ entry, onClose }: { entry: AuditLog | null; onClose: () => void }) {
  return (
    <Dialog open={!!entry} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {entry && <AuditEntryDetails entry={entry} />}
      </DialogContent>
    </Dialog>
  );
}
