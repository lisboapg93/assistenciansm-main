export const CSV_TEMPLATE_HEADERS = [
  "data",
  "tipo",
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

const HEADER_ALIASES: Record<(typeof CSV_TEMPLATE_HEADERS)[number], string[]> = {
  data: ["data", "date", "dt"],
  tipo: ["tipo", "type", "tipo_de_sessao", "tipo_sessao", "sessao"],
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
    CSV_TEMPLATE_HEADERS.forEach((column, defaultIndex) => {
      const index = hasHeader ? indexByColumn.get(column) : defaultIndex;
      values[column] = index !== undefined ? (row[index] ?? "") : "";
    });
    return { values, rowNumber: rowIndex + (hasHeader ? 2 : 1) };
  });
  return { rows: preparedRows, hasHeader, error: undefined };
}
