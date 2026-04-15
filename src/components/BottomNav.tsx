import { Link, useLocation } from '@tanstack/react-router';
import { ClipboardCheck, BarChart3, ListChecks, Users, Upload } from 'lucide-react';

const navItems = [
  { to: '/' as const, icon: ClipboardCheck, label: 'Auditar' },
  { to: '/resultados' as const, icon: ListChecks, label: 'Resultados' },
  { to: '/dashboard' as const, icon: BarChart3, label: 'Dashboard' },
  { to: '/colaboradores' as const, icon: Users, label: 'Equipe' },
  { to: '/importar' as const, icon: Upload, label: 'Importar' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around py-1.5">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
