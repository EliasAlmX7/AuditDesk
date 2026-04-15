import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { classificacaoBg } from '@/lib/constants';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft } from 'lucide-react';

export const Route = createFileRoute('/colaborador/$cpf')({
  component: ColaboradorDetailPage,
});

function ColaboradorDetailPage() {
  const { cpf } = Route.useParams();
  const [colaborador, setColaborador] = useState<any>(null);
  const [auditorias, setAuditorias] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('colaboradores').select('*').eq('cpf', cpf).single().then(({ data }) => setColaborador(data));
    supabase.from('auditorias').select('*').eq('cpf_colaborador', cpf).order('data_hora', { ascending: true }).then(({ data }) => {
      if (data) setAuditorias(data);
    });
  }, [cpf]);

  if (!colaborador) return <div className="min-h-screen pb-24 flex items-center justify-center"><p className="text-sm text-muted-foreground">Carregando...</p></div>;

  const chartData = auditorias.map(a => ({
    data: new Date(a.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    score: a.score,
  }));

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-3 pb-2">
        <Link to="/colaboradores" className="text-xs text-primary font-medium mb-1 flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </Link>
        <h1 className="text-xl font-bold tracking-tight">{colaborador.nome}</h1>
        <p className="text-xs text-muted-foreground">{colaborador.area} · {colaborador.cargo} · CPF: {colaborador.cpf}</p>
      </div>

      <div className="px-4 space-y-4 mt-2">
        {/* Score evolution chart */}
        {chartData.length > 1 && (
          <div className="rounded-xl bg-card p-3.5 shadow-sm border border-border/50">
            <h2 className="font-semibold text-sm mb-3">Evolução do Score</h2>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Audit history */}
        <h2 className="font-semibold text-sm">Histórico ({auditorias.length})</h2>
        <div className="space-y-1.5">
          {[...auditorias].reverse().map(a => (
            <div key={a.id} className="rounded-xl bg-card p-3.5 shadow-sm border border-border/50 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{new Date(a.data_hora).toLocaleDateString('pt-BR')} · {a.nome_auditor}</p>
                {a.observacoes && <p className="text-xs text-muted-foreground mt-0.5 italic">{a.observacoes}</p>}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{a.score}%</p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${classificacaoBg(a.classificacao)}`}>
                  {a.classificacao}
                </span>
              </div>
            </div>
          ))}
          {auditorias.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma auditoria encontrada</p>
          )}
        </div>
      </div>
    </div>
  );
}
