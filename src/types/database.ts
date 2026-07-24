export interface Vegetal {
  id: string;
  name: string;
  quantity: number;
  initial_quantity: number;
  envase_date: string;
  master: string;
  auxiliary: string | null;
  mariri_species: string | null;
  chacrona_species: string | null;
  is_archived: boolean;
  registered_by_name: string | null;
  mensageiro: string | null;
  responsavel_chacrona: string | null;
  responsavel_baticao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Participants {
  mestres: number;
  conselheiros: number;
  instrutivo: number;
  socios: number;
  visitantes: number;
  jovens: number;
}

export interface ConsumptionSource {
  vegetal_id: string;
  vegetal_name: string;
  amount_available: number;
}

export interface Consumption {
  total_consumed: number;
  is_united: boolean;
  sources: ConsumptionSource[];
}

export interface Session {
  id: string;
  date: string;
  type: string;
  dirigente: string;
  explanador: string | null;
  leitor: string | null;
  mestre_assistente: string | null;
  observation: string | null;
  participants: Participants;
  total_participants: number;
  consumption: Consumption;
  has_photo: boolean;
  has_audio: boolean;
  registered_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MovementType = 'Entrada' | 'Saída' | 'Consumo' | 'Ajuste' | 'Saldo';

export interface StockMovement {
  id: string;
  date: string;
  type: MovementType;
  quantity: number;
  vegetal_id: string | null;
  session_id: string | null;
  details: string | null;
  registered_by: string | null;
  created_at: string;
}

export const SESSION_TYPES = [
  'Primeira Escala',
  'Segunda Escala',
  'Extra',
  'Escala Anual',
  'Instrutiva',
  'Caráter Instrutivo',
  'Quadro de Mestres',
  'Direção',
  'Casal',
  'Adventício',
] as const;

export type SessionType = typeof SESSION_TYPES[number];

// Types that require Explanador and Leitor
export const TYPES_WITH_EXPLANADOR_LEITOR = [
  'Primeira Escala',
  'Segunda Escala',
  'Escala Anual',
  'Adventício',
];

// Participant labels for display
export const PARTICIPANT_LABELS: Record<keyof Participants, string> = {
  mestres: 'Mestres',
  conselheiros: 'Conselheiros',
  instrutivo: 'Instrutivo',
  socios: 'Sócios',
  visitantes: 'Visitantes',
  jovens: 'Jovens',
};
