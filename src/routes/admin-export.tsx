import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin-export")({
  head: () => ({ meta: [{ title: "Exportar dados — Crmly" }] }),
  component: AdminExportPage,
});

function AdminExportPage() {
  return (
    <AuthGuard>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <AppHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl space-y-6 px-6 py-10">
            <ExportSection />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function ExportSection() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "ADMIN")
        .limit(1)
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [user?.id]);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");
      const res = await fetch("/api/admin/export", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Falha (${res.status}): ${msg || res.statusText}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(cd);
      a.download = match?.[1] ?? `lovable-export-${new Date().toISOString()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando permissões…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
          <ShieldAlert className="h-4 w-4" /> Acesso restrito
        </div>
        Esta página é restrita a administradores do workspace.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-6">
      <div>
        <h1 className="text-xl font-semibold">Exportação completa (somente leitura)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gera um arquivo ZIP com um JSON por tabela do schema público, usuários do Auth
          (sem senhas) e o inventário de Storage. Os dados não são alterados.
        </p>
      </div>
      <Button onClick={handleDownload} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando ZIP…
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" /> Baixar exportação
          </>
        )}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        A geração pode levar alguns segundos. O download é entregue apenas após validação
        do seu token e perfil de administrador.
      </p>
    </div>
  );
}
