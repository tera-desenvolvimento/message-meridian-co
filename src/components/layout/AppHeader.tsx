import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

/**
 * Top app bar shown on authenticated pages. Workspace identity + nav + logout.
 */
export function AppHeader() {
  const { user, workspace, logout } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  const navItem = (to: "/" | "/team", label: string) => {
    const active = to === "/" ? path === "/" : path.startsWith(to);
    return (
      <Link
        to={to}
        className={`relative inline-flex h-9 items-center px-3 text-xs font-medium transition ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        {active && <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded bg-primary" />}
      </Link>
    );
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground text-[11px] font-bold">
            {workspace?.name?.[0]?.toUpperCase() ?? "C"}
          </div>
          <span className="text-sm font-semibold tracking-tight">{workspace?.name ?? "Crmly"}</span>
        </div>
        <nav className="flex items-center gap-1">
          {navItem("/", "Inbox")}
          {navItem("/team", "Equipe")}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <div className="text-xs font-medium text-foreground leading-tight">{user?.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {user?.role}
          </div>
        </div>
        <button
          onClick={logout}
          className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border-strong hover:text-foreground"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
