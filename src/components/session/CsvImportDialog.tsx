import { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import type { Participants } from "@/types/database";
import { getErrorMessage } from "@/lib/errorLogging";
import { useMembers } from "@/hooks/useMembers";
import { useVegetais } from "@/hooks/useVegetais";
import { registerSessionWithConsumption } from "@/lib/sessionRegistration";
import { useAuthContext } from "@/contexts/AuthContext";
import { formatTransmissionObservation } from "@/lib/sessionData";
import { CSV_TEMPLATE_HEADERS, decodeCsvBuffer, mapSessionCsvRows } from "@/lib/sessionCsv";
import { validateSessionCsvRow } from "@/lib/sessionCsvValidation";
import type { ParsedSession } from "@/lib/sessionCsvValidation";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CsvImportDialog({ open, onOpenChange, onSuccess }: CsvImportDialogProps) {
  const { isEditor } = useAuthContext();
  const importingRef = useRef(false);
  const cancelledRef = useRef(false);
  const importRunRef = useRef(0);
  const { data: members } = useMembers();
  const { data: vegetais } = useVegetais();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSession[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [importResult, setImportResult] = useState<{ success: number; failed: number }>({
    success: 0,
    failed: 0,
  });
  const [uploadTab, setUploadTab] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const [parseInfo, setParseInfo] = useState<
    | {
        delimiter?: string;
        encoding?: string;
        parseErrors?: string[];
      }
    | null
  >(null);

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const delimiter = ";";
    const headers = CSV_TEMPLATE_HEADERS.join(delimiter);
    const exampleRow = [
      "2025-01-15",
      "Primeira Escala",
      "false",
      "",
      "João Silva",
      "Maria Santos",
      "Carlos Souza",
      "Pedro Costa",
      "Ana Lima",
      "5",
      "3",
      "2",
      "20",
      "5",
      "3",
      "2,5",
      "false",
      "true",
      "false",
      "Observações da sessão",
      "ID_DO_LOTE:2,5",
    ].join(delimiter);

    const csvContent = `\uFEFF${headers}\n${exampleRow}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modelo_importacao_sessoes.csv";
    link.click();
    toast.success("Modelo baixado com sucesso!");
  };

  const parseCSV = (text: string, opts?: { encoding?: string }): ParsedSession[] => {
    const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const trimmed = cleaned.trim();

    if (!trimmed) {
      toast.error("O conteúdo do CSV está vazio");
      return [];
    }

    // Excel às vezes adiciona uma primeira linha do tipo: sep=;
    let effectiveText = trimmed;
    let forcedDelimiter: string | undefined;

    const firstLine = effectiveText.split("\n")[0]?.trim() || "";
    if (/^sep=./i.test(firstLine)) {
      forcedDelimiter = firstLine.slice(4, 5);
      effectiveText = effectiveText.split("\n").slice(1).join("\n");
    }

    const result = Papa.parse<string[]>(effectiveText, {
      delimiter: forcedDelimiter ?? "", // "" => auto-detect
      skipEmptyLines: "greedy",
      dynamicTyping: false,
    });

    const parseErrors = (result.errors ?? []).map((e) => {
      const rowLabel = typeof e.row === "number" ? `linha ${e.row + 1}` : "linha ?";
      return `${rowLabel}: ${e.message}`;
    });

    if (parseErrors.length > 0) {
      setParseInfo({ delimiter: forcedDelimiter ?? result.meta.delimiter, encoding: opts?.encoding, parseErrors: parseErrors.slice(0, 5) });
      toast.error("O CSV contém linhas com formato inválido. Corrija o arquivo e tente novamente.");
      return [];
    }

    const rows = (result.data ?? [])
      .filter((r): r is string[] => Array.isArray(r))
      .map((r) => r.map((c) => String(c ?? "").trim()))
      .filter((r) => r.some((c) => c !== ""));

    if (rows.length < 1) {
      setParseInfo({
        delimiter: forcedDelimiter ?? result.meta.delimiter,
        encoding: opts?.encoding,
        parseErrors,
      });
      toast.error("Não foi possível ler nenhuma linha do CSV");
      return [];
    }

    const mapping = mapSessionCsvRows(rows);

    setParseInfo({
      delimiter: forcedDelimiter ?? result.meta.delimiter,
      encoding: opts?.encoding,
      parseErrors: parseErrors.length ? parseErrors.slice(0, 5) : [],
    });

    if (mapping.error) {
      setParseInfo({
        delimiter: forcedDelimiter ?? result.meta.delimiter,
        encoding: opts?.encoding,
        parseErrors: [mapping.error],
      });
      toast.error(mapping.error);
      return [];
    }

    if (mapping.rows.length < 1) {
      toast.error("O CSV deve ter pelo menos uma linha de dados além do cabeçalho");
      return [];
    }

    return mapping.rows.map(({ values, rowNumber }) => ({
      ...validateSessionCsvRow(values, members || [], vegetais || []),
      rowNumber,
    }));
  };

  const loadTextToPreview = (text: string, meta?: { encoding?: string }) => {
    if (!members || !vegetais) {
      toast.error("Aguarde o carregamento dos membros e lotes de vegetal antes de importar.");
      return;
    }
    const parsed = parseCSV(text, meta);
    setParsedData(parsed);
    if (parsed.length > 0) {
      setStep("preview");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const selectedFile = input.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV");
      return;
    }

    setFile(selectedFile);

    try {
      const { text, encoding } = decodeCsvBuffer(await selectedFile.arrayBuffer());
      loadTextToPreview(text, { encoding });
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

    loadTextToPreview(pasteText, { encoding: "texto colado" });
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
        const participants: Participants = {
          mestres: session.mestres,
          conselheiros: session.conselheiros,
          instrutivo: session.instrutivo,
          socios: session.socios,
          visitantes: session.visitantes,
          jovens: session.jovens,
        };

        const totalParticipants = Object.values(participants).reduce((a, b) => a + b, 0);

        const observation = formatTransmissionObservation(
          session.is_transmissao_assistencia ? session.segundo_dirigente ?? "" : null,
          session.observation || "",
        ) || null;

        await registerSessionWithConsumption({
          date: session.date,
          type: session.type,
          dirigente: session.dirigente,
          mestre_assistente: session.mestre_assistente,
          registered_by_name: session.registered_by_name,
          explanador: session.explanador || null,
          leitor: session.leitor || null,
          participants,
          total_participants: totalParticipants,
          total_consumed: session.total_consumed,
          is_united: session.is_united,
          has_photo: session.has_photo,
          has_audio: session.has_audio,
          observation,
        }, session.sources, [
          session.dirigente,
          session.mestre_assistente,
          session.explanador,
        ].filter((name): name is string => Boolean(name)));
        successCount++;
      } catch (err) {
        toast.error(`Linha ${session.rowNumber}: ${getErrorMessage(err)}`);
        failedCount++;
      }
    }

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
    setFile(null);
    setParsedData([]);
    setPasteText("");
    setUploadTab("file");
    setParseInfo(null);
    setStep("upload");
    setImportResult({ success: 0, failed: 0 });
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
  const invalidCount = parsedData.filter((s) => !s.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar Sessões via CSV
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Selecione um arquivo CSV para importar sessões em lote."}
            {step === "preview" && "Revise os dados antes de importar."}
            {step === "result" && "Resultado da importação."}
          </DialogDescription>
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
                      <p key={vegetal.id}>{vegetal.name} ({Number(vegetal.quantity).toFixed(2)} L): <code className="select-all">{vegetal.id}</code></p>
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
                    {parseInfo.parseErrors && parseInfo.parseErrors.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Avisos do parser (primeiros {parseInfo.parseErrors.length}):</p>
                        <ul className="list-disc pl-5">
                          {parseInfo.parseErrors.map((msg, idx) => (
                            <li key={idx}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  {validCount} válidas
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <XCircle className="h-3 w-3 text-destructive" />
                  {invalidCount} inválidas
                </Badge>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Dirigente</TableHead>
                      <TableHead>Registrado por</TableHead>
                      <TableHead>Leitor</TableHead>
                      <TableHead>Transmissão</TableHead>
                      <TableHead>Participantes</TableHead>
                      <TableHead>Consumo</TableHead>
                      <TableHead>Lotes</TableHead>
                      <TableHead>Foto</TableHead>
                      <TableHead>Áudio</TableHead>
                      <TableHead>Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((session, idx) => (
                      <TableRow key={idx} className={session.isValid ? "" : "bg-destructive/10"}>
                        <TableCell>
                          {session.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>{session.date || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {session.type || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate">{session.dirigente || "-"}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{session.registered_by_name || "-"}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{session.leitor || "-"}</TableCell>
                        <TableCell>{session.is_transmissao_assistencia ? "Sim" : "Não"}</TableCell>
                        <TableCell>
                          {session.mestres + session.conselheiros + session.instrutivo + session.socios + session.visitantes + session.jovens}
                        </TableCell>
                        <TableCell>{session.total_consumed.toFixed(2)} L</TableCell>
                        <TableCell className="max-w-[180px] text-xs">{session.sources.map((source) => source.vegetal_name).join(", ") || "-"}</TableCell>
                        <TableCell>
                          {session.has_photo ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {session.has_audio ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {session.errors.length > 0 && (
                            <span className="text-xs text-destructive">
                              {session.errors.join(", ")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
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
