import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/http";
import { AuthShell, ErrorBox, Field, PrimaryButton } from "@/components/auth/AuthForms";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Comece agora — Dohkochat" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  return (
    <AuthGuard requireWorkspace={false}>
      <OnboardingInner />
    </AuthGuard>
  );
}

type Mode = "create" | "join";

function OnboardingInner() {
  const { user, setWorkspace, logout } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("create");
  const [workspaceName, setWorkspaceName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user?.workspaceId) {
    navigate({ to: "/" });
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "create") {
        const ws = await api.createWorkspace(workspaceName.trim());
        setWorkspace(ws);
      } else {
        const ws = await api.joinWorkspaceByCode(code.trim());
        setWorkspace(ws);
      }
      navigate({ to: "/" });
    } catch (err) {
      if (err instanceof Error && err.name === "AuthRequiredError") {
        logout();
        navigate({ to: "/login" });
        return;
      }
      setError(err instanceof Error ? err.message : "Falha ao continuar");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    mode === "create" ? workspaceName.trim().length >= 2 : code.trim().length > 0;

  return (
    <AuthShell
      title={mode === "create" ? "Criar seu workspace" : "Entrar em uma equipe"}
      subtitle={
        mode === "create"
          ? "Você terá 3 dias grátis para testar o Dohkochat."
          : "Cole o código de equipe enviado pelo administrador."
      }
      footer={
        <button onClick={logout} className="text-xs text-muted-foreground hover:underline">
          Sair
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-1 text-xs">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={
            mode === "create"
              ? "rounded bg-background px-2 py-1.5 font-medium text-foreground shadow-sm"
              : "px-2 py-1.5 text-muted-foreground hover:text-foreground"
          }
        >
          Criar workspace
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={
            mode === "join"
              ? "rounded bg-background px-2 py-1.5 font-medium text-foreground shadow-sm"
              : "px-2 py-1.5 text-muted-foreground hover:text-foreground"
          }
        >
          Entrar com código
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorBox message={error} />
        {mode === "create" ? (
          <>
            <Field
              label="Nome da sua empresa / equipe"
              placeholder="Ex.: Minha Empresa"
              required
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              disabled={submitting}
              autoComplete="organization"
            />
            <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] leading-relaxed text-foreground">
              🎉 Você terá <strong>3 dias grátis</strong> de teste. Após esse período,
              entre em contato com o comercial da Dohko para assinar e continuar usando
              a plataforma.
            </p>
          </>
        ) : (
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
        )}
        <PrimaryButton type="submit" disabled={submitting || !canSubmit}>
          {submitting
            ? mode === "create" ? "Criando..." : "Entrando..."
            : mode === "create" ? "Criar workspace" : "Entrar na equipe"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
