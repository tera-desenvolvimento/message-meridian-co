import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mostra há quanto tempo estamos sem responder o cliente.
 *
 * Cores progressivas para chamar atenção da equipe:
 * - < 3 min: cinza (neutro)
 * - 3 a 6 min: amarelo (alerta)
 * - >= 6 min: vermelho (urgente)
 *
 * Re-renderiza a cada 15s para manter o contador atualizado sem
 * sobrecarregar o navegador.
 */
export function WaitingTimer({
  since,
  className,
}: {
  since: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const startedAt = new Date(since).getTime();
  if (Number.isNaN(startedAt)) return null;

  const elapsedMs = Math.max(0, now - startedAt);
  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1000);

  const tone =
    minutes >= 6
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : minutes >= 3
        ? "border-warning/40 bg-warning/10 text-warning"
        : "border-border-strong bg-surface-2 text-muted-foreground";

  const label =
    minutes >= 60
      ? `${Math.floor(minutes / 60)}h${(minutes % 60).toString().padStart(2, "0")}`
      : minutes >= 1
        ? `${minutes}m`
        : `${seconds}s`;

  return (
    <span
      title={`Sem resposta há ${label}`}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider tabular-nums",
        tone,
        className,
      )}
    >
      <Clock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
