import { useState, useRef, useEffect } from "react";
import type { ChangeEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { CsvImportPreview } from "@/components/session/CsvImportPreview";
import { getErrorMessage } from "@/lib/errorLogging";
import { useMembers } from "@/hooks/useMembers";
import { useVegetais } from "@/hooks/useVegetais";
import { useInvalidateSessionRegistration } from "@/hooks/useSessions";
import { registerSessionWithConsumption } from "@/lib/sessionRegistration";
import { useAuthContext } from "@/hooks/useAuthContext";
import { decodeCsvBuffer } from "@/lib/sessionCsv";
import {
  buildSessionCsvTemplate,
  CSV_TEMPLATE_FILE_NAME,
  parseSessionCsvText,
  toSessionRegistration,
} from "@/lib/sessionCsvImport";
import { validateSessionCsvRow } from "@/lib/sessionCsvValidation";
import type { ParsedSession } from "@/lib/sessionCsvValidation";
import { formatLiters } from "@/lib/stockQuantity";

type ImportStep = "upload" | "preview" | "result";
type UploadTab = "file" | "paste";

interface ParseInfo {
  delimiter?: string;
  encoding?: string;
  parseErrors: string[];
}

interface ImportResult {
  success: number;
  failed: number;
}

const EMPTY_IMPORT_RESULT: ImportResult = { success: 0, failed: 0 };
const PASTED_TEXT_ENCODING_LABEL = "texto colado";

const STEP_DESCRIPTIONS: Record<ImportStep, string> = {
  upload: "Selecione um arquivo CSV para importar sessões em lote.",
  preview: "Revise os dados antes de importar.",
  result: "Resultado da importação.",
};

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando ao menos uma sessão foi importada (o cache já é invalidado aqui). */
  onSuccess?: () => void;
}

function downloadTemplate() {
  const blob = new Blob([buildSessionCsvTemplate()], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = CSV_TEMPLATE_FILE_NAME;
  link.click();
  // Libera o blob depois que o navegador iniciar o download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  toast.success("Modelo baixado com sucesso!");
}

export function CsvImportDialog({ open, onOpenChange, onSuccess }: CsvImportDialogProps) {
  const { isEditor } = useAuthContext();
  const invalidateRegistrationQueries = useInvalidateSessionRegistration();
  const importingRef = useRef(false);
  const cancelledRef = useRef(false);
  const importRunRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: members } = useMembers();
  const { data: vegetais } = useVegetais();
  const [parsedData, setParsedData] = useState<ParsedSession[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<ImportStep>("upload");
  const [importResult, setImportResult] = useState<ImportResult>(EMPTY_IMPORT_RESULT);
  const [uploadTab, setUploadTab] = useState<UploadTab>("file");
  const [pasteText, setPasteText] = useState("");
  const [parseInfo, setParseInfo] = useState<ParseInfo | null>(null);

  // Perder o papel de editor (ou desmontar) interrompe a importação em curso.
  useEffect(() => {
    if (!isEditor) {
      cancelledRef.current = true;
      importRunRef.current += 1;
      importingRef.current = false;
      setIsImporting(false);
    }
  }, [isEditor]);
  useEffect(() => () => {
    cancelledRef.current = true;
    importRunRef.current += 1;
  }, []);

  const loadTextToPreview = (text: string, encoding: string) => {
    if (!members || !vegetais) {
      toast.error("Aguarde o carregamento dos membros e lotes de vegetal antes de importar.");
      return;
    }

    const result = parseSessionCsvText(text);
    setParseInfo({ delimiter: result.delimiter, encoding, parseErrors: result.parseErrors });
    if (result.error) {
      toast.error(result.error);
      setParsedData([]);
      return;
    }

    setParsedData(result.rows.map(({ values, rowNumber }) => ({
      ...validateSessionCsvRow(values, members, vegetais),
      rowNumber,
    })));
    setStep("preview");
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const selectedFile = input.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV");
      return;
    }

    try {
      const { text, encoding } = decodeCsvBuffer(await selectedFile.arrayBuffer());
      loadTextToPreview(text, encoding);
    } catch (err) {
      console.error("Erro ao ler CSV:", err);
      toast.error("Não foi possível ler o arquivo CSV");
    } finally {
      // Sem isso, reselecionar o mesmo arquivo corrigido não dispara "change".
      input.value = "";
    }
  };

  const handlePastePreview = () => {
    if (!pasteText.trim()) {
      toast.error("Cole o conteúdo do CSV primeiro");
      return;
    }

    loadTextToPreview(pasteText, PASTED_TEXT_ENCODING_LABEL);
  };

  const handleImport = async () => {
    if (!isEditor || importingRef.current) return;
    const validSessions = parsedData.filter((s) => s.isValid);
    if (validSessions.length === 0) {
      toast.error("Nenhuma sessão válida para importar");
      return;
    }

    importingRef.current = true;
    cancelledRef.current = false;
    const importRun = ++importRunRef.current;
    setIsImporting(true);
    let successCount = 0;
    let failedCount = 0;

    for (const session of validSessions) {
      if (cancelledRef.current || importRun !== importRunRef.current) break;
      try {
        const registration = toSessionRegistration(session);
        await registerSessionWithConsumption(registration.session, registration.sources, registration.memberNames);
        successCount++;
      } catch (err) {
        toast.error(`Linha ${session.rowNumber}: ${getErrorMessage(err)}`);
        failedCount++;
      }
    }

    // As sessões já gravadas mudaram o estoque mesmo se a importação foi
    // interrompida (diálogo desmontado ou papel revogado): atualiza o cache.
    if (successCount > 0) void invalidateRegistrationQueries();

    if (importRun !== importRunRef.current) return;
    importingRef.current = false;
    if (!cancelledRef.current) {
      setImportResult({ success: successCount, failed: failedCount });
      setStep("result");
      setIsImporting(false);
    }

    if (successCount > 0) {
      onSuccess?.();
    }
  };

  const resetDialog = () => {
    setParsedData([]);
    setPasteText("");
    setUploadTab("file");
    setParseInfo(null);
    setStep("upload");
    setImportResult(EMPTY_IMPORT_RESULT);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (importingRef.current) return;
    resetDialog();
    onOpenChange(false);
  };

  const validCount = parsedData.filter((s) => s.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar Sessões via CSV
          </DialogTitle>
          <DialogDescription>{STEP_DESCRIPTIONS[step]}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === "upload" && (
            <div className="space-y-6 py-4">
              {parseInfo?.parseErrors?.length ? (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">
                    <p className="font-medium">Não foi possível ler o CSV:</p>
                    <ul className="mt-1 list-disc pl-5">
                      {parseInfo.parseErrors.map((message, index) => <li key={index}>{message}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              <Tabs
                value={uploadTab}
                onValueChange={(value) => {
                  if (value === "file" || value === "paste") setUploadTab(value);
                }}
              >
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="file">Arquivo CSV</TabsTrigger>
                  <TabsTrigger value="paste">Colar conteúdo</TabsTrigger>
                </TabsList>

                <TabsContent value="file" className="mt-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <Label htmlFor="csv-file" className="cursor-pointer">
                      <div className="space-y-2">
                        <p className="text-lg font-medium">
                          Clique para selecionar ou arraste o arquivo CSV
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Formato aceito: .csv (separado por ; ou ,)
                        </p>
                      </div>
                    </Label>
                    <Input
                      id="csv-file"
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="paste" className="mt-4">
                  <div className="space-y-3">
                    <Label htmlFor="csv-paste">Conteúdo do CSV</Label>
                    <Textarea
                      id="csv-paste"
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="Cole aqui o conteúdo do CSV (incluindo o cabeçalho, se houver)"
                      className="min-h-[180px]"
                    />
                    <Button onClick={handlePastePreview} disabled={!pasteText.trim()}>
                      Pré-visualizar
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Formato esperado do CSV:</p>
                  <p className="text-sm text-muted-foreground mb-2">
                    Inclua a coluna fontes_vegetal. Use ID_DO_LOTE para uma sessão sem união, ou ID_DO_LOTE:quantidade|OUTRO_ID:quantidade para união. Cada importação abate o estoque real.
                  </p>
                  <div className="text-sm text-muted-foreground max-h-28 overflow-auto mb-2">
                    {vegetais?.length ? vegetais.map((vegetal) => (
                      <p key={vegetal.id}>{vegetal.name} ({formatLiters(vegetal.quantity)}): <code className="select-all">{vegetal.id}</code></p>
                    )) : "Nenhum lote disponível no momento."}
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                    <Download className="h-4 w-4" />
                    Baixar Modelo CSV
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4 py-4">
              {parseInfo && (
                <Alert>
                  <AlertDescription className="text-sm">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Delimitador: <span className="font-medium">{parseInfo.delimiter || "-"}</span>
                      </span>
                      {parseInfo.encoding && (
                        <span>
                          Leitura: <span className="font-medium">{parseInfo.encoding}</span>
                        </span>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <CsvImportPreview sessions={parsedData} />
            </div>
          )}

          {step === "result" && (
            <div className="space-y-6 py-8 text-center">
              {importResult.success > 0 ? (
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              ) : (
                <XCircle className="h-16 w-16 text-destructive mx-auto" />
              )}
              <div>
                <p className="text-xl font-semibold">Importação Concluída</p>
                <p className="text-muted-foreground mt-2">
                  {importResult.success} sessões importadas com sucesso
                  {importResult.failed > 0 && `, ${importResult.failed} falharam`}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")} disabled={isImporting}>
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || isImporting}
              >
                {isImporting ? "Importando..." : `Importar ${validCount} Sessões`}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
