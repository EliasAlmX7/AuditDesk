import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Search, ChevronRight } from 'lucide-react';

export const Route = createFileRoute('/colaboradores')({
  component: ColaboradoresPage,
});

type Colaborador = {
  cpf: string;
  nome: string;
  area: string;
  cargo: string;
  status: string;
};

function ColaboradoresPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase
      .from('colaboradores')
      .select('cpf, nome, area, cargo, status')
      .order('nome')
      .then(({ data }) => { if (data) setColaboradores(data); });
  }, []);

  const filtered = colaboradores.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Equipe" subtitle={`${colaboradores.length} colaboradores`} />

      <div className="px-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        <div className="space-y-1.5">
          {filtered.map(c => (
            <Link
              key={c.cpf}
              to="/colaborador/$cpf"
              params={{ cpf: c.cpf }}
              className="w-full flex items-center justify-between rounded-xl bg-card p-3.5 shadow-sm border border-border/50"
            >
              <div>
                <p className="font-semibold text-sm">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.area} · {c.cargo}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
