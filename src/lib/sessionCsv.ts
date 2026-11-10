export const CSV_TEMPLATE_HEADERS = [
  "data",
  "tipo",
  "transmissao_assistencia",
  "segundo_dirigente",
  "dirigente",
  "mestre_assistente",
  "registrado_por",
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

const LEGACY_POSITIONAL_HEADERS = CSV_TEMPLATE_HEADERS.filter(
  (column) => column !== "transmissao_assistencia" && column !== "segundo_dirigente",
);

const HEADER_ALIASES: Record<(typeof CSV_TEMPLATE_HEADERS)[number], string[]> = {
  data: ["data", "date", "dt"],
  tipo: ["tipo", "type", "tipo_de_sessao", "tipo_sessao", "sessao"],
  transmissao_assistencia: ["transmissao_assistencia", "transmissao", "sessao_transmissao", "is_transmissao_assistencia"],
  segundo_dirigente: ["segundo_dirigente", "2_dirigente", "2o_dirigente", "segundo_dirigente_nome"],
  dirigente: ["dirigente", "dirigente_nome"],
  mestre_assistente: ["mestre_assistente", "mestre_assistente_nome", "assistente", "m_assistente"],
  registrado_por: ["registrado_por", "registered_by_name", "cadastrado_por", "responsavel_registro"],
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

const normalizeHeader = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

type SessionCsvColumn = (typeof CSV_TEMPLATE_HEADERS)[number];

const REQUIRED_COLUMNS: SessionCsvColumn[] = [
  "data", "tipo", "dirigente", "mestre_assistente", "registrado_por", "consumo_total", "fontes_vegetal",
];

const columnByAlias = new Map<string, SessionCsvColumn>(
  CSV_TEMPLATE_HEADERS.flatMap((column) => HEADER_ALIASES[column].map((alias) => [normalizeHeader(alias), column] as const)),
);

export function mapSessionCsvRows(rows: string[][]) {
  const headerRow = rows[0] ?? [];
  // Dados posicionais começam por uma data. Um nome/observação igual a um
  // alias (por exemplo "Áudio") não transforma esses dados em cabeçalho.
  const startsWithDate = /^(?:\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})$/.test(headerRow[0]?.trim() ?? "");
  const columns = headerRow.map((value) => columnByAlias.get(normalizeHeader(value)));
  const hasHeader = !startsWithDate && columns.some((column) => column !== undefined);
  const indexByColumn = new Map<SessionCsvColumn, number>();

  if (hasHeader) {
    const duplicates = new Set<SessionCsvColumn>();
    columns.forEach((column, index) => {
      if (!column) return;
      if (indexByColumn.has(column)) duplicates.add(column);
      indexByColumn.set(column, index);
    });
    if (duplicates.size) {
      return {
        rows: [], hasHeader,
        error: `Cabeçalho ambíguo: colunas repetidas para ${[...duplicates].join(", ")}. Use apenas uma coluna para cada campo.`,
      };
    }
    const missing = REQUIRED_COLUMNS.filter((column) => !indexByColumn.has(column));
    if (missing.length) {
      return {
        rows: [], hasHeader,
        error: `Cabeçalho incompleto. Inclua as colunas: ${missing.join(", ")}. Consulte o modelo de importação.`,
      };
    }
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const preparedRows = dataRows.map((row, rowIndex) => {
    const values: Record<string, string> = {};
    const positionalColumns = !hasHeader && row.length <= LEGACY_POSITIONAL_HEADERS.length
      ? LEGACY_POSITIONAL_HEADERS
      : CSV_TEMPLATE_HEADERS;
    positionalColumns.forEach((column, defaultIndex) => {
      const index = hasHeader ? indexByColumn.get(column) : defaultIndex;
      values[column] = index !== undefined ? (row[index] ?? "") : "";
    });
    CSV_TEMPLATE_HEADERS.forEach((column) => {
      values[column] ??= "";
    });
    return { values, rowNumber: rowIndex + (hasHeader ? 2 : 1) };
  });
  return { rows: preparedRows, hasHeader, error: undefined };
}

/**
 * Decodifica os bytes de um CSV. O Excel pt-BR salva "CSV" em Windows-1252 por
 * padrão, o que não é UTF-8 válido; ler esse arquivo como UTF-8 troca acentos
 * por U+FFFD e faz o RPC criar membros com nomes corrompidos.
 */
export function decodeCsvBuffer(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes), encoding: "utf-16le" };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(bytes), encoding: "utf-16be" };
  }
  // UTF-16 sem BOM aparece como texto com bytes nulos. Em LE o nulo de um
  // caractere ASCII fica em posição ímpar; em BE, em posição par.
  if (bytes.includes(0)) {
    let evenNulls = 0;
    let oddNulls = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 0) continue;
      if (i % 2 === 0) evenNulls++;
      else oddNulls++;
    }
    const encoding = evenNulls > oddNulls ? "utf-16be" : "utf-16le";
    return { text: new TextDecoder(encoding).decode(bytes), encoding };
  }

  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(bytes), encoding: "windows-1252" };
  }
}
