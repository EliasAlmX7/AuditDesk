import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { classificacaoBg } from '@/lib/constants';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar, Filter, Trash2, Download, Search } from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/resultados')({
  component: ResultadosPage,
});

type AuditoriaResult = {
  id: string;
  nome_auditor: string;
  data_hora: string;
  score: number;
  classificacao: string;
  observacoes: string | null;
  colaboradores: { nome: string; area: string; cpf: string } | null;
};

function ResultadosPage() {
  const [auditorias, setAuditorias] = useState<AuditoriaResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('auditorias')
      .select('id, nome_auditor, data_hora, score, classificacao, observacoes, colaboradores(nome, area, cpf)')
      .order('data_hora', { ascending: false })
      .limit(200);

    if (data) {
      setAuditorias(data as unknown as AuditoriaResult[]);
      const uniqueAreas = [...new Set(
        (data as unknown as AuditoriaResult[])
          .map(a => a.colaboradores?.area)
          .filter(Boolean) as string[]
      )].sort();
      setAreas(uniqueAreas);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a auditoria de ${nome}?`)) return;
    
    setDeletingId(id);
    try {
      // 1. Deletar as respostas ligadas a essa auditoria
      const { error: resError } = await supabase.from('respostas').delete().eq('auditoria_id', id);
      if (resError) throw resError;

      // 2. Deletar o registro da auditoria
      const { error: audError } = await supabase.from('auditorias').delete().eq('id', id);
      if (audError) throw audError;
      
      toast.success('Auditoria removida permanentemente');
      setAuditorias(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      console.error('Falha na exclusão:', err);
      toast.error('Erro ao excluir do banco de dados: ' + (err.message || 'Verifique suas permissões no Supabase'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadCSV = () => {
    if (filtered.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    // Cabeçalho do CSV
    const headers = ['Data', 'Cod. Colaborador', 'Colaborador', 'Área', 'Score', 'Classificação', 'Auditor', 'Observações'];
    
    // Linhas do CSV
    const rows = filtered.map(a => [
      new Date(a.data_hora).toLocaleString('pt-BR'),
      a.colaboradores?.cpf || '',
      a.colaboradores?.nome || '',
      a.colaboradores?.area || '',
      `${a.score}%`,
      a.classificacao,
      a.nome_auditor,
      (a.observacoes || '').replace(/\n/g, ' ')
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_auditoria_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Planilha gerada com sucesso');
  };

  const filtered = auditorias.filter(a => {
    if (classFilter && a.classificacao !== classFilter) return false;
    if (areaFilter && a.colaboradores?.area !== areaFilter) return false;
    if (dateFrom && a.data_hora < dateFrom) return false;
    if (dateTo && a.data_hora > dateTo + 'T23:59:59') return false;
    return true;
  });

  return (
    <div className="min-h-screen pb-24 bg-[#F4F4F4]">
      <div className="bg-white px-6 py-8 mb-6 border-b border-border shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-[#424242] tracking-tighter">AuditGrão <span className="text-[#8CC63F]">.</span></h1>
          <p className="text-sm font-bold text-[#605444] mt-1">{filtered.length} Registros Sincronizados</p>
        </div>
        <Button 
          onClick={handleDownloadCSV} 
          className="btn-primary-corp rounded-xl h-12 gap-2 text-[10px] font-black uppercase px-6"
        >
          <Download className="h-4 w-4" />
          Planilha
        </Button>
      </div>

      <div className="px-6 space-y-6 animate-chique">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-border space-y-5">
          <p className="text-[10px] font-black text-[#605444] uppercase tracking-widest">Painel de Pesquisa</p>
          
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2">
              {['', 'Conforme', 'Atenção', 'Não conforme'].map(c => (
                <button
                  key={c}
                  onClick={() => setClassFilter(c)}
                  className={`shrink-0 rounded-full px-5 py-2 text-[10px] font-black uppercase transition-all ${
                    classFilter === c ? 'bg-[#605444] text-white shadow-md' : 'bg-muted text-[#605444] border border-border'
                  }`}
                >
                  {c || 'Todos Status'}
                </button>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2 border-t border-border pt-4">
              <button
                onClick={() => setAreaFilter('')}
                className={`shrink-0 rounded-full px-5 py-2 text-[10px] font-black uppercase transition-all ${
                  !areaFilter ? 'bg-[#8CC63F] text-white shadow-md' : 'bg-muted text-[#605444] border border-border'
                }`}
              >
                Todas Áreas
              </button>
              {areas.map(area => (
                <button
                  key={area}
                  onClick={() => setAreaFilter(area === areaFilter ? '' : area)}
                  className={`shrink-0 rounded-full px-5 py-2 text-[10px] font-black uppercase transition-all ${
                    areaFilter === area ? 'bg-[#8CC63F] text-white shadow-md' : 'bg-muted text-[#605444] border border-border'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#605444] uppercase ml-1">Início</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-11 rounded-xl bg-muted/50 border-border text-xs font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#605444] uppercase ml-1">Fim</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-11 rounded-xl bg-muted/50 border-border text-xs font-bold" />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-8 w-8 border-4 border-[#8CC63F] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#605444]">Conectando à Nuvem...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((a, i) => (
              <div 
                key={a.id} 
                className="bg-white p-6 rounded-2xl border border-border shadow-sm"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-black text-[#424242] text-lg leading-tight tracking-tighter">{a.colaboradores?.nome ?? '—'}</p>
                      <span className={`inline-block rounded px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${classificacaoBg(a.classificacao)}`}>
                        {a.classificacao}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      <p className="text-[10px] font-bold text-[#605444] flex items-center gap-1.5 uppercase">
                        <Filter className="h-3 w-3 text-[#8CC63F]" /> {a.colaboradores?.area}
                      </p>
                      <p className="text-[10px] font-bold text-[#605444] flex items-center gap-1.5 uppercase">
                        <Calendar className="h-3 w-3 text-[#8CC63F]" /> {new Date(a.data_hora).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <p className="text-[9px] font-black text-[#605444] uppercase opacity-70">
                        Auditor: {a.nome_auditor}
                      </p>
                      <button 
                        onClick={() => handleDelete(a.id, a.colaboradores?.nome || '')}
                        disabled={deletingId === a.id}
                        className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-xl transition-all"
                      >
                        <Trash2 className={`h-4 w-4 ${deletingId === a.id ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="pl-6 text-right w-32 border-l border-border/50">
                    <div className="flex items-baseline justify-end gap-1">
                      <p className="text-3xl font-black text-[#424242] tracking-tighter">{a.score}</p>
                      <p className="text-sm font-black text-[#8CC63F]">%</p>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <p className="text-sm font-black text-[#605444]">{a.pontos || 0}</p>
                      <p className="text-[10px] font-black text-[#8CC63F]">/ 6 PTS</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-border">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-[10px] font-black text-[#605444] uppercase tracking-widest">Nenhum Registro Encontrado</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
