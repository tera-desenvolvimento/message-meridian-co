import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  head: () => ({ meta: [{ title: "Cancelar inscrição — Crmly" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<
    "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/email/unsubscribe?token=${encodeURIComponent(token)}`,
        );
        const json = await res.json();
        if (!res.ok) {
          setState("invalid");
          setErrorMsg(json?.error ?? "Token inválido.");
          return;
        }
        if (json.valid) setState("valid");
        else if (json.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  async function confirm() {
    setState("submitting");
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) {
        setState("error");
        setErrorMsg(json?.error ?? "Falha ao cancelar inscrição.");
        return;
      }
      if (json.success || json.reason === "already_unsubscribed") {
        setState("done");
      } else {
        setState("error");
        setErrorMsg("Não foi possível processar o cancelamento.");
      }
    } catch {
      setState("error");
      setErrorMsg("Falha de rede.");
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">Cancelar inscrição</h1>

        {state === "loading" && (
          <p className="text-sm text-muted-foreground">Validando link...</p>
        )}

        {state === "invalid" && (
          <div>
            <p className="text-sm text-destructive">
              {errorMsg ?? "Este link é inválido ou expirou."}
            </p>
          </div>
        )}

        {state === "already" && (
          <p className="text-sm text-muted-foreground">
            Este e-mail já foi removido da nossa lista de envios.
          </p>
        )}

        {state === "valid" && (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              Confirme abaixo para parar de receber e-mails do nosso sistema.
            </p>
            <button
              onClick={confirm}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
            >
              Confirmar cancelamento
            </button>
          </>
        )}

        {state === "submitting" && (
          <p className="text-sm text-muted-foreground">Processando...</p>
        )}

        {state === "done" && (
          <p className="text-sm text-success">
            Pronto! Você não receberá mais e-mails deste sistema.
          </p>
        )}

        {state === "error" && (
          <p className="text-sm text-destructive">
            {errorMsg ?? "Algo deu errado."}
          </p>
        )}
      </div>
    </div>
  );
}
