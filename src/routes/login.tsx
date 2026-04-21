import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthShell, AuthSwitcher, LoginForm } from "@/components/auth/AuthForms";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Crmly" }] }),
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem("crm.token")) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse sua conta para continuar."
      footer={<AuthSwitcher to="/register" label="Não tem uma conta?" cta="Criar conta" />}
    >
      <LoginForm />
    </AuthShell>
  );
}
