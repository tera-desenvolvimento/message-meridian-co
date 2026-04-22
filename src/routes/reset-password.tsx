import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, ErrorBox, Field, PrimaryButton } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Definir nova senha — Crmly" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    // Subscribe FIRST to catch the PASSWORD_RECOVERY event from the magic link.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasRecoverySession(true);
      }
    });

    // Then check existing session (link may have already been processed).
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasRecoverySession(!!data.session);
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      // Sign out so the user has to log in with the new password.
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/login" }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir senha");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Definir nova senha"
      subtitle="Escolha uma nova senha para sua conta."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Voltar para login
        </Link>
      }
    >
      {hasRecoverySession === false ? (
        <div className="space-y-4">
          <ErrorBox message="Link inválido ou expirado. Solicite uma nova recuperação de senha." />
          <Link
            to="/forgot-password"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
          >
            Solicitar novo link
          </Link>
        </div>
      ) : done ? (
        <div className="rounded-md border border-border bg-surface px-3 py-3 text-sm text-foreground">
          Senha redefinida com sucesso. Redirecionando para login...
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <ErrorBox message={error} />
          <Field
            label="Nova senha (mín. 6 caracteres)"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting || hasRecoverySession === null}
          />
          <Field
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={submitting || hasRecoverySession === null}
          />
          <PrimaryButton
            type="submit"
            disabled={submitting || hasRecoverySession === null}
          >
            {submitting ? "Salvando..." : "Salvar nova senha"}
          </PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}
