import type { Session } from "@/types/database";
import { format } from "date-fns";
import { parseDbDateToLocal } from "@/lib/date";

const yesNo = (value: boolean) => (value ? "Sim" : "Não");

export async function exportHistoryToXlsx(sessions: Session[]) {
  const { default: writeXlsxFile } = await import("write-excel-file");

  const historyHeaders = [
    "Data", "Tipo", "Dirigente", "Mestre assistente", "Explanador", "Leitor",
    "Mestres", "Conselheiros", "Instrutivo", "Sócios", "Visitantes", "Jovens",
    "Total de participantes", "Consumo total (L)", "Vegetal unido", "Tem foto",
    "Tem áudio", "Observação",
  ];
  const headerRow = (headers: string[]) =>
    headers.map((value) => ({ value, fontWeight: "bold" as const, backgroundColor: "#DDEFE8" }));

  const historyRows = sessions.map((session) => [
    format(parseDbDateToLocal(session.date), "dd/MM/yyyy"),
    session.type,
    session.dirigente,
    session.mestre_assistente || "",
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
      format(parseDbDateToLocal(session.date), "dd/MM/yyyy"),
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
      headerRow(["Data", "Tipo de sessão", "Vegetal", "Quantidade utilizada (L)"]),
      ...sourceRows,
    ]);
  }

  await writeXlsxFile(data, {
    sheets,
    fileName: `backup-historico-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
  });
}
