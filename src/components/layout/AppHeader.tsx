import { Link, useLocation } from "@tanstack/react-router";
import { Bot, Inbox, LogOut, Moon, Settings as SettingsIcon, Sparkles, Sun, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/permissions";

/**
 * Barra lateral esquerda com a navegação principal do app autenticado.
 *
 * Em telas pequenas exibe apenas ícones (w-14); em telas md+ expande
 * para mostrar os rótulos (w-56). Mantém o nome do componente
 * `AppHeader` por compatibilidade com as rotas que já o importam.
 */
export function AppHeader() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const path = location.pathname;

  const items: {
    to: "/" | "/team" | "/chatbot" | "/ai" | "/settings";
    label: string;
    icon: typeof Inbox;
  }[] = [
    { to: "/", label: "Caixa de entrada", icon: Inbox },
    { to: "/team", label: "Equipe", icon: Users },
    { to: "/chatbot", label: "Chatbot", icon: Bot },
    { to: "/ai", label: "IA", icon: Sparkles },
    { to: "/settings", label: "Configurações", icon: SettingsIcon },
  ];

  return (
    <aside className="flex h-dvh w-14 shrink-0 flex-col border-r border-border bg-card text-card-foreground md:w-56">
      <div className="flex h-12 items-center gap-2 border-b border-border px-3">
        <img src="/logo.svg" alt="Dohkochat" className="h-6 w-auto shrink-0" />
        <span className="hidden truncate text-sm font-bold tracking-tight md:inline">
          Dohkochat
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
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
                "inline-flex h-9 items-center gap-2 rounded-md px-2 text-xs font-medium transition md:px-3",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border p-2">
        <div className="hidden px-1 md:block">
          <div className="truncate text-xs font-medium leading-tight text-foreground">
            {user?.name}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {user?.role ? ROLE_LABELS[user.role] : "—"}
          </div>
        </div>
        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="hidden md:inline">
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </span>
        </button>
        <button
          onClick={logout}
          title="Sair"
          aria-label="Sair"
          className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">Sair</span>
        </button>
      </div>
    </aside>
  );
}
