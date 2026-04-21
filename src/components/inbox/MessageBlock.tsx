import type { Message } from "@/lib/types";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatStamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Single-column message block (CRM ticket-style — not a chat bubble).
 * Internal notes (fromMe) get a subtle accent edge to differentiate without mirroring the layout.
 */
export function MessageBlock({ message }: { message: Message }) {
  const isAgent = message.fromMe;
  return (
    <article
      className={cn(
        "group relative rounded-lg border bg-surface px-4 py-3 transition",
        isAgent
          ? "border-primary/30 bg-primary/[0.04]"
          : "border-border hover:border-border-strong",
      )}
    >
      {/* Left edge accent */}
      <span
        className={cn(
          "absolute left-0 top-3 bottom-3 w-0.5 rounded-r",
          isAgent ? "bg-primary" : "bg-border-strong",
        )}
      />

      <header className="mb-1.5 flex items-center gap-2">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold",
            isAgent
              ? "bg-primary/15 text-primary"
              : "bg-surface-2 text-muted-foreground",
          )}
        >
          {initials(message.senderName) || "?"}
        </div>
        <span className="text-[13px] font-semibold text-foreground">{message.senderName}</span>
        {isAgent && (
          <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
            Agent
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {formatStamp(message.createdAt)}
        </span>
      </header>

      <div className="pl-8 text-[14px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
        {message.content}
      </div>
    </article>
  );
}
