import {
  MEMBER_DUPLICATE_CONSTRAINTS,
  SESSION_DUPLICATE_CONSTRAINT,
  UNIQUE_VIOLATION_CODE,
} from "@/lib/errorDiagnostics";

export interface ErrorExplanationInput {
  code?: string | null;
  message?: string | null;
  originalMessage?: string | null;
  constraint?: string | null;
  hint?: string | null;
  location?: string | null;
  operation?: string | null;
  entity?: string | null;
}

export interface ErrorExplanation {
  category: string;
  summary: string;
  cause: string;
  recommendedAction: string;
  location: string;
}

const LOCATION_LABELS: Record<string, string> = {
  "Estoque.getStockForecast": "Estoque › previsão de saldo",
  "Erros.listTechnical": "Erros do sistema › registros técnicos",
  "Erros.listOperational": "Erros do sistema › registros operacionais",
  "AuthContext.signOut": "Autenticação › sair da conta",
  "AuthContext.fetchUserRole": "Autenticação › conferir permissões",
  "Login.handleLogin": "Entrada › autenticar conta",
  "Membros.create": "Membros › criar cadastro",
  "Membros.update": "Membros › editar cadastro",
  "Membros.delete": "Membros › excluir cadastro",
  "useMembers.list": "Membros › carregar lista",
  // Origens antigas mantidas para exibir registros já gravados no banco.
  "useMembers.checkExistingBeforeCreate": "Membros › verificar duplicidade",
  "useMembers.create": "Membros › criar cadastro",
  "addMemberIfNotExists.checkExisting": "Membros › verificar cadastro automático",
  "addMemberIfNotExists.create": "Membros › criar cadastro automático",
  "useSessions.list": "Sessões › carregar lista",
  "useSessions.paginatedList": "Histórico › carregar sessões",
  "useSessions.getById": "Sessões › carregar detalhes",
  "useSessions.update": "Sessões › editar metadados",
  "useSessions.delete": "Sessões › excluir e estornar consumo",
  "sessionRegistration.validateQuantities": "Nova sessão › validar consumo",
  "sessionRegistration.registerWithConsumption": "Nova sessão › registrar e consumir estoque",
  "useVegetais.list": "Estoque › carregar lotes",
  "useVegetais.list.pagination": "Estoque › carregar mais lotes",
  "useVegetais.getById": "Estoque › carregar lote",
  "useVegetais.create": "Estoque › criar lote",
  "useVegetais.update": "Estoque › atualizar lote",
  "useStockMovements.list": "Estoque › carregar movimentações",
  "useAuditLogs.list": "Atividades › carregar histórico",
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("en-US") || "";
}

export function getErrorLocationLabel(location: string | null | undefined) {
  if (!location) return "Origem não informada";
  return LOCATION_LABELS[location] || location.replace(/\./g, " › ");
}

export function explainError(input: ErrorExplanationInput): ErrorExplanation {
  const code = input.code?.trim().toUpperCase() || "";
  const message = normalize(input.originalMessage || input.message);
  const location = getErrorLocationLabel(input.location);

  if (code === "PGRST202" || message.includes("could not find the function")) {
    return {
      category: "Função indisponível",
      summary: "A API não encontrou uma função necessária para concluir a consulta.",
      cause: "A migration da função pode estar pendente ou o cache de schema da API ainda não foi recarregado.",
      recommendedAction: "Confirme a migration da função e recarregue o schema da API. Depois, tente novamente.",
      location,
    };
  }

  if (code === "PGRST116" || message.includes("0 rows")) {
    return {
      category: "Registro não encontrado",
      summary: "O registro solicitado não foi encontrado.",
      cause: "Ele pode ter sido removido, alterado por outra pessoa ou não estar acessível para esta conta.",
      recommendedAction: "Atualize a tela e confirme se o registro ainda existe e se a conta possui acesso.",
      location,
    };
  }

  if (["PGRST204", "42703"].includes(code) || (message.includes("column") && message.includes("does not exist"))) {
    return {
      category: "Estrutura desatualizada",
      summary: "A API tentou usar um campo que não existe no schema atual.",
      cause: "Frontend e banco foram publicados em versões diferentes ou uma migration está pendente.",
      recommendedAction: "Confirme as migrations e publique novamente o frontend após atualizar os tipos do banco.",
      location,
    };
  }

  if (["PGRST205", "42P01"].includes(code) || (message.includes("relation") && message.includes("does not exist"))) {
    return {
      category: "Tabela ou view indisponível",
      summary: "A API não encontrou uma estrutura necessária no banco.",
      cause: "A migration correspondente pode não ter sido aplicada ou o schema está desatualizado.",
      recommendedAction: "Confirme a migration e recarregue o schema da API antes de tentar novamente.",
      location,
    };
  }

  if (code === UNIQUE_VIOLATION_CODE) {
    const duplicateSession = input.constraint === SESSION_DUPLICATE_CONSTRAINT;
    const duplicateMember = MEMBER_DUPLICATE_CONSTRAINTS.includes(input.constraint || "");
    return {
      category: "Registro duplicado",
      summary: duplicateSession
        ? "Já existe uma sessão com estes mesmos dados."
        : duplicateMember
          ? "Já existe um membro com esta identidade."
          : "Já existe um registro com os mesmos dados únicos.",
      cause: "O banco protege contra cadastros duplicados.",
      recommendedAction: "Localize o registro existente, ajuste os dados ou use-o em vez de criar outro.",
      location,
    };
  }

  if (["42501", "PGRST301", "401", "403"].includes(code) || /permission denied|not authorized|row-level security/.test(message)) {
    return {
      category: "Acesso negado",
      summary: "Esta conta não possui permissão para concluir a operação.",
      cause: "A política de acesso do sistema bloqueou a ação para este papel ou sessão.",
      recommendedAction: "Entre novamente e confirme o papel da conta. Se persistir, peça revisão de acesso.",
      location,
    };
  }

  if (["57014", "PGRST000", "PGRST001", "PGRST002", "PGRST003", "08006"].includes(code) || message.includes("timeout")) {
    return {
      category: "Serviço indisponível",
      summary: "A consulta foi cancelada ou o banco não respondeu a tempo.",
      cause: "Houve instabilidade de conexão, indisponibilidade temporária ou consulta lenta.",
      recommendedAction: "Tente novamente. Se o problema se repetir, investigue a disponibilidade e o desempenho da consulta.",
      location,
    };
  }

  if (code === "23503" || message.includes("foreign key")) {
    return {
      category: "Registro vinculado",
      summary: "A operação afetaria um registro que possui vínculos ativos.",
      cause: "O banco preservou a integridade entre os dados relacionados.",
      recommendedAction: "Revise os vínculos existentes antes de alterar ou excluir o registro.",
      location,
    };
  }

  if (["23502", "23514", "22P02"].includes(code) || /not-null|check constraint|invalid input/.test(message)) {
    return {
      category: "Dados inválidos",
      summary: "Os dados enviados não passaram pela validação do sistema.",
      cause: "Há campo obrigatório ausente, formato inválido ou valor fora das regras do domínio.",
      recommendedAction: "Revise os campos informados e tente novamente.",
      location,
    };
  }

  if (/failed to fetch|network request failed|networkerror|fetch failed|load failed/.test(message)) {
    return {
      category: "Conexão indisponível",
      summary: "Não foi possível comunicar com o sistema.",
      cause: "A rede, o navegador ou o serviço remoto interrompeu a requisição.",
      recommendedAction: "Verifique a internet, atualize a página e tente novamente.",
      location,
    };
  }

  return {
    category: "Falha não classificada",
    summary: "A operação não foi concluída.",
    cause: input.hint || "O registro não contém detalhe suficiente para apontar uma causa específica.",
    recommendedAction: "Tente novamente. Se persistir, use código, local e metadados deste registro para investigação.",
    location,
  };
}
