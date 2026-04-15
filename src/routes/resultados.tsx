import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { classificacaoBg } from '@/lib/constants';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Calendar, Filter } from 'lucide-react';

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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

  const filtered = auditorias.filter(a => {
    if (classFilter && a.classificacao !== classFilter) return false;
    if (areaFilter && a.colaboradores?.area !== areaFilter) return false;
    if (dateFrom && a.data_hora < dateFrom) return false;
    if (dateTo && a.data_hora > dateTo + 'T23:59:59') return false;
    return true;
  });

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Resultados" subtitle={`${filtered.length} auditorias`} />

      <div className="px-4 space-y-3">
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {['', 'Conforme', 'Atenção', 'Não conforme'].map(c => (
            <button
              key={c}
              onClick={() => setClassFilter(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                classFilter === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {c || 'Todas'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          <button
            onClick={() => setAreaFilter('')}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !areaFilter ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            Todas áreas
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

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-0.5 block">De</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Até</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-xs" />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Carregando...</p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(a => (
              <div key={a.id} className="rounded-xl bg-card p-3.5 shadow-sm border border-border/50">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{a.colaboradores?.nome ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{a.colaboradores?.area} · {new Date(a.data_hora).toLocaleDateString('pt-BR')}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Auditor: {a.nome_auditor}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{a.score}%</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${classificacaoBg(a.classificacao)}`}>
                      {a.classificacao}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhuma auditoria encontrada</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
