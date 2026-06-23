import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { canManageIntegrations } from "@/lib/permissions";
import { api } from "@/lib/http";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configurações — Crmly" }] }),
  component: SettingsPage,
});


interface Integration {
  id?: string;
  api_url: string;
  token: string;
  webhook_secret: string;
  phone_number: string;
  enabled: boolean;
}

const EMPTY: Integration = {
  api_url: "https://gate.whapi.cloud",
  token: "",
  webhook_secret: "",
  phone_number: "",
  enabled: false,
};

function SettingsPage() {
  return (
    <AuthGuard>
      <div className="flex h-dvh flex-row bg-background text-foreground">
        <AppHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
            <AccountSection />
            <IntegrationSection />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function AccountSection() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const prof = await api.getOwnProfile();
        if (!mounted) return;
        setName(prof.name);
        setSignature(prof.signature);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await api.updateOwnProfile({ name: name.trim(), signature });
      setFeedback({ type: "ok", msg: "Conta atualizada." });
      await refresh();
    } catch (err) {
      setFeedback({
        type: "err",
        msg: err instanceof Error ? err.message : "Erro ao salvar.",
      });
    } finally {
      setSaving(false);
    }
  }

  const previewSignature = signature.trim() || `*${name.trim() || "Seu nome"}:*`;

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Minha conta</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Atualize seus dados e personalize a assinatura usada nas mensagens enviadas.
        </p>
      </div>

      {loading ? (
        <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted-foreground">
          Carregando...
        </div>
      ) : (
        <form onSubmit={onSave} className="space-y-6">
          <div className="rounded-md border border-border bg-surface p-5 space-y-4">
            <Field
              label="Nome"
              value={name}
              onChange={setName}
              placeholder="Seu nome"
            />

            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Assinatura nas mensagens
              </label>
              <textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={`*${name || "Seu nome"}:*`}
                rows={3}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Este texto aparece no início de cada mensagem que você envia. Use{" "}
                <code className="rounded bg-surface-2 px-1">*texto*</code> para negrito.
                Deixe em branco para usar o padrão{" "}
                <code className="rounded bg-surface-2 px-1">*Seu nome:*</code>.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Pré-visualização
              </label>
              <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap font-mono">
                {previewSignature}
                {"\n"}
                <span className="text-muted-foreground">Olá! Como posso ajudar?</span>
              </div>
            </div>
          </div>

          {feedback && (
            <div
              className={`text-xs ${
                feedback.type === "ok" ? "text-success" : "text-destructive"
              }`}
            >
              {feedback.msg}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar conta"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function IntegrationSection() {
  // Configuração de API (URL, token, webhook) é responsabilidade do Super Admin
  // Dohko e é provisionada para o tenant. Aqui o usuário do workspace apenas
  // conecta o canal e escaneia o QR code.
  return <ChannelPanel />;
}

function ChannelPanel() {
  const { user } = useAuth();
  const isAdmin = canManageIntegrations(user?.role);
  const [state, setState] = useState<{
    status: string;
    phone: string | null;
    name: string | null;
    qrImage: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");
      const res = await fetch("/api/whapi/channel", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erro ao consultar status");
      setState(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-check on mount so already-connected workspaces show status immediately
  useEffect(() => {
    if (!isAdmin) return;
    void fetchStatus();
  }, [isAdmin, fetchStatus]);

  // Poll while waiting for QR scan
  useEffect(() => {
    if (!state || !isAdmin) return;
    const isConnected = ["AUTH", "ACTIVE", "CONNECTED"].includes(state.status.toUpperCase());
    if (isConnected) return;
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [state, isAdmin, fetchStatus]);





  async function disconnect() {
    if (!confirm("Desconectar o número atual do WhatsApp?")) return;
    setDisconnecting(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");
      const res = await fetch("/api/whapi/channel", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Erro ao desconectar");
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDisconnecting(false);
    }
  }

  if (!isAdmin) return null;

  const connected = state && ["AUTH", "ACTIVE", "CONNECTED"].includes(state.status.toUpperCase());

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Conexão do WhatsApp</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Conecte seu número escaneando o QR code. A configuração da API é gerenciada pela equipe Dohko.
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface p-5 space-y-4">
        {loading && !state ? (
          <div className="text-sm text-muted-foreground">Consultando canal...</div>
        ) : error ? (
          <div className="flex flex-col items-start gap-3">
            {/Token.*[Ww]hapi.*configurad/i.test(error) ? (
              <p className="text-sm text-muted-foreground">
                Sua integração ainda está sendo provisionada pela equipe Dohko. Tente novamente em
                instantes.
              </p>
            ) : (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loading}
              className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {loading ? "Conectando..." : "Conectar WhatsApp"}
            </button>
          </div>
        ) : !state ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Clique no botão abaixo para iniciar a conexão e exibir o QR code.
            </p>
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loading}
              className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {loading ? "Conectando..." : "Conectar WhatsApp"}
            </button>
          </div>

        ) : connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              <span className="text-sm font-medium">Conectado</span>
            </div>
            <div className="space-y-1 text-sm">
              {state.name && (
                <div>
                  <span className="text-muted-foreground">Nome:</span>{" "}
                  <span className="font-medium">{state.name}</span>
                </div>
              )}
              {state.phone && (
                <div>
                  <span className="text-muted-foreground">Número:</span>{" "}
                  <span className="font-mono">{state.phone}</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground">Status: {state.status}</div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={fetchStatus}
                disabled={loading}
                className="inline-flex h-9 items-center rounded-md border border-border bg-surface-2 px-4 text-sm font-medium hover:bg-surface disabled:opacity-60"
              >
                Atualizar
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={disconnecting}
                className="inline-flex h-9 items-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {disconnecting ? "Desconectando..." : "Desconectar número"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-warning" />
              <span className="text-sm font-medium">Aguardando conexão</span>
              <span className="text-xs text-muted-foreground">({state.status})</span>
            </div>
            {state.qrImage ? (
              <div className="flex flex-col items-center gap-3">
                <img
                  src={state.qrImage}
                  alt="QR Code WhatsApp"
                  className="h-64 w-64 rounded-md border border-border bg-white p-2"
                />
                <p className="max-w-xs text-center text-xs text-muted-foreground">
                  Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho e
                  escaneie o código acima.
                </p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Gerando QR code... aguarde alguns segundos.
              </div>
            )}
            <button
              type="button"
              onClick={fetchStatus}
              disabled={loading}
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface-2 px-4 text-sm font-medium hover:bg-surface disabled:opacity-60"
            >
              {loading ? "Atualizando..." : "Atualizar QR"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}


function SettingsPanel() {
  const { user, workspace } = useAuth();
  const isAdmin = canManageIntegrations(user?.role);
  const [integ, setInteg] = useState<Integration>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("workspace_integrations")
      .select("id, api_url, token, webhook_secret, phone_number, enabled")
      .eq("workspace_id", workspace.id)
      .eq("provider", "whapi")
      .maybeSingle();
    if (!error && data) {
      setInteg({
        id: data.id,
        api_url: data.api_url ?? EMPTY.api_url,
        token: data.token ?? "",
        webhook_secret: data.webhook_secret ?? "",
        phone_number: data.phone_number ?? "",
        enabled: data.enabled,
      });
    }
    setLoading(false);
  }, [workspace?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!workspace?.id) return;
    setSaving(true);
    setFeedback(null);
    const payload = {
      workspace_id: workspace.id,
      provider: "whapi",
      api_url: integ.api_url.trim(),
      token: integ.token.trim() || null,
      webhook_secret: integ.webhook_secret.trim() || null,
      phone_number: integ.phone_number.trim() || null,
      enabled: integ.enabled,
    };
    const { error } = await supabase
      .from("workspace_integrations")
      .upsert(payload, { onConflict: "workspace_id,provider" });
    if (error) {
      setFeedback({ type: "err", msg: error.message });
      setSaving(false);
      return;
    }

    // Sync workspace.whatsapp_number so the webhook can identify this workspace
    const digits = integ.phone_number.replace(/\D+/g, "");
    const { error: wsError } = await supabase
      .from("workspaces")
      .update({ whatsapp_number: digits || null })
      .eq("id", workspace.id);
    if (wsError) {
      setFeedback({ type: "err", msg: wsError.message });
    } else {
      setFeedback({ type: "ok", msg: "Configurações salvas." });
      await load();
    }
    setSaving(false);
  }

  const LOVABLE_PROJECT_ID = "8d07022c-e934-4b33-8808-5da870e1f74b";
  const baseWebhookUrl = `https://project--${LOVABLE_PROJECT_ID}.lovable.app/api/public/whapi-webhook`;
  const webhookSecret = integ.webhook_secret.trim();
  const webhookUrl = webhookSecret
    ? `${baseWebhookUrl}?secret=${encodeURIComponent(webhookSecret)}`
    : baseWebhookUrl;

  return (
    <section>
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Integração de mensageria</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Conecte qualquer provedor de API compatível (Whapi, Z-API, Evolution, Twilio etc.)
            informando os parâmetros padrão abaixo.
          </p>
        </div>

        {!isAdmin ? (
          <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted-foreground">
            Apenas administradores podem alterar as configurações.
          </div>
        ) : loading ? (
          <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <form onSubmit={onSave} className="space-y-6">
            <section className="rounded-md border border-border bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Credenciais do provedor</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Esses campos são genéricos e funcionam para qualquer API REST com Bearer token.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={integ.enabled}
                    onChange={(e) => setInteg({ ...integ, enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="font-medium">Ativo</span>
                </label>
              </div>

              <div className="space-y-4">
                <Field
                  label="URL base da API"
                  value={integ.api_url}
                  onChange={(v) => setInteg({ ...integ, api_url: v })}
                  placeholder="https://api.seu-provedor.com"
                />
                <Field
                  label="Token de autenticação (Bearer)"
                  type="password"
                  value={integ.token}
                  onChange={(v) => setInteg({ ...integ, token: v })}
                  placeholder="Cole o token/API key do provedor"
                />
                <Field
                  label="Segredo do webhook"
                  type="password"
                  value={integ.webhook_secret}
                  onChange={(v) => setInteg({ ...integ, webhook_secret: v })}
                  placeholder="Usado para validar requisições recebidas"
                />
                <Field
                  label="Identificador do canal / número (opcional)"
                  value={integ.phone_number}
                  onChange={(v) => setInteg({ ...integ, phone_number: v })}
                  placeholder="+55 11 99999-9999 ou ID do canal"
                />
              </div>
            </section>

            <section className="rounded-md border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold">URL do Webhook</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Configure esta URL no painel do seu provedor para receber eventos. O workspace é
                identificado pelo identificador acima ou pelo segredo do webhook.
              </p>
              <div className="mt-3 break-all rounded border border-border bg-surface-2 px-3 py-2 font-mono text-xs">
                {webhookUrl}
              </div>
            </section>


            {feedback && (
              <div
                className={`text-xs ${
                  feedback.type === "ok" ? "text-success" : "text-destructive"
                }`}
              >
                {feedback.msg}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar configurações"}
              </button>
            </div>
          </form>
        )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
