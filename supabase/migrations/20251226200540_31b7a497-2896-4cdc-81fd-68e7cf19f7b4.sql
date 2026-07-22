-- ==================================================
-- GESTÃO VEGETAL - DATABASE SCHEMA
-- ==================================================

-- Tabela: Vegetal (Estoque/Lotes)
CREATE TABLE public.vegetal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  initial_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  envase_date DATE NOT NULL,
  master TEXT NOT NULL,
  auxiliary TEXT,
  mariri_species TEXT,
  chacrona_species TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  registered_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: Session (Sessões/Rituais)
CREATE TABLE public.session (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  type TEXT NOT NULL,
  dirigente TEXT NOT NULL,
  explanador TEXT,
  leitor TEXT,
  mestre_assistente TEXT,
  observation TEXT,
  participants JSONB NOT NULL DEFAULT '{"mestres": 0, "conselho": 0, "instrutivo": 0, "socios": 0, "visitantes": 0, "jovens": 0}',
  total_participants INTEGER NOT NULL DEFAULT 0,
  consumption JSONB NOT NULL DEFAULT '{"total_consumed": 0, "is_united": false, "sources": []}',
  chamadas TEXT,
  historias TEXT,
  has_photo BOOLEAN NOT NULL DEFAULT FALSE,
  has_audio BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: StockMovement (Livro Razão/Log)
CREATE TABLE public.stock_movement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  type TEXT NOT NULL CHECK (type IN ('Entrada', 'Saída', 'Consumo', 'Ajuste', 'Saldo')),
  quantity DECIMAL(10, 2) NOT NULL,
  vegetal_id UUID REFERENCES public.vegetal(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.session(id) ON DELETE SET NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_vegetal_updated_at
  BEFORE UPDATE ON public.vegetal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_session_updated_at
  BEFORE UPDATE ON public.session
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.vegetal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movement ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Acesso público para leitura (sistema interno sem auth por enquanto)
CREATE POLICY "Allow public read vegetal" ON public.vegetal FOR SELECT USING (true);
CREATE POLICY "Allow public insert vegetal" ON public.vegetal FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update vegetal" ON public.vegetal FOR UPDATE USING (true);
CREATE POLICY "Allow public delete vegetal" ON public.vegetal FOR DELETE USING (true);

CREATE POLICY "Allow public read session" ON public.session FOR SELECT USING (true);
CREATE POLICY "Allow public insert session" ON public.session FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update session" ON public.session FOR UPDATE USING (true);
CREATE POLICY "Allow public delete session" ON public.session FOR DELETE USING (true);

CREATE POLICY "Allow public read stock_movement" ON public.stock_movement FOR SELECT USING (true);
CREATE POLICY "Allow public insert stock_movement" ON public.stock_movement FOR INSERT WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_vegetal_quantity ON public.vegetal(quantity DESC);
CREATE INDEX idx_vegetal_is_archived ON public.vegetal(is_archived);
CREATE INDEX idx_session_date ON public.session(date DESC);
CREATE INDEX idx_session_type ON public.session(type);
CREATE INDEX idx_stock_movement_vegetal ON public.stock_movement(vegetal_id);
CREATE INDEX idx_stock_movement_session ON public.stock_movement(session_id);
CREATE INDEX idx_stock_movement_date ON public.stock_movement(date DESC);