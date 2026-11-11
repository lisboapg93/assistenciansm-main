import type { Session } from "@/types/database";
import { todayBrazilianIsoDate } from "@/lib/date";
import { formatSessionDate } from "@/lib/sessionDisplay";

const yesNo = (value: boolean) => (value ? "Sim" : "Não");
const HEADER_BACKGROUND_COLOR = "#DDEFE8";

export async function exportHistoryToXlsx(sessions: Session[]) {
  const { default: writeXlsxFile } = await import("write-excel-file");

  const historyHeaders = [
    "Data", "Tipo", "Dirigente", "Mestre assistente", "Registrado por", "Explanador", "Leitor",
    "Mestres", "Conselheiros", "Instrutivo", "Sócios", "Visitantes", "Jovens",
    "Total de participantes", "Consumo total (L)", "Vegetal unido", "Tem foto",
    "Tem áudio", "Observação",
  ];
  const headerRow = (headers: string[]) =>
    headers.map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: HEADER_BACKGROUND_COLOR }));

  const historyRows = sessions.map((session) => [
    formatSessionDate(session.date),
    session.type,
    session.dirigente,
    session.mestre_assistente || "",
    session.registered_by_name || "",
    session.explanador || "",
    session.leitor || "",
    session.participants.mestres,
    session.participants.conselheiros,
    session.participants.instrutivo,
    session.participants.socios,
    session.participants.visitantes,
    session.participants.jovens,
    session.total_participants,
    session.consumption?.total_consumed || 0,
    yesNo(session.consumption?.is_united || false),
    yesNo(session.has_photo),
    yesNo(session.has_audio),
    session.observation || "",
  ].map((value) => ({ value })));

  const sourceRows = sessions.flatMap((session) =>
    (session.consumption?.sources || []).map((source) => [
      formatSessionDate(session.date),
      session.type,
      source.vegetal_name,
      source.amount_available,
    ].map((value) => ({ value })))
  );

  const sheets = ["Histórico"];
  const data = [[headerRow(historyHeaders), ...historyRows]];
  if (sourceRows.length) {
    sheets.push("Vegetais utilizados");
    data.push([
      headerRow(["Data", "Tipo de sessão", "Vegetal", "Quantidade contribuída para a mistura (L)"]),
      ...sourceRows,
    ]);
  }

  await writeXlsxFile(data, {
    sheets,
    fileName: `backup-historico-${todayBrazilianIsoDate()}.xlsx`,
  });
}
