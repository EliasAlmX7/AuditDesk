import { createFileRoute } from '@tanstack/react-router';
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Upload, FileUp, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';

export const Route = createFileRoute('/importar')({
  component: ImportarPage,
});

function ImportarPage() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ total: number; inserted: number; updated: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, delimiter: ';', skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        toast.error('Erro ao ler CSV: ' + parsed.errors[0].message);
        setImporting(false);
        return;
      }

      const rows = parsed.data as Record<string, string>[];
      let inserted = 0;
      let updated = 0;

      for (const row of rows) {
        const nome = (row['Nome'] || row['nome'] || '').trim();
        const area = (row['Área'] || row['Area'] || row['área'] || row['area'] || '').trim();
        const cpf = (row['CPF'] || row['cpf'] || '').trim();
        const cargo = (row['Cargo'] || row['cargo'] || '').trim();

        if (!cpf || !nome) continue;

        const { data: existing } = await supabase
          .from('colaboradores')
          .select('cpf')
          .eq('cpf', cpf)
          .maybeSingle();

        if (existing) {
          await supabase.from('colaboradores').update({ nome, area, cargo, status: 'ativo' }).eq('cpf', cpf);
          updated++;
        } else {
          await supabase.from('colaboradores').insert({ cpf, nome, area, cargo });
          inserted++;
        }
      }

      setResult({ total: rows.length, inserted, updated });
      toast.success(`Importação concluída! ${inserted} novos, ${updated} atualizados`);
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <PageHeader title="Importar" subtitle="Importe colaboradores via CSV" />

      <div className="px-4 space-y-4 mt-4">
        <div className="rounded-xl bg-card p-6 shadow-sm border border-border/50 text-center">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">Selecione o arquivo CSV</p>
          <p className="text-xs text-muted-foreground mb-4">Formato: Nome;Área;CPF;Cargo (separador ;)</p>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
            id="csv-upload"
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="h-12 px-8 text-sm font-semibold rounded-xl"
          >
            <FileUp className="h-5 w-5 mr-2" />
            {importing ? 'Importando...' : 'Escolher Arquivo'}
          </Button>
        </div>

        {result && (
          <div className="rounded-xl bg-success/10 p-4 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-success mb-2" />
            <p className="font-semibold text-sm">Importação concluída!</p>
            <p className="text-xs text-muted-foreground mt-1">
              {result.total} registros · {result.inserted} novos · {result.updated} atualizados
            </p>
          </div>
        )}

        <div className="rounded-xl bg-card p-4 shadow-sm border border-border/50">
          <h3 className="font-semibold text-sm mb-2">Formato esperado</h3>
          <div className="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto">
            <p>Nome;Área;CPF;Cargo</p>
            <p>João Silva;Tech;12345678901;Desenvolvedor</p>
            <p>Maria Santos;G&A;98765432100;Analista</p>
          </div>
        </div>
      </div>
    </div>
  );
}
