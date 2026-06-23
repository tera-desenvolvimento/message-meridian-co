import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/dohko/")({
  component: DohkoLogin,
});

function DohkoLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/public/dohko/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code, password }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Falha ao entrar");
        return;
      }
      navigate({ to: "/dohko/tenants" });
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm"
      >
        <div className="mb-5 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-bold tracking-tight">Dohko · Operador</div>
            <div className="text-[11px] text-muted-foreground">
              Acesso restrito ao controle de tenants
            </div>
          </div>
        </div>

        <label className="mb-3 block text-xs font-medium">
          <span className="mb-1 block text-muted-foreground">Código</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="username"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </label>

        <label className="mb-4 block text-xs font-medium">
          <span className="mb-1 block text-muted-foreground">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </label>

        {error && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
