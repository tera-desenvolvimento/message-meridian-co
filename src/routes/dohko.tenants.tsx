import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { LogOut, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

export const Route = createFileRoute("/dohko/tenants")({
  component: DohkoTenants,
});

interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  active: boolean;
  createdBy: string | null;
  members: number;
  integration: { provider: string; phone_number: string | null } | null;
}

function DohkoTenants() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/public/dohko/tenants", { credentials: "include" });
    if (res.status === 401) {
      navigate({ to: "/dohko" });
      return;
    }
    const json = (await res.json().catch(() => ({}))) as { tenants?: Tenant[]; error?: string };
    if (!res.ok) {
      setError(json.error ?? "Falha ao carregar");
      return;
    }
    setTenants(json.tenants ?? []);
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/public/dohko/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Falha ao criar");
        return;
      }
      setNewName("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: Tenant) {
    await fetch("/api/public/dohko/tenants", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: t.id, active: !t.active }),
    });
    await load();
  }

  async function rename(t: Tenant) {
    const name = prompt("Novo nome:", t.name);
    if (!name) return;
    await fetch("/api/public/dohko/tenants", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: t.id, name }),
    });
    await load();
  }

  async function remove(t: Tenant) {
    if (!confirm(`Excluir o tenant "${t.name}"? Esta ação é definitiva.`)) return;
    await fetch(`/api/public/dohko/tenants?id=${encodeURIComponent(t.id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await load();
  }

  async function logout() {
    await fetch("/api/public/dohko/logout", { method: "POST", credentials: "include" });
    navigate({ to: "/dohko" });
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-bold tracking-tight">Dohko · Painel</div>
            <div className="text-[11px] text-muted-foreground">Controle de tenants</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
          <button
            onClick={logout}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-accent"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <form onSubmit={createTenant} className="mb-6 flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do novo tenant"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            maxLength={80}
          />
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Criar tenant
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Membros</th>
                <th className="px-4 py-2 text-left">Integração</th>
                <th className="px-4 py-2 text-left">Criado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tenants === null ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhum tenant cadastrado.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => rename(t)}
                        className="font-medium text-foreground hover:underline"
                      >
                        {t.name}
                      </button>
                      <div className="font-mono text-[10px] text-muted-foreground">{t.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      {t.active ? (
                        <span className="rounded bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
                          Ativo
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          Desativado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.members}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.integration
                        ? `${t.integration.provider}${t.integration.phone_number ? " · " + t.integration.phone_number : ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => toggleActive(t)}
                          className="rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-accent"
                        >
                          {t.active ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          onClick={() => remove(t)}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="h-3 w-3" /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
