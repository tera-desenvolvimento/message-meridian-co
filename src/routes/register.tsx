import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthShell, AuthSwitcher, RegisterForm } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Criar conta — Crmly" }] }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem("crm.token")) {
      throw redirect({ to: "/" });
    }
  },
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <AuthShell
      title="Criar conta"
      subtitle="Comece em menos de um minuto."
      footer={<AuthSwitcher to="/login" label="Já tem uma conta?" cta="Entrar" />}
    >
      <RegisterForm />
    </AuthShell>
  );
}
