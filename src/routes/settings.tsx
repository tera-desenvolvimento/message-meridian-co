import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <AppHeader />
        <SettingsPanel />
      </div>
    </AuthGuard>
  );
}

function SettingsPanel() {
  const { user, workspace } = useAuth();
  const isAdmin = user?.role === "ADMIN";
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

  const LOVABLE_PROJECT_ID = "b4d9d4b8-7326-4928-873e-3f14d3b34c62";
  const baseWebhookUrl = `https://project--${LOVABLE_PROJECT_ID}.lovable.app/api/public/whapi-webhook`;
  const webhookSecret = integ.webhook_secret.trim();
  const webhookUrl = webhookSecret
    ? `${baseWebhookUrl}?secret=${encodeURIComponent(webhookSecret)}`
    : baseWebhookUrl;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Integração do WhatsApp via Whapi para este workspace.
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
                  <h2 className="text-sm font-semibold">WhatsApp (Whapi)</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Conecte sua conta Whapi para enviar e receber mensagens.
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
                  label="URL da API"
                  value={integ.api_url}
                  onChange={(v) => setInteg({ ...integ, api_url: v })}
                  placeholder="https://gate.whapi.cloud"
                />
                <Field
                  label="Token"
                  type="password"
                  value={integ.token}
                  onChange={(v) => setInteg({ ...integ, token: v })}
                  placeholder="Bearer token do Whapi"
                />
                <Field
                  label="Secret do webhook"
                  type="password"
                  value={integ.webhook_secret}
                  onChange={(v) => setInteg({ ...integ, webhook_secret: v })}
                  placeholder="Usado para validar requisições recebidas"
                />
                <Field
                  label="Número conectado (obrigatório para receber mensagens)"
                  value={integ.phone_number}
                  onChange={(v) => setInteg({ ...integ, phone_number: v })}
                  placeholder="+55 11 99999-9999"
                />
              </div>
            </section>

            <section className="rounded-md border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold">URL do Webhook</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cole esta URL completa no painel do Whapi. O workspace será identificado
                automaticamente pelo número conectado ou pelo secret configurado acima.
              </p>
              <div className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
                ⚠️ Esta URL funciona <strong className="text-foreground">somente após publicar o projeto</strong>.
                Clique em <strong className="text-foreground">Publish</strong> no canto superior direito do editor
                antes de configurá-la no Whapi.
              </div>
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
      </div>
    </div>
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
