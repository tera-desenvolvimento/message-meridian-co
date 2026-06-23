import { useAuth } from "@/lib/auth-context";
import { AlertCircle, MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "5511994435802";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Olá! Tenho interesse em assinar o Dohkochat para minha equipe.",
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

function daysLeft(trialEndsAt: string): number {
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Faixa fina no topo, exibida durante o teste de 3 dias. */
export function TrialBanner() {
  const { workspace } = useAuth();
  if (!workspace) return null;
  if (workspace.subscriptionActive) return null;

  const expired = new Date(workspace.trialEndsAt).getTime() <= Date.now();
  if (expired) return null; // bloqueio cheio é tratado em TrialGate
  const days = daysLeft(workspace.trialEndsAt);

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 border-b border-border bg-primary/10 px-4 py-1.5 text-xs text-foreground backdrop-blur">
      <span className="inline-flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-primary" />
        Você está no período de teste —{" "}
        <strong>{days === 1 ? "1 dia restante" : `${days} dias restantes`}</strong>.
        Após esse prazo, assine para continuar usando o Dohkochat.
      </span>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition hover:bg-primary-hover"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        Falar com o comercial
      </a>
    </div>
  );
}

/** Bloqueia toda a UI quando o teste expirou e a assinatura não está ativa. */
export function TrialGate({ children }: { children: React.ReactNode }) {
  const { workspace } = useAuth();

  if (!workspace) return <>{children}</>;
  if (workspace.subscriptionActive) return <>{children}</>;

  const expired = new Date(workspace.trialEndsAt).getTime() <= Date.now();
  if (!expired) return <>{children}</>;

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <h1 className="text-lg font-semibold tracking-tight">
            Período de teste encerrado
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          O período de teste de 3 dias do workspace{" "}
          <span className="font-medium text-foreground">{workspace.name}</span> chegou
          ao fim. Para continuar usando o Dohkochat, entre em contato com o comercial
          da Dohko e ative sua assinatura.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          <MessageCircle className="h-4 w-4" />
          Falar com o comercial no WhatsApp
        </a>
        <p className="text-center text-xs text-muted-foreground">
          +55 11 99443-5802
        </p>
      </div>
    </div>
  );
}
