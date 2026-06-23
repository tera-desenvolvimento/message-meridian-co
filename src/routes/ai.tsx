import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { canManageIntegrations } from "@/lib/permissions";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/ai")({
  head: () => ({ meta: [{ title: "Configurações de IA — Dohkochat" }] }),
  component: AiSettingsPage,
});

type Provider = "gemini" | "openai";

interface AiConfig {
  id?: string;
  provider: Provider;
  model: string;
  token: string;
  enabled: boolean;
}

const DEFAULT_MODEL: Record<Provider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-5-mini",
};

const EMPTY: AiConfig = {
  provider: "gemini",
  model: DEFAULT_MODEL.gemini,
  token: "",
  enabled: false,
};

function AiSettingsPage() {
  return (
    <AuthGuard>
      <div className="flex h-dvh flex-row bg-background text-foreground">
        <AppHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-8 px-6 py-8">
            <AiSection />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function AiSection() {
  const { user, workspace } = useAuth();
  const isAdmin = canManageIntegrations(user?.role);
  const [cfg, setCfg] = useState<AiConfig>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("workspace_integrations")
      .select("id, api_url, token, phone_number, enabled")
      .eq("workspace_id", workspace.id)
      .eq("provider", "ai")
      .maybeSingle();
    if (!error && data) {
      const provider = (data.phone_number === "openai" ? "openai" : "gemini") as Provider;
      setCfg({
        id: data.id,
        provider,
        model: data.api_url ?? DEFAULT_MODEL[provider],
        token: data.token ?? "",
        enabled: data.enabled,
      });
    }
    setLoading(false);
  }, [workspace?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  function setProvider(provider: Provider) {
    setCfg((c) => ({
      ...c,
      provider,
      model: c.model && c.model !== DEFAULT_MODEL[c.provider] ? c.model : DEFAULT_MODEL[provider],
    }));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!workspace?.id) return;
    setSaving(true);
    setFeedback(null);
    const { error } = await supabase
      .from("workspace_integrations")
      .upsert(
        {
          workspace_id: workspace.id,
          provider: "ai",
          api_url: cfg.model.trim() || DEFAULT_MODEL[cfg.provider],
          token: cfg.token.trim() || null,
          phone_number: cfg.provider,
          enabled: cfg.enabled,
        },
        { onConflict: "workspace_id,provider" },
      );
    if (error) {
      setFeedback({ type: "err", msg: error.message });
    } else {
      setFeedback({ type: "ok", msg: "Configurações de IA salvas." });
      await load();
    }
    setSaving(false);
  }

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Configurações de IA</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure o provedor (Google Gemini ou OpenAI GPT) e a chave de API usada pelas
          funcionalidades de IA do workspace.
        </p>
      </div>

      {!isAdmin ? (
        <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted-foreground">
          Apenas administradores podem alterar as configurações de IA.
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
                <h2 className="text-sm font-semibold">Provedor de IA</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Escolha qual serviço será chamado para gerar respostas com IA.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={cfg.enabled}
                  onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="font-medium">Ativo</span>
              </label>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {(["gemini", "openai"] as Provider[]).map((p) => {
                const active = cfg.provider === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-medium">
                      {p === "gemini" ? "Google Gemini" : "OpenAI GPT"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {p === "gemini" ? "API key do Google AI Studio" : "API key do OpenAI"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-4">
              <Field
                label="Modelo"
                value={cfg.model}
                onChange={(v) => setCfg({ ...cfg, model: v })}
                placeholder={DEFAULT_MODEL[cfg.provider]}
              />
              <Field
                label={cfg.provider === "gemini" ? "Token do Gemini" : "Token do OpenAI"}
                type="password"
                value={cfg.token}
                onChange={(v) => setCfg({ ...cfg, token: v })}
                placeholder={cfg.provider === "gemini" ? "AIza..." : "sk-..."}
              />
              <p className="text-[11px] text-muted-foreground">
                {cfg.provider === "gemini" ? (
                  <>
                    Gere a chave em{" "}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      aistudio.google.com/app/apikey
                    </a>
                    .
                  </>
                ) : (
                  <>
                    Gere a chave em{" "}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      platform.openai.com/api-keys
                    </a>
                    .
                  </>
                )}
              </p>
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
