export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-4 pt-3 pb-2">
      <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </header>
  );
}
