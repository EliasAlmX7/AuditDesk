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

      const observacaoFinalArr = Object.entries(observacoes)
        .filter(([_, obs]) => obs && obs.trim() !== '')
        .map(([id, obs]) => {
          const crit = CRITERIOS.find(c => c.id === id);
          return `${crit?.label}:\n${obs.trim()}`;
        });
      
      const observacaoFinalStr = observacaoFinalArr.length > 0 ? observacaoFinalArr.join('\n\n') : null;

      const { data: createdAud, error: audError } = await supabase
        .from('auditorias')
        .insert({
          cpf_colaborador: selected.cpf,
          nome_auditor: auditor.trim(),
          score,
          classificacao,
          observacoes: observacaoFinalStr,
        })
        .select('id');

      if (audError) throw audError;
      
      const auditoriaId = createdAud?.[0]?.id;
      if (!auditoriaId) throw new Error('Falha ao obter ID da auditoria');

      const respostasToInsert = CRITERIOS.map(c => ({
        auditoria_id: auditoriaId,
        criterio: c.id,
        resposta: respostas[c.id],
      }));

      const { error: resError } = await supabase.from('respostas').insert(respostasToInsert);
      if (resError) throw resError;

      toast.success(`Auditoria salva! Score: ${score}% - ${classificacao}`);
      
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

  if (!selected) {
    return (
      <div className="min-h-screen pb-24 bg-[#F8F9FA]">
        <div className="glass-header px-6 py-8 mb-6">
          <h1 className="text-3xl font-black text-secondary tracking-tight">AuditDesk <span className="text-primary">.</span></h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">Inicie uma nova auditoria corporativa</p>
        </div>

        <div className="px-6 space-y-6 animate-chique">
          <div className="premium-card p-6 rounded-3xl space-y-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Configuração Inicial</p>
            <div>
              <label className="text-xs font-bold text-secondary mb-1.5 block">Nome do Auditor responsável</label>
              <Input
                placeholder="Ex: Elias Almeida"
                value={auditor}
                onChange={e => setAuditor(e.target.value)}
                className="h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/30"
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Buscar Colaborador</p>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                placeholder="Digite o nome ou área..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-12 h-14 rounded-2xl premium-card border-none focus-visible:ring-primary/20 text-base"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
              <button
                onClick={() => setAreaFilter('')}
                className={`shrink-0 rounded-full px-5 py-2 text-xs font-bold transition-all ${
                  !areaFilter ? 'bg-secondary text-white shadow-lg' : 'bg-white text-muted-foreground hover:bg-muted shadow-sm'
                }`}
              >
                Todas as Áreas
              </button>
              {areas.map(area => (
                <button
                  key={area}
                  onClick={() => setAreaFilter(area === areaFilter ? '' : area)}
                  className={`shrink-0 rounded-full px-5 py-2 text-xs font-bold transition-all ${
                    areaFilter === area ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-muted-foreground shadow-sm hover:bg-muted'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {filtered.map((c, i) => (
                <button
                  key={c.cpf}
                  onClick={() => setSelected(c)}
                  className="premium-card p-5 rounded-2xl flex items-center justify-between group active:scale-95 text-left transition-all"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div>
                    <p className="font-bold text-secondary text-base group-hover:text-primary transition-colors">{c.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold uppercase bg-muted px-2 py-0.5 rounded-md text-muted-foreground">{c.area}</span>
                      <span className="text-[10px] font-bold uppercase bg-primary/10 px-2 py-0.5 rounded-md text-primary">{c.cargo}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allAnswered = CRITERIOS.every(c => respostas[c.id]);
  const currentScore = allAnswered ? calcularScore(respostas) : null;

  return (
    <div className="min-h-screen pb-24 bg-[#F8F9FA]">
      <div className="glass-header px-6 py-6 mb-6 flex items-center justify-between">
        <div className="flex flex-col">
          <button
            onClick={() => { setSelected(null); setRespostas({}); setObservacoes({}); }}
            className="text-[10px] font-black text-primary uppercase tracking-tighter mb-1 hover:opacity-70 transition-all flex items-center gap-1"
          >
            ← Cancelar e Voltar
          </button>
          <h1 className="text-2xl font-black text-secondary tracking-tight truncate max-w-[200px]">{selected.nome}</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">{selected.area} • {selected.cargo}</p>
        </div>
        
        {currentScore !== null && (
          <div className="flex flex-col items-end animate-chique">
            <p className="text-3xl font-black text-primary">{currentScore}%</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Score Atual</p>
          </div>
        )}
      </div>

      <div className="px-6 space-y-6 animate-chique">
        {CRITERIOS.map((criterio, i) => {
          const val = respostas[criterio.id];
          const obs = observacoes[criterio.id] || '';
          
          return (
            <div 
              key={criterio.id} 
              className="premium-card p-6 rounded-3xl"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="mb-4">
                <div className="flex items-start gap-3">
                   <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                    {i + 1}
                   </div>
                   <div>
                    <p className="font-bold text-secondary text-base leading-tight">{criterio.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{criterio.description}</p>
                   </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => toggleResposta(criterio.id, 'Conforme')}
                  className={`flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all border-2 ${
                    val === 'Conforme'
                      ? 'btn-conforme border-transparent'
                      : 'bg-white text-muted-foreground border-muted hover:border-primary/50'
                  }`}
                >
                  <Check className="h-5 w-5" />
                  Conforme
                </button>
                <button
                  onClick={() => toggleResposta(criterio.id, 'Não Conforme')}
                  className={`flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-all border-2 ${
                    val === 'Não Conforme'
                      ? 'btn-nao-conforme border-transparent'
                      : 'bg-white text-muted-foreground border-muted hover:border-danger/50'
                  }`}
                >
                  <X className="h-5 w-5" />
                  Inadequado
                </button>
              </div>

              <div className="mt-4 relative">
                <label className="text-[10px] font-bold text-muted-foreground mb-1 block uppercase ml-1">Observações do Item</label>
                <Textarea
                  placeholder="Justifique ou detalhe pontos de melhoria..."
                  value={obs}
                  onChange={e => updateObservacao(criterio.id, e.target.value)}
                  rows={2}
                  className="rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 text-xs px-4 py-3 min-h-[80px]"
                />
              </div>
            </div>
          );
        })}

        <div className="pt-6">
          <Button
            onClick={handleSave}
            disabled={saving || !allAnswered || !auditor.trim()}
            className="w-full h-16 text-lg font-black rounded-3xl shadow-2xl transition-all disabled:opacity-50 btn-conforme border-none"
            size="lg"
          >
            {saving ? (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sincronizando...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Save className="h-6 w-6" />
                Finalizar Auditoria
              </div>
            )}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground mt-4 uppercase font-bold tracking-widest">
            Sincronização via Supabase Cloud ativa
          </p>
        </div>
      </div>
    </div>
  );
}

