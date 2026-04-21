import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AuthShell, ErrorBox, Field, PrimaryButton } from "@/components/auth/AuthForms";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/accept-invite")({
  head: () => ({ meta: [{ title: "Aceitar convite — Crmly" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: AcceptInvitePage,
});

interface InviteInfo {
  email: string | null;
  role: "ADMIN" | "AGENT";
  workspaceName: string;
}

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<InviteInfo | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoadError("Token não informado.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/public/accept-invite?token=${encodeURIComponent(token)}`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(json?.error || "Convite inválido.");
        } else {
          setInfo(json);
          if (json.email) setEmail(json.email);
        }
      } catch {
        if (!cancelled) setLoadError("Falha ao validar o convite.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Falha ao aceitar convite.");
        return;
      }
      // Auto-login and redirect to inbox.
      await login(json.email, password);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha inesperada.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AuthShell title="Validando convite..." subtitle="Aguarde um instante." footer={<span />}>
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </AuthShell>
    );
  }

  if (loadError || !info) {
    return (
      <AuthShell
        title="Convite inválido"
        subtitle="Este link não pode ser utilizado."
        footer={<span />}
      >
        <ErrorBox message={loadError ?? "Convite indisponível."} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Você foi convidado para ${info.workspaceName}`}
      subtitle={`Crie sua conta como ${info.role === "ADMIN" ? "Administrador" : "Agente"}. Se já tiver uma conta com este e-mail, informe a senha existente.`}
      footer={<span />}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorBox message={error} />
        <Field
          label="Seu nome"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
        />
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting || !!info.email}
        />
        <Field
          label="Senha (mín. 6 caracteres)"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "Aceitando..." : "Aceitar convite e entrar"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
