import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/http";
import { AuthShell, ErrorBox, Field, PrimaryButton } from "@/components/auth/AuthForms";
import { AuthGuard } from "@/components/auth/AuthGuard";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Criar workspace — Crmly" }] }),
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
  const [name, setName] = useState("");
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
      const ws = await api.createWorkspace(name.trim());
      setWorkspace(ws);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar workspace");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Criar workspace"
      subtitle="Dê um nome à sua empresa para começar."
      footer={
        <button onClick={logout} className="text-xs text-muted-foreground hover:underline">
          Sair
        </button>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorBox message={error} />
        <Field
          label="Nome da empresa"
          placeholder="Ex: Acme Corp"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
        />
        <PrimaryButton type="submit" disabled={submitting || !name.trim()}>
          {submitting ? "Criando..." : "Criar workspace"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
