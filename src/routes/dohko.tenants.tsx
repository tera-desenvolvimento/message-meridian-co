import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Lock, LogOut, Plus, RefreshCw, Settings2, ShieldCheck, Trash2, Unlock, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dohko/tenants")({
  component: DohkoTenants,
});

interface TenantUser {
  membershipId: string;
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  joinedAt: string;
}

interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  active: boolean;
  createdBy: string | null;
  members: number;
  integration: { provider: string; phone_number: string | null } | null;
  users: TenantUser[];
}

interface TenantTableProps {
  tenants: Tenant[] | null;
  onRename: (tenant: Tenant) => void;
  onToggleTenant: (tenant: Tenant) => void;
  onToggleUser: (user: TenantUser) => void;
  onRemove: (tenant: Tenant) => void;
  onEditIntegration: (tenant: Tenant) => void;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-[10px] font-semibold uppercase",
        active
          ? "bg-success/10 text-success"
          : "bg-muted text-muted-foreground",
      )}
    >
      {active ? "Ativo" : "Bloqueado"}
    </span>
  );
}

function TenantUsers({ users, onToggleUser }: { users: TenantUser[]; onToggleUser: (user: TenantUser) => void }) {
  if (users.length === 0) return <div className="text-xs text-muted-foreground">Sem usuários cadastrados.</div>;

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <div
          key={user.membershipId}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
        >
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-foreground">{user.name}</div>
            <div className="truncate font-mono text-[10px] text-muted-foreground">{user.email}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {user.role}
              </span>
              <StatusBadge active={user.active} />
            </div>
          </div>
          <button
            onClick={() => onToggleUser(user)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              user.active
                ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "border-border bg-card text-foreground",
            )}
          >
            {user.active ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {user.active ? "Travar" : "Liberar"}
          </button>
        </div>
      ))}
    </div>
  );
}

function TenantTable({ tenants, onRename, onToggleTenant, onToggleUser, onRemove, onEditIntegration }: TenantTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">Workspace</th>
            <th className="px-4 py-2 text-left">Usuários cadastrados</th>
            <th className="px-4 py-2 text-left">Integração</th>
            <th className="px-4 py-2 text-left">Criado</th>
            <th className="px-4 py-2" aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {tenants === null ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                Carregando cadastros…
              </td>
            </tr>
          ) : tenants.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                Nenhum workspace cadastrado.
              </td>
            </tr>
          ) : (
            tenants.map((tenant) => (
              <TenantRow
                key={tenant.id}
                tenant={tenant}
                onRename={onRename}
                onToggleTenant={onToggleTenant}
                onToggleUser={onToggleUser}
                onRemove={onRemove}
                onEditIntegration={onEditIntegration}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TenantRow({
  tenant,
  onRename,
  onToggleTenant,
  onToggleUser,
  onRemove,
  onEditIntegration,
}: {
  tenant: Tenant;
  onRename: (tenant: Tenant) => void;
  onToggleTenant: (tenant: Tenant) => void;
  onToggleUser: (user: TenantUser) => void;
  onRemove: (tenant: Tenant) => void;
  onEditIntegration: (tenant: Tenant) => void;
}) {
  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-3">
        <button onClick={() => onRename(tenant)} className="font-medium text-foreground hover:underline">
          {tenant.name}
        </button>
        <div className="mt-1 flex items-center gap-2">
          <StatusBadge active={tenant.active} />
          <span className="text-[10px] text-muted-foreground">{tenant.members} membro(s)</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">{tenant.id}</div>
      </td>
      <td className="w-[38rem] px-4 py-3">
        <TenantUsers users={tenant.users} onToggleUser={onToggleUser} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        <div className="text-xs">
          {tenant.integration
            ? `${tenant.integration.provider}${tenant.integration.phone_number ? " · " + tenant.integration.phone_number : ""}`
            : <span className="text-destructive">Não configurada</span>}
        </div>
        <button
          onClick={() => onEditIntegration(tenant)}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-accent"
        >
          <Settings2 className="h-3 w-3" /> Configurar API
        </button>
      </td>
      <td className="px-4 py-3 text-[11px] text-muted-foreground">
        {new Date(tenant.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => onToggleTenant(tenant)}
            className="rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-accent"
          >
            {tenant.active ? "Travar workspace" : "Liberar workspace"}
          </button>
          <button
            onClick={() => onRemove(tenant)}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20"
          >
            <Trash2 className="h-3 w-3" /> Excluir
          </button>
        </div>
      </td>
    </tr>
  );
}

interface IntegrationForm {
  api_url: string;
  token: string;
  webhook_secret: string;
  phone_number: string;
  enabled: boolean;
}

function IntegrationModal({
  tenant,
  onClose,
  onSaved,
}: {
  tenant: Tenant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<IntegrationForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(
        `/api/public/dohko/integration?workspaceId=${encodeURIComponent(tenant.id)}`,
        { credentials: "include" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        integration?: IntegrationForm;
        error?: string;
      };
      if (!alive) return;
      if (!res.ok) {
        setErr(json.error ?? "Falha ao carregar");
        return;
      }
      setForm({
        api_url: json.integration?.api_url ?? "https://gate.whapi.cloud",
        token: json.integration?.token ?? "",
        webhook_secret: json.integration?.webhook_secret ?? "",
        phone_number: json.integration?.phone_number ?? "",
        enabled: json.integration?.enabled ?? false,
      });
    })();
    return () => {
      alive = false;
    };
  }, [tenant.id]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/public/dohko/integration", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ workspaceId: tenant.id, ...form }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setErr(json.error ?? "Falha ao salvar");
      return;
    }
    onSaved();
    onClose();
  }

  const PROJECT_ID = "8d07022c-e934-4b33-8808-5da870e1f74b";
  const webhookBase = `https://project--${PROJECT_ID}.lovable.app/api/public/whapi-webhook`;
  const webhookUrl = form?.webhook_secret
    ? `${webhookBase}?secret=${encodeURIComponent(form.webhook_secret)}`
    : webhookBase;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="text-sm font-semibold">Integração Whapi · {tenant.name}</div>
            <div className="text-[11px] text-muted-foreground">Configuração distribuída para o tenant</div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!form ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <>
              <ModalField
                label="URL base da API"
                value={form.api_url}
                onChange={(v) => setForm({ ...form, api_url: v })}
                placeholder="https://gate.whapi.cloud"
              />
              <ModalField
                label="Token (Bearer)"
                type="password"
                value={form.token}
                onChange={(v) => setForm({ ...form, token: v })}
                placeholder="Cole o token do canal Whapi"
              />
              <ModalField
                label="Segredo do webhook"
                type="password"
                value={form.webhook_secret}
                onChange={(v) => setForm({ ...form, webhook_secret: v })}
                placeholder="Identifica este tenant no webhook"
              />
              <ModalField
                label="Número / identificador do canal"
                value={form.phone_number}
                onChange={(v) => setForm({ ...form, phone_number: v })}
                placeholder="+55 11 99999-9999"
              />

              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="font-medium">Integração ativa</span>
              </label>

              <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[11px] text-muted-foreground">
                <div className="mb-1 font-semibold uppercase tracking-wider">URL do webhook</div>
                <div className="break-all font-mono">{webhookUrl}</div>
              </div>

              {err && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {err}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-xs"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !form}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar integração"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function DohkoTenants() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [integrationTenant, setIntegrationTenant] = useState<Tenant | null>(null);

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

  async function toggleUserAccess(user: TenantUser) {
    await fetch("/api/public/dohko/tenants", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ membershipId: user.membershipId, membershipActive: !user.active }),
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
            <div className="text-sm font-bold tracking-tight">Dohko · Cadastros</div>
            <div className="text-[11px] text-muted-foreground">Workspaces, usuários e bloqueios</div>
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
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cadastros de tenants</h1>
          <p className="text-sm text-muted-foreground">
            Visualize workspaces ativos, usuários vinculados e trave ou libere acessos individualmente.
          </p>
        </div>

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

        <TenantTable
          tenants={tenants}
          onRename={rename}
          onToggleTenant={toggleActive}
          onToggleUser={toggleUserAccess}
          onRemove={remove}
        />
      </main>
    </div>
  );
}
