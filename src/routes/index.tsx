import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CRITERIOS, calcularScore, calcularClassificacao, type CriterioId } from '@/lib/constants';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Search, Check, X, Save, ChevronRight, MessageSquare, Camera, Trash, Loader2 } from 'lucide-react';
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
  const [fotos, setFotos] = useStickyState<string[]>([], 'audit_fotos');
  
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);

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
      const conformeCount = Object.values(respostas).filter(v => v === 'Conforme').length;

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
          pontos: conformeCount,
          classificacao,
          observacoes: observacaoFinalStr,
          fotos: fotos, // Salvando a lista de URLs das fotos
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
      setFotos([]); // Limpa as fotos após salvar
      setSelected(null);
      setSearch('');
    } catch (err: any) {
      console.error('ERRO AUDITORIA:', err);
      toast.error(`Falha ao salvar: ${err.message || 'Erro de conexão'}. Verifique se rodou o comando SQL da coluna "pontos" e criou o bucket "evidencias".`);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Foto muito grande! O limite é 5MB.");
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `audit-${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('evidencias')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('evidencias')
        .getPublicUrl(filePath);

      setFotos(prev => [...prev, publicUrl]);
      toast.success("Foto anexada com sucesso!");
    } catch (error: any) {
      toast.error("Erro no upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeFoto = (urlToRemove: string) => {
    setFotos(prev => prev.filter(url => url !== urlToRemove));
  };

  if (!selected) {
    return (
      <div className="min-h-screen pb-24 bg-[#F4F4F4]">
        <div className="bg-white px-6 py-8 mb-6 border-b border-border shadow-sm">
          <h1 className="text-3xl font-black text-[#424242] tracking-tighter">AuditGrão <span className="text-[#8CC63F]">.</span></h1>
          <p className="text-sm font-bold text-[#605444] mt-1">Gestão de Auditoria Corportativa</p>
        </div>

        <div className="px-6 space-y-6 animate-chique">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-border space-y-4">
            <p className="text-[10px] font-black text-[#605444] uppercase tracking-widest">Identificação do Auditor</p>
            <div>
              <Input
                placeholder="Seu nome completo"
                value={auditor}
                onChange={e => setAuditor(e.target.value)}
                className="h-12 rounded-xl bg-muted/50 border-border text-foreground font-bold focus-visible:ring-primary/30"
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-black text-[#605444] uppercase tracking-widest ml-1">Localizar Colaborador</p>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#605444]" />
              <Input
                placeholder="Nome ou Área..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-12 h-14 rounded-xl bg-white border-border shadow-sm text-foreground font-bold"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
              <button
                onClick={() => setAreaFilter('')}
                className={`shrink-0 rounded-full px-5 py-2 text-xs font-black uppercase transition-all ${
                  !areaFilter ? 'bg-[#605444] text-white shadow-md' : 'bg-white text-[#605444] border border-border shadow-sm'
                }`}
              >
                Todas
              </button>
              {areas.map(area => (
                <button
                  key={area}
                  onClick={() => setAreaFilter(area === areaFilter ? '' : area)}
                  className={`shrink-0 rounded-full px-5 py-2 text-xs font-black uppercase transition-all ${
                    areaFilter === area ? 'bg-[#8CC63F] text-white shadow-md' : 'bg-white text-[#605444] border border-border shadow-sm'
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
                  className="bg-white p-5 rounded-2xl flex items-center justify-between border border-border shadow-sm active:scale-95 text-left transition-all"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <div>
                    <p className="font-black text-[#424242] text-base">{c.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black uppercase bg-[#605444]/10 px-2 py-0.5 rounded text-[#605444]">{c.area}</span>
                      <span className="text-[10px] font-black uppercase bg-[#8CC63F]/10 px-2 py-0.5 rounded text-[#8CC63F]">{c.cargo}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#605444]" />
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
    <div className="min-h-screen pb-24 bg-[#F4F4F4]">
      <div className="bg-white px-6 py-6 mb-6 border-b border-border shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <button
            onClick={() => { setSelected(null); setRespostas({}); setObservacoes({}); }}
            className="text-[10px] font-black text-[#8CC63F] uppercase tracking-tighter mb-1 hover:opacity-70 transition-all"
          >
            ← Voltar para lista
          </button>
          <h1 className="text-xl font-black text-[#424242] tracking-tight truncate max-w-[180px]">{selected.nome}</h1>
          <p className="text-[10px] font-black text-[#605444] uppercase">{selected.area} • {selected.cargo}</p>
        </div>
        
        {currentScore !== null && (
          <div className="flex flex-col items-end animate-chique">
            <p className="text-3xl font-black text-[#8CC63F]">{currentScore}%</p>
            <p className="text-[9px] font-black uppercase text-[#605444]">Score</p>
          </div>
        )}
      </div>

      <div className="px-6 space-y-4 animate-chique">
        {CRITERIOS.map((criterio, i) => {
          const val = respostas[criterio.id];
          const obs = observacoes[criterio.id] || '';
          
          return (
            <div 
              key={criterio.id} 
              className="bg-white p-6 rounded-2xl border border-border shadow-sm"
            >
              <div className="mb-4">
                <div className="flex items-start gap-3">
                   <div className="h-6 w-6 rounded bg-[#8CC63F]/10 text-[#8CC63F] flex items-center justify-center text-[10px] font-black shrink-0">
                    {i + 1}
                   </div>
                   <div>
                    <p className="font-black text-[#424242] text-sm leading-tight uppercase">{criterio.label}</p>
                    <p className="text-xs font-bold text-[#605444] mt-1 leading-relaxed">{criterio.description}</p>
                   </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => toggleResposta(criterio.id, 'Conforme')}
                  className={`flex items-center justify-center gap-2 rounded-xl py-4 text-xs font-bold transition-all border-2 ${
                    val === 'Conforme'
                      ? 'bg-[#8CC63F] text-white border-transparent shadow-md'
                      : 'bg-white text-[#605444] border-muted hover:border-[#8CC63F]/50'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  Conforme
                </button>
                <button
                  onClick={() => toggleResposta(criterio.id, 'Não Conforme')}
                  className={`flex items-center justify-center gap-2 rounded-xl py-4 text-xs font-bold transition-all border-2 ${
                    val === 'Não Conforme'
                      ? 'bg-[#605444] text-white border-transparent shadow-md'
                      : 'bg-white text-[#605444] border-muted hover:border-[#605444]/50'
                  }`}
                >
                  <X className="h-4 w-4" />
                  Inadequado
                </button>
              </div>

              <div className="mt-4">
                <label className="text-[10px] font-black text-[#605444] mb-1 block uppercase">Justificativa / Observação</label>
                <Textarea
                  placeholder="Detalhes sobre a conformidade..."
                  value={obs}
                  onChange={e => updateObservacao(criterio.id, e.target.value)}
                  className="rounded-xl bg-muted/50 border-border text-foreground font-medium text-xs px-4 py-3 min-h-[60px]"
                />
              </div>
            </div>
          );
        })}

        {/* SEÇÃO DE EVIDÊNCIAS FOTOGRÁFICAS */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-[#605444] uppercase tracking-widest">Evidências Fotográficas</p>
              <p className="text-[8px] font-bold text-[#8CC63F] uppercase">Anexe fotos da mesa para comprovação</p>
            </div>
            <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${uploading ? 'bg-muted text-muted-foreground' : 'bg-[#8CC63F] text-white shadow-lg shadow-[#8CC63F]/20'}`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {uploading ? 'Enviando...' : 'Tirar Foto'}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>

          {fotos.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide">
              {fotos.map((url, idx) => (
                <div key={idx} className="relative shrink-0">
                  <img 
                    src={url} 
                    alt={`Evidência ${idx}`} 
                    onClick={() => setPreviewFoto(url)}
                    className="h-36 w-36 object-cover rounded-2xl border-2 border-border shadow-sm active:scale-95 transition-all cursor-pointer" 
                  />
                  <button 
                    onClick={() => removeFoto(url)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white p-2 rounded-full shadow-xl border-2 border-white transition-all active:scale-125"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MODAL DE PREVIEW DA FOTO */}
        {previewFoto && (
          <div 
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 animate-in fade-in duration-200"
            onClick={() => setPreviewFoto(null)}
          >
            <div className="relative max-w-full max-h-full">
              <button className="absolute -top-12 right-0 text-white p-2 flex items-center gap-2 font-black uppercase text-xs">
                <X className="h-6 w-6" /> Fechar
              </button>
              <img src={previewFoto} className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl object-contain border border-white/20" alt="Preview" />
            </div>
          </div>
        )}

        <div className="pt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            className={`w-full h-16 text-base font-black rounded-2xl shadow-xl transition-all border-none uppercase ${
              !allAnswered || !auditor.trim() ? 'bg-gray-400 opacity-70' : 'btn-primary-corp'
            }`}
          >
            {saving ? 'Sincronizando...' : 'Finalizar Auditoria'}
          </Button>
          <p className="text-[9px] text-center text-[#605444] mt-4 uppercase font-black tracking-widest opacity-60">
            AuditDesk v2.0 • Proteção de Dados Ativa
          </p>
        </div>
      </div>
    </div>
  );
}

