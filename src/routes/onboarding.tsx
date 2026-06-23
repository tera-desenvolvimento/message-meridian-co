import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/http";
import { AuthShell, ErrorBox, Field, PrimaryButton } from "@/components/auth/AuthForms";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Entrar na equipe — Dohkochat" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <AuthGuard requireWorkspace={false}>
      <OnboardingInner />
    </AuthGuard>
  );
}

function OnboardingInner() {
  const { user, setWorkspace, logout } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If user already has workspace, send to inbox
  if (user?.workspaceId) {
    navigate({ to: "/" });
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const ws = await api.joinWorkspaceByCode(code.trim());
      setWorkspace(ws);
      navigate({ to: "/" });
    } catch (err) {
      if (err instanceof Error && err.name === "AuthRequiredError") {
        logout();
        navigate({ to: "/login" });
        return;
      }
      setError(err instanceof Error ? err.message : "Falha ao entrar na equipe");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Entrar na equipe"
      subtitle="Cole o código de equipe que o administrador enviou para você."
      footer={
        <button onClick={logout} className="text-xs text-muted-foreground hover:underline">
          Sair
        </button>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorBox message={error} />
        <Field
          label="Código da equipe"
          placeholder="cole aqui o código enviado pelo admin"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={submitting}
          autoComplete="off"
          spellCheck={false}
        />
        <PrimaryButton type="submit" disabled={submitting || !code.trim()}>
          {submitting ? "Entrando..." : "Entrar na equipe"}
        </PrimaryButton>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Sua conta foi criada, mas você ainda não faz parte de nenhuma equipe.
          Peça ao administrador da empresa o <span className="font-medium">código da equipe</span>{" "}
          para conseguir acessar a plataforma.
        </p>
      </form>
    </AuthShell>
  );
}
