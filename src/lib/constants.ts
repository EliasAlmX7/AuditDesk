export const CRITERIOS = [
  {
    id: 'mesa_limpa',
    label: 'Mesa limpa',
    description: 'A mesa está sem papéis soltos, avulsos ou acumulados? Documentos do dia estão organizados?',
  },
  {
    id: 'materiais_organizados',
    label: 'Materiais de escritório organizados',
    description: 'Canetas, blocos e post-its estão organizados, sem itens espalhados ou sem propósito?',
  },
  {
    id: 'equipamentos_organizados',
    label: 'Equipamentos organizados',
    description: 'Cabos estão organizados e sem fios ou equipamentos soltos sobre a mesa?',
  },
  {
    id: 'sem_copos',
    label: 'Sem copos ou embalagens',
    description: 'A mesa está livre de copos, embalagens ou restos de alimentos?',
  },
  {
    id: 'itens_pessoais',
    label: 'Itens pessoais sem acúmulo',
    description: 'Há no máximo 3 itens pequenos ou 2 médios, sem acúmulo?',
  },
  {
    id: 'bolsa_lugar_certo',
    label: 'Bolsa ou mochila no lugar certo',
    description: 'Está guardada corretamente, fora da mesa, cadeira ou passagem?',
  },
] as const;

export type CriterioId = typeof CRITERIOS[number]['id'];

export function calcularScore(respostas: Record<string, 'Conforme' | 'Não Conforme'>): number {
  const okCount = Object.values(respostas).filter(r => r === 'Conforme').length;
  return Math.round((okCount / 6) * 100 * 100) / 100;
}

export function calcularClassificacao(score: number): 'Conforme' | 'Atenção' | 'Não conforme' {
  if (score >= 90) return 'Conforme';
  if (score >= 70) return 'Atenção';
  return 'Não conforme';
}

export function classificacaoColor(classificacao: string): string {
  switch (classificacao) {
    case 'Conforme': return 'text-success';
    case 'Atenção': return 'text-warning';
    case 'Não conforme': return 'text-danger';
    default: return 'text-muted-foreground';
  }
}

export function classificacaoBg(classificacao: string): string {
  switch (classificacao) {
    case 'Conforme': return 'bg-success/10 text-success';
    case 'Atenção': return 'bg-warning/10 text-warning';
    case 'Não conforme': return 'bg-danger/10 text-danger';
    default: return 'bg-muted text-muted-foreground';
  }
}
