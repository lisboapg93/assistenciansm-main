-- Banco SQLite local para testes manuais dos dados de domínio.
-- Não substitui os recursos de autenticação, RLS e RPC do Supabase.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  chosen_name TEXT,
  is_socio_nucleo INTEGER NOT NULL DEFAULT 0 CHECK (is_socio_nucleo IN (0, 1)),
  grau TEXT CHECK (
    grau IS NULL OR grau IN (
      'Quadro de Mestre',
      'Corpo do Conselho',
      'Corpo Instrutivo',
      'Quadro de Sócios'
    )
  ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    chosen_name IS NULL
    OR grau IN ('Quadro de Mestre', 'Corpo do Conselho')
  )
);

CREATE TABLE IF NOT EXISTS vegetal (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  initial_quantity REAL NOT NULL DEFAULT 0,
  envase_date TEXT NOT NULL,
  master TEXT NOT NULL,
  auxiliary TEXT,
  mensageiro TEXT,
  responsavel_chacrona TEXT,
  responsavel_baticao TEXT,
  mariri_species TEXT,
  chacrona_species TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  registered_by_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  dirigente TEXT NOT NULL,
  explanador TEXT,
  leitor TEXT,
  mestre_assistente TEXT,
  observation TEXT,
  participants TEXT NOT NULL DEFAULT '{"mestres":0,"conselho":0,"instrutivo":0,"socios":0,"visitantes":0,"jovens":0}' CHECK (json_valid(participants)),
  total_participants INTEGER NOT NULL DEFAULT 0,
  consumption TEXT NOT NULL DEFAULT '{"total_consumed":0,"is_united":false,"sources":[]}' CHECK (json_valid(consumption)),
  has_photo INTEGER NOT NULL DEFAULT 0 CHECK (has_photo IN (0, 1)),
  has_audio INTEGER NOT NULL DEFAULT 0 CHECK (has_audio IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movement (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL CHECK (type IN ('Entrada', 'Saída', 'Consumo', 'Ajuste', 'Saldo')),
  quantity REAL NOT NULL,
  vegetal_id TEXT REFERENCES vegetal(id) ON DELETE SET NULL,
  session_id TEXT REFERENCES session(id) ON DELETE SET NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE INDEX IF NOT EXISTS idx_vegetal_quantity ON vegetal(quantity DESC);
CREATE INDEX IF NOT EXISTS idx_vegetal_is_archived ON vegetal(is_archived);
CREATE INDEX IF NOT EXISTS idx_session_date ON session(date DESC);
CREATE INDEX IF NOT EXISTS idx_session_type ON session(type);
CREATE INDEX IF NOT EXISTS idx_stock_movement_vegetal ON stock_movement(vegetal_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_session ON stock_movement(session_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_date ON stock_movement(date DESC);

CREATE TRIGGER IF NOT EXISTS update_vegetal_updated_at
AFTER UPDATE ON vegetal
FOR EACH ROW
BEGIN
  UPDATE vegetal SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_session_updated_at
AFTER UPDATE ON session
FOR EACH ROW
BEGIN
  UPDATE session SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
