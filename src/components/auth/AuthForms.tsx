import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full bg-background text-foreground">
      <div className="hidden w-1/2 flex-col justify-between border-r border-border bg-surface p-10 lg:flex">
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <img src="/logo.svg" alt="Dohkozap" className="h-32 w-auto shrink-0" />
          <span className="text-2xl font-bold tracking-tight">Dohkozap</span>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight">
            Atendimento profissional. <br />
            Organizado por workspace.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Centralize conversas, distribua tickets entre agentes e mantenha o controle
            sobre cada interação. Sem ruído, sem complicação.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center justify-center space-y-4 mb-8 lg:hidden">
            <img src="/logo.svg" alt="Dohkozap" className="h-20 w-auto shrink-0" />
            <span className="text-xl font-bold tracking-tight">Dohkozap</span>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          <div className="text-center text-sm text-muted-foreground">{footer}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        {...props}
        className="block h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {message}
    </div>
  );
}

export function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
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
      <Field
        label="Senha"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={submitting}
      />
      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? "Entrando..." : "Entrar"}
      </PrimaryButton>
      <div className="text-center">
        <Link
          to="/forgot-password"
          className="text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
        >
          Esqueci minha senha
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate({ to: "/onboarding" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cadastrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <ErrorBox message={error} />
      <Field
        label="Nome"
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
        disabled={submitting}
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
        {submitting ? "Criando..." : "Criar conta"}
      </PrimaryButton>
    </form>
  );
}

export function AuthSwitcher({ to, label, cta }: { to: "/login" | "/register"; label: string; cta: string }) {
  return (
    <span>
      {label}{" "}
      <Link to={to} className="font-medium text-primary hover:underline">
        {cta}
      </Link>
    </span>
  );
}
