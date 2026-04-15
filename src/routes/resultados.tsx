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
      // Deletar primeiro as respostas (devido à chave estrangeira)
      await supabase.from('respostas').delete().eq('auditoria_id', id);
      const { error } = await supabase.from('auditorias').delete().eq('id', id);
      
      if (error) throw error;
      
      toast.success('Auditoria removida com sucesso');
      setAuditorias(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
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
    <div className="min-h-screen pb-24 bg-muted/20">
      <PageHeader title="Resultados" subtitle={`${filtered.length} auditorias encontradas`} />

      <div className="px-4 space-y-4">
        {/* Actions bar */}
        <div className="flex justify-between items-center bg-card p-3 rounded-xl border border-border/50 shadow-sm">
           <p className="text-xs font-bold text-muted-foreground uppercase">Ações Rápidas</p>
           <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="h-8 gap-2 text-xs font-bold">
              <Download className="h-3.5 w-3.5" />
              Exportar Planilha
           </Button>
        </div>

        {/* Filters */}
        <div className="space-y-3 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Filtros de Busca</p>
          
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {['', 'Conforme', 'Atenção', 'Não conforme'].map(c => (
              <button
                key={c}
                onClick={() => setClassFilter(c)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  classFilter === c ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {c || 'Todas Situações'}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setAreaFilter('')}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                !areaFilter ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Todas Áreas
            </button>
            {areas.map(area => (
              <button
                key={area}
                onClick={() => setAreaFilter(area === areaFilter ? '' : area)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  areaFilter === area ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {area}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Início</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 text-xs rounded-lg" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Fim</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 text-xs rounded-lg" />
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-muted-foreground">Sincronizando dados...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(a => (
              <div key={a.id} className="group relative rounded-xl bg-card p-4 shadow-sm border border-border/50 hover:border-primary/30 transition-all hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm text-foreground">{a.colaboradores?.nome ?? '—'}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight ${classificacaoBg(a.classificacao)}`}>
                        {a.classificacao}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Filter className="h-3 w-3" /> {a.colaboradores?.area}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Calendar className="h-3 w-3" /> {new Date(a.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground mt-2 bg-muted/50 inline-block px-2 py-0.5 rounded">
                      Auditor: {a.nome_auditor}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-3">
                    <p className="text-2xl font-black text-foreground">{a.score}<span className="text-xs font-bold text-muted-foreground">%</span></p>
                    <button 
                      onClick={() => handleDelete(a.id, a.colaboradores?.nome || '')}
                      disabled={deletingId === a.id}
                      className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                      title="Excluir Auditoria"
                    >
                      <Trash2 className={`h-4 w-4 ${deletingId === a.id ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border/60">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">Nenhuma auditoria encontrada</p>
                <p className="text-xs text-muted-foreground mt-1">Tente ajustar os filtros acima.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
