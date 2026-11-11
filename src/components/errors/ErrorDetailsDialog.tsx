import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBrazilianDateTime } from "@/lib/date";
import {
  explainStoredError,
  getTechnicalDiagnostic,
  metadataText,
} from "@/lib/errorLogEntry";
import type { ErrorEntry } from "@/lib/errorLogEntry";

const EMPTY_VALUE = "—";

function DetailField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <p className={className}>
      <span className="text-muted-foreground">{label}:</span>
      <br />
      {children}
    </p>
  );
}

function ExplanationField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p>
      <span className="font-medium">{label}</span>
      <br />
      {children}
    </p>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function ErrorDetails({ entry }: { entry: ErrorEntry }) {
  const explanation = explainStoredError(entry);
  const diagnostic = getTechnicalDiagnostic(entry);
  const constraint = metadataText(entry.metadata, "error_constraint");
  const hasOriginalDiagnostic = Boolean(diagnostic?.mensagem_original);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Detalhes do erro
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <ExplanationField label="Categoria">{explanation.category}</ExplanationField>
          <ExplanationField label="O que aconteceu">{explanation.summary}</ExplanationField>
          <ExplanationField label="Onde">{explanation.location}</ExplanationField>
          <ExplanationField label="Causa provável">{explanation.cause}</ExplanationField>
          <ExplanationField label="Como agir">{explanation.recommendedAction}</ExplanationField>
          {!hasOriginalDiagnostic && (
            <p className="text-muted-foreground">
              Causa inferida pelo código e local registrados; este erro antigo não guardou diagnóstico original.
            </p>
          )}
        </div>
        <div className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-2">
          <DetailField label="Data e hora">{formatBrazilianDateTime(entry.occurredAt, true)}</DetailField>
          <DetailField label="Tipo">{entry.source}</DetailField>
          <DetailField label="Operação">{entry.operation || EMPTY_VALUE}</DetailField>
          <DetailField label="Entidade">{entry.entity || EMPTY_VALUE}</DetailField>
          <DetailField label="Local" className="sm:col-span-2">{entry.location}</DetailField>
          {entry.code && <DetailField label="Código">{entry.code}</DetailField>}
          {constraint && <DetailField label="Regra do banco">{constraint}</DetailField>}
          {entry.userId && <DetailField label="Conta">{entry.userId}</DetailField>}
        </div>
        <div>
          <p className="mb-1 font-medium">Mensagem</p>
          <p className="rounded-lg border p-3 text-muted-foreground">{entry.message}</p>
        </div>
        {diagnostic && <JsonBlock title="Diagnóstico técnico seguro" value={diagnostic} />}
        {entry.inputPayload && <JsonBlock title="Dados enviados" value={entry.inputPayload} />}
        <JsonBlock title="Metadados" value={entry.metadata} />
      </div>
    </>
  );
}

export function ErrorDetailsDialog({ entry, onClose }: { entry: ErrorEntry | null; onClose: () => void }) {
  return (
    <Dialog open={!!entry} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {entry && <ErrorDetails entry={entry} />}
      </DialogContent>
    </Dialog>
  );
}
