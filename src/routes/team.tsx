import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, UserCog } from "lucide-react";
import { api } from "@/lib/http";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  const { user, refresh: refreshAuth } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editingSelf, setEditingSelf] = useState(false);

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

  const selfMember = members.find((m) => m.id === user?.id) ?? null;

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
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditingSelf(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground/80 transition hover:bg-surface-2"
            >
              <UserCog className="h-3.5 w-3.5" />
              Editar meu perfil
            </button>
            <div className="text-xs font-mono text-muted-foreground">
              {members.length} {members.length === 1 ? "membro" : "membros"}
            </div>
          </div>
        </div>

        {isAdmin && <AddMemberForm onAdded={refresh} />}

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
                    onEdit={() => setEditing(m)}
                    onChanged={refresh}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isAdmin && (
          <p className="mt-4 text-xs text-muted-foreground">
            Apenas administradores podem convidar ou alterar outros membros.
          </p>
        )}
      </div>

      {editing && (
        <EditMemberDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}

      {editingSelf && (
        <EditSelfDialog
          currentName={selfMember?.name ?? user?.name ?? ""}
          onClose={() => setEditingSelf(false)}
          onSaved={async () => {
            setEditingSelf(false);
            await refresh();
            await refreshAuth();
          }}
        />
      )}
    </div>
  );
}

function InviteForm({ onInvited }: { onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("AGENT");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [pending, setPending] = useState<import("@/lib/types").Invitation[]>([]);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    try {
      const list = await api.listInvitations();
      setPending(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setFeedback({ type: "err", msg: "Informe o e-mail do convidado." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const inv = await api.createInvitation(cleanEmail, role);
      const sent = await api.sendInvitationEmail(inv);
      if (sent.ok) {
        setFeedback({
          type: "ok",
          msg: `Convite enviado para ${cleanEmail}. Ele receberá o link por e-mail.`,
        });
      } else {
        setFeedback({
          type: "err",
          msg: `Convite criado, mas falha ao enviar e-mail: ${sent.error}. Use "Reenviar" abaixo.`,
        });
      }
      setEmail("");
      await refreshPending();
      onInvited();
    } catch (err) {
      setFeedback({ type: "err", msg: err instanceof Error ? err.message : "Falha" });
    } finally {
      setSubmitting(false);
    }
  }

  async function resend(inv: import("@/lib/types").Invitation) {
    if (!inv.email) return;
    setResendingId(inv.id);
    try {
      const sent = await api.sendInvitationEmail(inv);
      if (sent.ok) {
        setFeedback({ type: "ok", msg: `E-mail reenviado para ${inv.email}.` });
      } else {
        setFeedback({ type: "err", msg: `Falha ao reenviar: ${sent.error}` });
      }
    } finally {
      setResendingId(null);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Cancelar este convite? O link deixará de funcionar.")) return;
    try {
      await api.revokeInvitation(id);
      await refreshPending();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="mb-6 space-y-3">
      <form
        onSubmit={onSubmit}
        className="rounded-md border border-border bg-surface p-4"
      >
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Convidar usuário
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Informe o e-mail do novo membro e o papel desejado. Enviaremos um link de
          convite diretamente por e-mail — ao aceitar, ele entra automaticamente
          no workspace.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            placeholder="email@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
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
            disabled={submitting}
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

      {pending.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Convites pendentes ({pending.length})
          </div>
          <ul className="space-y-2">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-2 rounded border border-border bg-surface-2 p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground">
                    {inv.email || <span className="text-muted-foreground">(sem e-mail)</span>}{" "}
                    <span className="ml-1.5 rounded bg-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {inv.role}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Expira em {new Date(inv.expiresAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                {inv.email && (
                  <button
                    onClick={() => resend(inv)}
                    disabled={resendingId === inv.id}
                    className="shrink-0 rounded border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-50"
                  >
                    {resendingId === inv.id ? "Reenviando..." : "Reenviar e-mail"}
                  </button>
                )}
                <button
                  onClick={() => revoke(inv.id)}
                  className="shrink-0 rounded border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                >
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  isAdmin,
  isSelf,
  onEdit,
  onChanged,
}: {
  member: TeamMember;
  isAdmin: boolean;
  isSelf: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isDisabled = !member.active;

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
    <tr
      className={`border-b border-border last:border-0 hover:bg-surface-2/50 ${
        isDisabled ? "opacity-60" : ""
      }`}
    >
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
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            member.role === "ADMIN"
              ? "border border-primary/30 bg-primary/10 text-primary"
              : "border border-border bg-surface-2 text-muted-foreground"
          }`}
        >
          {member.role}
        </span>
      </td>
      <td className="px-4 py-3">
        {isDisabled ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Desativado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Ativo
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1.5">
          {isAdmin && !isSelf && (
            <button
              onClick={onEdit}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              <Pencil className="h-3 w-3" />
              Editar
            </button>
          )}
          {isAdmin && !isSelf && (
            <button
              onClick={remove}
              disabled={busy}
              className="rounded border border-border bg-surface-2 px-2 py-1 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
            >
              Remover
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function EditMemberDialog({
  member,
  onClose,
  onSaved,
}: {
  member: TeamMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState<UserRole>(member.role);
  const [active, setActive] = useState(member.active);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const tasks: Promise<unknown>[] = [];
      if (name.trim() && name.trim() !== member.name) {
        tasks.push(api.updateMemberName(member.id, name.trim()));
      }
      if (role !== member.role) {
        tasks.push(api.updateUserRole(member.id, role));
      }
      if (active !== member.active) {
        tasks.push(api.updateMemberActive(member.id, active));
      }
      await Promise.all(tasks);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar membro</DialogTitle>
          <DialogDescription>
            Atualize o nome, papel e status do membro no workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">E-mail</label>
            <Input value={member.email} disabled />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Papel</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary"
            >
              <option value="AGENT">Agente</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <label className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">Membro ativo</div>
              <div className="text-[11px] text-muted-foreground">
                Desativados não acessam a inbox nem enviam mensagens.
              </div>
            </div>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
          </label>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditSelfDialog({
  currentName,
  onClose,
  onSaved,
}: {
  currentName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (pwd && pwd !== pwd2) {
      setErr("As senhas não coincidem.");
      return;
    }
    if (pwd && pwd.length < 6) {
      setErr("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }

    setSaving(true);
    try {
      if (name.trim() && name.trim() !== currentName) {
        await api.updateOwnProfile({ name: name.trim() });
      }
      if (pwd) {
        await api.updateOwnPassword(pwd);
      }
      setOk("Alterações salvas.");
      setPwd("");
      setPwd2("");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar meu perfil</DialogTitle>
          <DialogDescription>
            Atualize seu nome de exibição e/ou troque sua senha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5 border-t border-border pt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Trocar senha (opcional)
            </div>
            <label className="text-xs font-medium text-muted-foreground">Nova senha</label>
            <Input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Deixe em branco para manter"
              autoComplete="new-password"
            />
            <label className="text-xs font-medium text-muted-foreground">Confirmar nova senha</label>
            <Input
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          {ok && <p className="text-xs text-success">{ok}</p>}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
