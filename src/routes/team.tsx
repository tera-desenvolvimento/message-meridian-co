import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/http";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import type { TeamMember, UserRole } from "@/lib/types";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Equipe — Crmly" }] }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <AuthGuard>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <AppHeader />
        <TeamPanel />
      </div>
    </AuthGuard>
  );
}

function TeamPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const list = await api.listUsers();
      setMembers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar equipe");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Equipe</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Gerencie os agentes do workspace e seus papéis.
            </p>
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            {members.length} {members.length === 1 ? "membro" : "membros"}
          </div>
        </div>

        {isAdmin && <InviteForm onInvited={refresh} />}

        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Usuário</th>
                <th className="px-4 py-2.5 text-left font-medium">E-mail</th>
                <th className="px-4 py-2.5 text-left font-medium">Papel</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Nenhum membro ainda.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isAdmin={isAdmin}
                    isSelf={m.id === user?.id}
                    onChanged={refresh}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isAdmin && (
          <p className="mt-4 text-xs text-muted-foreground">
            Apenas administradores podem convidar ou alterar membros.
          </p>
        )}
      </div>
    </div>
  );
}

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("AGENT");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      await api.inviteUser(email.trim(), role);
      setFeedback({ type: "ok", msg: `Convite enviado para ${email}` });
      setEmail("");
      onInvited();
    } catch (err) {
      setFeedback({ type: "err", msg: err instanceof Error ? err.message : "Falha" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 rounded-md border border-border bg-surface p-4"
    >
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Convidar usuário
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          placeholder="email@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          className="h-9 flex-1 rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          disabled={submitting}
          className="h-9 rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary"
        >
          <option value="AGENT">Agente</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <button
          type="submit"
          disabled={submitting || !email.trim()}
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
        >
          {submitting ? "Enviando..." : "Enviar convite"}
        </button>
      </div>
      {feedback && (
        <div
          className={`mt-2 text-xs ${
            feedback.type === "ok" ? "text-success" : "text-destructive"
          }`}
        >
          {feedback.msg}
        </div>
      )}
    </form>
  );
}

function MemberRow({
  member,
  isAdmin,
  isSelf,
  onChanged,
}: {
  member: TeamMember;
  isAdmin: boolean;
  isSelf: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function changeRole(role: UserRole) {
    setBusy(true);
    try {
      await api.updateUserRole(member.id, role);
      onChanged();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Remover ${member.name} do workspace?`)) return;
    setBusy(true);
    try {
      await api.removeUser(member.id);
      onChanged();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-2/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-surface-2 text-[10px] font-semibold text-muted-foreground">
            {member.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="font-medium text-foreground">
            {member.name}
            {isSelf && <span className="ml-1.5 text-[10px] text-muted-foreground">(você)</span>}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{member.email}</td>
      <td className="px-4 py-3">
        {isAdmin && !isSelf ? (
          <select
            value={member.role}
            disabled={busy}
            onChange={(e) => changeRole(e.target.value as UserRole)}
            className="h-7 rounded border border-border bg-input px-2 text-xs outline-none focus:border-primary"
          >
            <option value="AGENT">AGENT</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        ) : (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              member.role === "ADMIN"
                ? "border border-primary/30 bg-primary/10 text-primary"
                : "border border-border bg-surface-2 text-muted-foreground"
            }`}
          >
            {member.role}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 text-xs ${
            member.status === "ACTIVE" ? "text-success" : "text-warning"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {member.status === "ACTIVE" ? "Ativo" : "Convidado"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {isAdmin && !isSelf && (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded border border-border bg-surface-2 px-2 py-1 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
          >
            Remover
          </button>
        )}
      </td>
    </tr>
  );
}
