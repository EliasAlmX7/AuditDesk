
-- Tabela de colaboradores
CREATE TABLE public.colaboradores (
  cpf TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  area TEXT NOT NULL,
  cargo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de auditorias
CREATE TABLE public.auditorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf_colaborador TEXT NOT NULL REFERENCES public.colaboradores(cpf),
  nome_auditor TEXT NOT NULL,
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  score NUMERIC(5,2) NOT NULL,
  classificacao TEXT NOT NULL CHECK (classificacao IN ('Conforme', 'Atenção', 'Não conforme')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de respostas
CREATE TABLE public.respostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auditoria_id UUID NOT NULL REFERENCES public.auditorias(id) ON DELETE CASCADE,
  criterio TEXT NOT NULL,
  resposta TEXT NOT NULL CHECK (resposta IN ('OK', 'NÃO OK')),
  UNIQUE(auditoria_id, criterio)
);

-- Índices
CREATE INDEX idx_auditorias_cpf ON public.auditorias(cpf_colaborador);
CREATE INDEX idx_auditorias_data ON public.auditorias(data_hora);
CREATE INDEX idx_auditorias_classificacao ON public.auditorias(classificacao);
CREATE INDEX idx_colaboradores_area ON public.colaboradores(area);
CREATE INDEX idx_colaboradores_status ON public.colaboradores(status);

-- Enable RLS
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (sistema sem autenticação individual)
CREATE POLICY "Colaboradores visíveis por todos" ON public.colaboradores FOR SELECT USING (true);
CREATE POLICY "Colaboradores inseríveis por todos" ON public.colaboradores FOR INSERT WITH CHECK (true);
CREATE POLICY "Colaboradores atualizáveis por todos" ON public.colaboradores FOR UPDATE USING (true);

CREATE POLICY "Auditorias visíveis por todos" ON public.auditorias FOR SELECT USING (true);
CREATE POLICY "Auditorias inseríveis por todos" ON public.auditorias FOR INSERT WITH CHECK (true);

CREATE POLICY "Respostas visíveis por todos" ON public.respostas FOR SELECT USING (true);
CREATE POLICY "Respostas inseríveis por todos" ON public.respostas FOR INSERT WITH CHECK (true);

-- Trigger para updated_at em colaboradores
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
