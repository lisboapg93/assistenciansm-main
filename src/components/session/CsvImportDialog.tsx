import { useState, useRef } from "react";
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
import { SESSION_TYPES, TYPES_WITH_EXPLANADOR_LEITOR, Participants, ConsumptionSource } from "@/types/database";
import { getErrorMessage } from "@/lib/errorLogging";
import { useMembers } from "@/hooks/useMembers";
import { useVegetais } from "@/hooks/useVegetais";
import { getSessionRoleValidationError } from "@/lib/sessionRoleEligibility";
import { registerSessionWithConsumption } from "@/lib/sessionRegistration";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParsedSession {
  rowNumber: number;
  date: string;
  type: string;
  dirigente: string;
  mestre_assistente: string;
  explanador?: string;
  leitor?: string;
  mestres: number;
  conselheiros: number;
  instrutivo: number;
  socios: number;
  visitantes: number;
  jovens: number;
  total_consumed: number;
  is_united: boolean;
  has_photo: boolean;
  has_audio: boolean;
  observation?: string;
  sources: ConsumptionSource[];
  isValid: boolean;
  errors: string[];
}

const CSV_TEMPLATE_HEADERS = [
  "data",
  "tipo",
  "dirigente",
  "mestre_assistente",
  "explanador",
  "leitor",
  "mestres",
  "conselheiros",
  "instrutivo",
  "socios",
  "visitantes",
  "jovens",
  "consumo_total",
  "vegetal_unido",
  "tem_foto",
  "tem_audio",
  "observacao",
  "fontes_vegetal",
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CsvImportDialog({ open, onOpenChange, onSuccess }: CsvImportDialogProps) {
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const delimiter = ";";
    const headers = CSV_TEMPLATE_HEADERS.join(delimiter);
    const exampleRow = [
      "2025-01-15",
      "Primeira Escala",
      "João Silva",
      "Maria Santos",
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

    const csvContent = `${headers}\n${exampleRow}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "modelo_importacao_sessoes.csv";
    link.click();
    toast.success("Modelo baixado com sucesso!");
  };

  const parseBoolean = (value: string): boolean | null => {
    const normalized = value?.toLowerCase().trim();
    if (!normalized || ["false", "não", "nao", "0", "n"].includes(normalized)) return false;
    if (["true", "sim", "1", "s"].includes(normalized)) return true;
    return null;
  };

  const parseNumber = (value: string): number | null => {
    const trimmed = value?.trim() || "";
    if (!trimmed) return null;
    const normalized = /^\d{1,3}(?:\.\d{3})+,\d+$/.test(trimmed)
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(",", ".");
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  };

  const parseDate = (value: string): string | null => {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    let year: number;
    let month: number;
    let day: number;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    const brazilian = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(trimmed);
    if (iso) {
      year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
    } else if (brazilian) {
      day = Number(brazilian[1]); month = Number(brazilian[2]); year = Number(brazilian[3]);
    } else {
      return null;
    }
    const result = new Date(Date.UTC(year, month - 1, day));
    if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) return null;
    return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const validateRow = (row: Record<string, string>): ParsedSession => {
    const errors: string[] = [];

    const date = parseDate(row.data);
    if (!date) {
      errors.push("Data inválida");
    }

    const type = row.tipo?.trim() || "";
    if (!SESSION_TYPES.some((sessionType) => sessionType === type)) {
      errors.push(`Tipo de sessão inválido: "${type}"`);
    }

    const dirigente = row.dirigente?.trim() || "";
    if (!dirigente) {
      errors.push("Dirigente é obrigatório");
    }

    const mestreAssistente = row.mestre_assistente?.trim() || "";
    if (!mestreAssistente) {
      errors.push("Mestre Assistente é obrigatório");
    }

    const explanador = row.explanador?.trim() || "";
    const leitor = row.leitor?.trim() || "";
    if (TYPES_WITH_EXPLANADOR_LEITOR.includes(type) && (!explanador || !leitor)) {
      errors.push("Explanador e Leitor são obrigatórios para este tipo de sessão");
    }

    if (dirigente && mestreAssistente && SESSION_TYPES.some((sessionType) => sessionType === type)) {
      const roleError = getSessionRoleValidationError({
        type,
        dirigente,
        mestreAssistente,
        explanador: explanador || undefined,
        leitor: leitor || undefined,
        members: members || [],
      });
      if (roleError) errors.push(roleError);
    }

    const countFields = ["mestres", "conselheiros", "instrutivo", "socios", "visitantes", "jovens"] as const;
    const counts = Object.fromEntries(countFields.map((field) => {
      const value = row[field]?.trim() ? parseNumber(row[field]) : 0;
      if (value === null || !Number.isInteger(value) || value < 0) {
        errors.push(`${field}: informe um inteiro não negativo`);
        return [field, 0];
      }
      return [field, value];
    })) as Record<(typeof countFields)[number], number>;
    if (Object.values(counts).reduce((sum, count) => sum + count, 0) <= 0) {
      errors.push("Informe ao menos um participante");
    }

    const totalConsumed = parseNumber(row.consumo_total);
    if (totalConsumed === null || totalConsumed <= 0) errors.push("Consumo total deve ser positivo");

    const isUnited = parseBoolean(row.vegetal_unido);
    const hasPhoto = parseBoolean(row.tem_foto);
    const hasAudio = parseBoolean(row.tem_audio);
    if (isUnited === null) errors.push("vegetal_unido: use sim ou não");
    if (hasPhoto === null) errors.push("tem_foto: use sim ou não");
    if (hasAudio === null) errors.push("tem_audio: use sim ou não");

    const sources: ConsumptionSource[] = [];
    const sourceText = row.fontes_vegetal?.trim() || "";
    if (!sourceText) {
      errors.push("Informe os lotes de vegetal usados no consumo");
    } else {
      const entries = sourceText.split("|");
      if (isUnited === false && entries.length !== 1) {
        errors.push("Sem união, informe apenas um lote");
      }
      const seen = new Set<string>();
      for (const entry of entries) {
        const [id, rawAmount, extra] = entry.trim().split(":");
        const vegetalId = id?.trim() || "";
        if (!UUID_PATTERN.test(vegetalId) || extra !== undefined || seen.has(vegetalId)) {
          errors.push(`Fonte de vegetal inválida ou repetida: ${entry}`);
          continue;
        }
        seen.add(vegetalId);
        const vegetal = vegetais?.find((lot) => lot.id === vegetalId);
        if (!vegetal) {
          errors.push(`Lote indisponível: ${vegetalId}`);
          continue;
        }
        const amount = rawAmount?.trim()
          ? parseNumber(rawAmount)
          : isUnited ? null : totalConsumed;
        if (amount === null || amount === undefined || amount <= 0 || amount > vegetal.quantity) {
          errors.push(`Quantidade inválida para o lote ${vegetal.name}`);
          continue;
        }
        sources.push({ vegetal_id: vegetal.id, vegetal_name: vegetal.name, amount_available: amount });
      }
      if (totalConsumed !== null && sources.reduce((sum, source) => sum + source.amount_available, 0) < totalConsumed) {
        errors.push("Consumo maior que o total disponibilizado pelos lotes");
      }
    }

    return {
      rowNumber: 0,
      date: date || "",
      type,
      dirigente,
      mestre_assistente: mestreAssistente,
      explanador: explanador || undefined,
      leitor: leitor || undefined,
      ...counts,
      total_consumed: totalConsumed ?? 0,
      is_united: isUnited ?? false,
      has_photo: hasPhoto ?? false,
      has_audio: hasAudio ?? false,
      observation: row.observacao?.trim() || undefined,
      sources,
      isValid: errors.length === 0,
      errors,
    };
  };

  const normalizeHeader = (value: string) =>
    value
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const readFileText = (selectedFile: File, encoding?: string) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsText(selectedFile, encoding);
    });

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

    const CANONICAL_COLUMNS = [
      "data",
      "tipo",
      "dirigente",
      "mestre_assistente",
      "explanador",
      "leitor",
      "mestres",
      "conselheiros",
      "instrutivo",
      "socios",
      "visitantes",
      "jovens",
      "consumo_total",
      "vegetal_unido",
      "tem_foto",
      "tem_audio",
      "observacao",
      "fontes_vegetal",
    ] as const;

    const HEADER_ALIASES: Record<(typeof CANONICAL_COLUMNS)[number], string[]> = {
      data: ["data", "date", "dt"],
      tipo: ["tipo", "type", "tipo_de_sessao", "tipo_sessao", "sessao"],
      dirigente: ["dirigente", "dirigente_nome"],
      mestre_assistente: ["mestre_assistente", "mestre_assistente_nome", "assistente", "m_assistente"],
      explanador: ["explanador", "explanador_nome"],
      leitor: ["leitor", "leitor_nome"],
      mestres: ["mestres", "mestre", "qtd_mestres"],
      conselheiros: ["conselheiros", "conselheiro", "qtd_conselheiros", "conselho"],
      instrutivo: ["instrutivo", "qtd_instrutivo", "corpo_instrutivo"],
      socios: ["socios", "socio", "qtd_socios"],
      visitantes: ["visitantes", "visitante", "qtd_visitantes"],
      jovens: ["jovens", "jovem", "qtd_jovens"],
      consumo_total: ["consumo_total", "consumo", "total_consumed", "quantidade_vegetal", "qtd_vegetal", "vegetal_consumido", "litros", "quantidade"],
      vegetal_unido: ["vegetal_unido", "unido", "is_united", "vegetal_e_unido"],
      tem_foto: ["tem_foto", "foto", "has_photo", "registro_fotografico", "registro_foto", "fotografico"],
      tem_audio: ["tem_audio", "audio", "has_audio", "registro_audio", "gravacao"],
      observacao: ["observacao", "observacao_sessao", "observation", "acontecimento", "acontecimentos", "obs", "observacoes", "acontecimento_na_sessao"],
      fontes_vegetal: ["fontes_vegetal", "fontes", "lotes_vegetal", "lotes"],
    };

    const headerRow = rows[0];
    const headerNorm = headerRow.map(normalizeHeader);

    const hasHeader =
      headerNorm.includes("data") ||
      headerNorm.includes("tipo") ||
      headerNorm.includes("dirigente") ||
      headerNorm.includes("mestre_assistente");

    const indexByColumn = CANONICAL_COLUMNS.reduce((acc, col) => {
      if (!hasHeader) {
        acc[col] = null;
        return acc;
      }

      const aliases = (HEADER_ALIASES[col] ?? [col]).map(normalizeHeader);
      const idx = headerNorm.findIndex((h) => aliases.includes(h));
      acc[col] = idx >= 0 ? idx : null;
      return acc;
    }, {} as Record<(typeof CANONICAL_COLUMNS)[number], number | null>);

    const mappedCount = Object.values(indexByColumn).filter((v) => v !== null).length;
    const canUseHeaderMapping = hasHeader && mappedCount >= 3;

    setParseInfo({
      delimiter: forcedDelimiter ?? result.meta.delimiter,
      encoding: opts?.encoding,
      parseErrors: parseErrors.length ? parseErrors.slice(0, 5) : [],
    });

    if (hasHeader && !canUseHeaderMapping) {
      toast.warning("Cabeçalho não reconhecido; usando a posição das colunas.");
    }

    const dataRows = hasHeader ? rows.slice(1) : rows;
    if (dataRows.length < 1) {
      toast.error("O CSV deve ter pelo menos uma linha de dados além do cabeçalho");
      return [];
    }

    // Convert rows to objects with canonical column names
    const preparedRows: Record<string, string>[] = dataRows.map((row) => {
      const obj: Record<string, string> = {};
      CANONICAL_COLUMNS.forEach((col, defaultIdx) => {
        if (canUseHeaderMapping) {
          const idx = indexByColumn[col];
          obj[col] = idx !== null ? (row[idx] ?? "") : "";
        } else {
          // Fallback to positional mapping
          obj[col] = row[defaultIdx] ?? "";
        }
      });
      return obj;
    });

    return preparedRows.map((row, index) => ({
      ...validateRow(row),
      rowNumber: index + (hasHeader ? 2 : 1),
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
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV");
      return;
    }

    setFile(selectedFile);

    try {
      let text = await readFileText(selectedFile);
      let encoding = "utf-8";

      // Se vier com muitos \0 (comum em UTF-16), tentamos novamente.
      if (text.includes("\u0000")) {
        text = await readFileText(selectedFile, "utf-16le");
        encoding = "utf-16le";
      }

      loadTextToPreview(text, { encoding });
    } catch (err) {
      console.error("Erro ao ler CSV:", err);
      toast.error("Não foi possível ler o arquivo CSV");
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
    const validSessions = parsedData.filter((s) => s.isValid);
    if (validSessions.length === 0) {
      toast.error("Nenhuma sessão válida para importar");
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let failedCount = 0;

    for (const session of validSessions) {
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

        await registerSessionWithConsumption({
          date: session.date,
          type: session.type,
          dirigente: session.dirigente,
          mestre_assistente: session.mestre_assistente,
          explanador: session.explanador || null,
          leitor: session.leitor || null,
          participants,
          total_participants: totalParticipants,
          total_consumed: session.total_consumed,
          is_united: session.is_united,
          has_photo: session.has_photo,
          has_audio: session.has_audio,
          observation: session.observation || null,
        }, session.sources, [
          session.dirigente,
          session.mestre_assistente,
          session.explanador,
          session.leitor,
        ].filter((name): name is string => Boolean(name)));
        successCount++;
      } catch (err) {
        toast.error(`Linha ${session.rowNumber}: ${getErrorMessage(err)}`);
        failedCount++;
      }
    }

    setImportResult({ success: successCount, failed: failedCount });
    setStep("result");
    setIsImporting(false);

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
              <Button variant="outline" onClick={() => setStep("upload")}>
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
