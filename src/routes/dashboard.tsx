import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CRITERIOS, classificacaoBg } from '@/lib/constants';
import { PageHeader } from '@/components/PageHeader';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

type AuditoriaRow = {
  id: string;
  cpf_colaborador: string;
  score: number;
  classificacao: string;
  data_hora: string;
  colaboradores: { nome: string; area: string } | null;
};

type ColaboradorRow = {
  cpf: string;
  nome: string;
  area: string;
};

type RespostaRow = {
  criterio: string;
  resposta: string;
};

function DashboardPage() {
  const [auditorias, setAuditorias] = useState<AuditoriaRow[]>([]);
  const [respostas, setRespostas] = useState<RespostaRow[]>([]);
  const [colaboradores, setColaboradores] = useState<ColaboradorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('auditorias').select('id, cpf_colaborador, score, classificacao, data_hora, colaboradores(nome, area)').order('data_hora', { ascending: false }).limit(2000),
      supabase.from('respostas').select('criterio, resposta').limit(10000),
      supabase.from('colaboradores').select('cpf, nome, area').eq('status', 'ativo'),
    ]).then(([audRes, respRes, colRes]) => {
      if (audRes.data) setAuditorias(audRes.data as unknown as AuditoriaRow[]);
      if (respRes.data) setRespostas(respRes.data);
      if (colRes.data) setColaboradores(colRes.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="min-h-screen pb-24"><PageHeader title="Dashboard" /><p className="text-center text-sm text-muted-foreground py-12">Carregando...</p></div>;

  const totalAuditorias = auditorias.length;
  const mediaGeral = totalAuditorias > 0 ? Math.round(auditorias.reduce((s, a) => s + a.score, 0) / totalAuditorias * 100) / 100 : 0;
  const conformes = auditorias.filter(a => a.classificacao === 'Conforme').length;
  const percentConformidade = totalAuditorias > 0 ? Math.round((conformes / totalAuditorias) * 100) : 0;

  // NÃO OK por critério
  const naoOkPorCriterio = CRITERIOS.map(c => {
    const total = respostas.filter(r => r.criterio === c.id);
    const naoOk = total.filter(r => r.resposta === 'NÃO OK').length;
    return { name: c.label.slice(0, 15), naoOk, total: total.length };
  }).sort((a, b) => b.naoOk - a.naoOk);

  // Ranking por área
  const areaMap = new Map<string, number[]>();
  auditorias.forEach(a => {
    const area = a.colaboradores?.area || 'N/A';
    if (!areaMap.has(area)) areaMap.set(area, []);
    areaMap.get(area)!.push(a.score);
  });
  const rankingArea = [...areaMap.entries()]
    .map(([area, scores]) => ({ area, media: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) }))
    .sort((a, b) => b.media - a.media);

  // Pendências por área
  const auditadosCpfs = new Set(auditorias.map(a => a.cpf_colaborador));
  const pendenciasPorAreaMap = new Map<string, { total: number; auditados: number }>();
  
  colaboradores.forEach(c => {
    const stats = pendenciasPorAreaMap.get(c.area) || { total: 0, auditados: 0 };
    stats.total++;
    if (auditadosCpfs.has(c.cpf)) stats.auditados++;
    pendenciasPorAreaMap.set(c.area, stats);
  });

  const pendenciasArea = [...pendenciasPorAreaMap.entries()]
    .map(([area, stats]) => ({
      area,
      pendentes: stats.total - stats.auditados,
      total: stats.total,
      percent: Math.round((stats.auditados / stats.total) * 100)
    }))
    .sort((a, b) => b.pendentes - a.pendentes);

  // Top/bottom colaboradores
  const colabMap = new Map<string, { nome: string; scores: number[] }>();
  auditorias.forEach(a => {
    const key = a.cpf_colaborador;
    if (!colabMap.has(key)) colabMap.set(key, { nome: a.colaboradores?.nome || key, scores: [] });
    colabMap.get(key)!.scores.push(a.score);
  });
  const rankingColab = [...colabMap.entries()]
    .map(([_, v]) => ({ nome: v.nome, media: Math.round(v.scores.reduce((s, x) => s + x, 0) / v.scores.length) }))
    .sort((a, b) => b.media - a.media);

  const barColor = '#6366f1';

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Dashboard" subtitle={`${totalAuditorias} auditorias realizadas`} />

      <div className="px-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-card p-3 shadow-sm border border-border/50 text-center">
            <p className="text-2xl font-bold">{mediaGeral}%</p>
            <p className="text-[10px] text-muted-foreground">Média Geral</p>
          </div>
          <div className="rounded-xl bg-card p-3 shadow-sm border border-border/50 text-center">
            <p className="text-2xl font-bold">{percentConformidade}%</p>
            <p className="text-[10px] text-muted-foreground">Conformidade</p>
          </div>
          <div className="rounded-xl bg-card p-3 shadow-sm border border-border/50 text-center">
            <p className="text-2xl font-bold">{totalAuditorias}</p>
            <p className="text-[10px] text-muted-foreground">Auditorias</p>
          </div>
        </div>

        {/* NÃO OK por critério */}
        <div className="rounded-xl bg-card p-3.5 shadow-sm border border-border/50">
          <h2 className="font-semibold text-sm mb-3">Problemas por Critério</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={naoOkPorCriterio} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={90} />
              <Tooltip formatter={(v) => [`${v} NÃO OK`, 'Qtde']} />
              <Bar dataKey="naoOk" radius={[0, 4, 4, 0]}>
                {naoOkPorCriterio.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#ef4444' : i === 1 ? '#f97316' : barColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Ranking por área */}
        <div className="rounded-xl bg-card p-3.5 shadow-sm border border-border/50">
          <h2 className="font-semibold text-sm mb-2">Ranking por Área</h2>
          <div className="space-y-1.5">
            {rankingArea.map((a, i) => (
              <div key={a.area} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                  <span className="text-sm">{a.area}</span>
                </div>
                <span className="text-sm font-bold">{a.media}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pendências por Área */}
        <div className="rounded-xl bg-card p-3.5 shadow-sm border border-border/50">
          <h2 className="font-semibold text-sm mb-2 text-orange-600">Pendências de Auditoria</h2>
          <div className="space-y-2.5">
            {pendenciasArea.map(p => (
              <div key={p.area} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">{p.area}</span>
                  <span className="text-muted-foreground">{p.pendentes} faltantes de {p.total}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${p.percent === 100 ? 'bg-[#8CC63F]' : 'bg-orange-500'}`}
                    style={{ width: `${p.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking colaboradores */}
        <div className="rounded-xl bg-card p-3.5 shadow-sm border border-border/50">
          <h2 className="font-semibold text-sm mb-2">Ranking de Colaboradores</h2>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {rankingColab.slice(0, 20).map((c, i) => (
              <div key={c.nome} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                  <span className="text-sm truncate max-w-[200px]">{c.nome}</span>
                </div>
                <span className="text-sm font-bold">{c.media}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
