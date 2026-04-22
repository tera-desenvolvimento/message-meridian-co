import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, ErrorBox, Field, PrimaryButton } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Recuperar senha — Crmly" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar e-mail");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviaremos um link para redefinir sua senha."
      footer={
        <span>
          Lembrou?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Voltar para login
          </Link>
        </span>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-surface px-3 py-3 text-sm text-foreground">
            Se existir uma conta para <strong>{email}</strong>, enviamos um link de
            redefinição. Verifique sua caixa de entrada (e o spam).
          </div>
          <PrimaryButton type="button" onClick={() => setSent(false)}>
            Enviar para outro e-mail
          </PrimaryButton>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <ErrorBox message={error} />
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Recuperar senha"}
          </PrimaryButton>
        </form>
      )}
    </AuthShell>
  );
}
