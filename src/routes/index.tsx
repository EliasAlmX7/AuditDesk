import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CRITERIOS, calcularScore, calcularClassificacao, type CriterioId } from '@/lib/constants';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Search, Check, X, Save, ChevronRight, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/')({
  component: AuditPage,
});

type Colaborador = {
  cpf: string;
  nome: string;
  area: string;
  cargo: string;
};

// Hook para salvar o estado no localStorage ("Cloud Sync" local pro tablet)
function useStickyState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window !== 'undefined') {
      const stickyValue = window.localStorage.getItem(key);
      return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
    }
    return defaultValue;
  });
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value]);
  
  return [value, setValue];
}

function AuditPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  
  const [selected, setSelected] = useStickyState<Colaborador | null>(null, 'audit_selected_colab');
  const [auditor, setAuditor] = useStickyState('', 'audit_auditor_nome');
  const [respostas, setRespostas] = useStickyState<Record<string, 'Conforme' | 'Não Conforme'>>({}, 'audit_respostas');
  const [observacoes, setObservacoes] = useStickyState<Record<string, string>>({}, 'audit_observacoes');
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('colaboradores')
      .select('cpf, nome, area, cargo')
      .eq('status', 'ativo')
      .order('nome')
      .then(({ data }) => {
        if (data) {
          setColaboradores(data);
          const uniqueAreas = [...new Set(data.map(c => c.area))].sort();
          setAreas(uniqueAreas);
        }
      });
  }, []);

  const filtered = colaboradores.filter(c => {
    const matchSearch = !search || c.nome.toLowerCase().includes(search.toLowerCase());
    const matchArea = !areaFilter || c.area === areaFilter;
    return matchSearch && matchArea;
  });

  const toggleResposta = useCallback((criterioId: string, valor: 'Conforme' | 'Não Conforme') => {
    setRespostas(prev => ({ ...prev, [criterioId]: valor }));
  }, [setRespostas]);

  const updateObservacao = useCallback((criterioId: string, valor: string) => {
    setObservacoes(prev => ({ ...prev, [criterioId]: valor }));
  }, [setObservacoes]);

  const handleSave = async () => {
    if (!selected || !auditor.trim()) {
      toast.error('Informe o nome do auditor');
      return;
    }
    const allAnswered = CRITERIOS.every(c => respostas[c.id]);
    if (!allAnswered) {
      toast.error('Responda todos os critérios');
      return;
    }

    setSaving(true);
    try {
      const score = calcularScore(respostas);
      const classificacao = calcularClassificacao(score);

      // Concatenando as observações individuais para salvar no banco
      const observacaoFinalArr = Object.entries(observacoes)
        .filter(([_, obs]) => obs && obs.trim() !== '')
        .map(([id, obs]) => {
          const crit = CRITERIOS.find(c => c.id === id);
          return `${crit?.label}:\n${obs.trim()}`;
        });
      
      const observacaoFinalStr = observacaoFinalArr.length > 0 ? observacaoFinalArr.join('\n\n') : null;

      const { data: auditoria, error: audError } = await supabase
        .from('auditorias')
        .insert({
          cpf_colaborador: selected.cpf,
          nome_auditor: auditor.trim(),
          score,
          classificacao,
          observacoes: observacaoFinalStr,
        })
        .select('id')
        .single();

      if (audError) throw audError;

      const respostasToInsert = CRITERIOS.map(c => ({
        auditoria_id: auditoria.id,
        criterio: c.id,
        resposta: respostas[c.id],
      }));

      const { error: resError } = await supabase.from('respostas').insert(respostasToInsert);
      if (resError) throw resError;

      toast.success(`Auditoria salva! Score: ${score}% - ${classificacao}`);
      
      // Limpa os estados persistidos ao salvar com sucesso (mantendo o nome do auditor)
      setRespostas({});
      setObservacoes({});
      setSelected(null);
      setSearch('');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // If no collaborator selected, show search/list
  if (!selected) {
    return (
      <div className="min-h-screen pb-24">
        <PageHeader title="Auditoria" subtitle="Selecione o colaborador para auditar" />

        <div className="px-4 space-y-3">
          {/* Auditor name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Auditor</label>
            <Input
              placeholder="Seu nome"
              value={auditor}
              onChange={e => setAuditor(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11"
            />
          </div>

          {/* Area filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setAreaFilter('')}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                !areaFilter ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              Todas
            </button>
            {areas.map(area => (
              <button
                key={area}
                onClick={() => setAreaFilter(area === areaFilter ? '' : area)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  areaFilter === area ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {area}
              </button>
            ))}
          </div>

          {/* Collaborator list */}
          <div className="space-y-1.5">
            {filtered.map(c => (
              <button
                key={c.cpf}
                onClick={() => setSelected(c)}
                className="w-full flex items-center justify-between rounded-xl bg-card p-3.5 shadow-sm border border-border/50 active:scale-[0.98] transition-transform hover:shadow-md"
              >
                <div className="text-left">
                  <p className="font-semibold text-sm text-foreground">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.area} · {c.cargo}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum colaborador encontrado</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Audit form
  const allAnswered = CRITERIOS.every(c => respostas[c.id]);
  const currentScore = allAnswered ? calcularScore(respostas) : null;

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div>
          <button
            onClick={() => { setSelected(null); setRespostas({}); setObservacoes({}); }}
            className="text-xs text-primary font-bold mb-1 flex items-center gap-1 hover:underline"
          >
            ← Voltar
          </button>
          <h1 className="text-xl font-bold tracking-tight">{selected.nome}</h1>
          <p className="text-xs text-muted-foreground">{selected.area} · {selected.cargo}</p>
        </div>
        <div className="bg-primary/10 px-3 py-1 rounded-full text-xs font-bold text-primary">
          Auditando
        </div>
      </div>

      <div className="px-4 space-y-4 mt-2">
        {/* Aviso de sincronização */}
        <p className="text-xs text-center text-muted-foreground mb-4">
          Progresso salvo automaticamente no dispositivo. Ao concluir, envie os dados de forma segura.
        </p>

        {/* Checklist */}
        {CRITERIOS.map(criterio => {
          const val = respostas[criterio.id];
          const obs = observacoes[criterio.id] || '';
          
          return (
            <div key={criterio.id} className="rounded-xl bg-card p-4 shadow-sm border border-border/80 flex flex-col gap-3 transition-colors hover:border-primary/50">
              <div>
                <p className="font-bold text-sm text-foreground">{criterio.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{criterio.description}</p>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => toggleResposta(criterio.id, 'Conforme')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-all border ${
                    val === 'Conforme'
                      ? 'bg-success text-success-foreground border-success shadow-sm scale-[1.02]'
                      : 'bg-card text-foreground border-border hover:bg-success/10 hover:border-success/30'
                  }`}
                >
                  <Check className="h-5 w-5" />
                  Conforme
                </button>
                <button
                  onClick={() => toggleResposta(criterio.id, 'Não Conforme')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-all border ${
                    val === 'Não Conforme'
                      ? 'bg-danger text-danger-foreground border-danger shadow-sm scale-[1.02]'
                      : 'bg-card text-foreground border-border hover:bg-danger/10 hover:border-danger/30'
                  }`}
                >
                  <X className="h-5 w-5" />
                  Não Conforme
                </button>
              </div>

              {/* Observação individual */}
              <div className="mt-1 relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  placeholder="Observações sobre este item..."
                  value={obs}
                  onChange={e => updateObservacao(criterio.id, e.target.value)}
                  rows={2}
                  className="pl-9 text-sm resize-none bg-muted/30 focus-visible:bg-background"
                />
              </div>
            </div>
          );
        })}

        {/* Score preview */}
        {currentScore !== null && (
          <div className={`rounded-xl p-5 text-center shadow-sm border mt-6 ${
            calcularClassificacao(currentScore) === 'Conforme' ? 'bg-success/10 border-success/30 text-success' :
            calcularClassificacao(currentScore) === 'Atenção' ? 'bg-warning/10 border-warning/30 text-warning-foreground' : 'bg-danger/10 border-danger/30 text-danger'
          }`}>
            <p className="text-3xl font-extrabold">{currentScore}%</p>
            <p className="text-sm font-bold mt-1 uppercase tracking-wider">{calcularClassificacao(currentScore)}</p>
          </div>
        )}

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={saving || !allAnswered || !auditor.trim()}
          className="w-full h-14 text-base font-bold rounded-xl mt-4 shadow-md hover:shadow-lg transition-all"
          size="lg"
        >
          <Save className="h-5 w-5 mr-2" />
          {saving ? 'Registrando Auditoria...' : 'Salvar Auditoria Segura'}
        </Button>
      </div>
    </div>
  );
}

