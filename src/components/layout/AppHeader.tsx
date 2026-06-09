import { Link, useLocation } from "@tanstack/react-router";
import { Inbox, LogOut, Moon, Settings as SettingsIcon, Sun, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

/**
 * Top app bar shown on authenticated pages. Workspace identity + nav + logout.
 *
 * Em telas pequenas, a navegação aparece como ícones para economizar espaço,
 * e o e-mail/role do usuário fica oculto. O nome do workspace é truncado para
 * evitar quebras de layout.
 */
export function AppHeader() {
  const { user, workspace, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const path = location.pathname;

  const items: {
    to: "/" | "/team" | "/settings";
    label: string;
    icon: typeof Inbox;
  }[] = [
    { to: "/", label: "Caixa de entrada", icon: Inbox },
    { to: "/team", label: "Equipe", icon: Users },
    { to: "/settings", label: "Configurações", icon: SettingsIcon },
  ];

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-primary px-3 sm:px-4 text-white">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/logo.svg" alt="Dohkozap" className="h-6 w-auto shrink-0" />
          <span className="hidden truncate text-sm font-bold tracking-tight sm:inline">
            Dohkozap
          </span>
        </div>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {items.map((item) => {
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "relative inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition sm:px-3",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">{item.label}</span>
                {active && (
                  <span className="pointer-events-none absolute -bottom-px left-2 right-2 h-0.5 rounded bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden text-right md:block">
          <div className="text-xs font-medium leading-tight text-foreground">{user?.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {user?.role === "ADMIN" ? "Admin" : "Agente"}
          </div>
        </div>
        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground transition hover:border-border-strong hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={logout}
          title="Sair"
          aria-label="Sair"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 text-xs font-medium text-muted-foreground transition hover:border-border-strong hover:text-foreground sm:px-3"
        >
          <LogOut className="h-3.5 w-3.5 sm:hidden" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
