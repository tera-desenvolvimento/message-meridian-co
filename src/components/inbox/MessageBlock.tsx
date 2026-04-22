import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "./ContactAvatar";

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
  // Outgoing messages are sent with a "*Sender Name:*\n" signature prefix so the
  // recipient on WhatsApp sees who wrote it. Strip it locally to avoid showing
  // the agent name twice (header + body).
  const displayContent = isAgent
    ? message.content.replace(/^\*[^*\n]+:\*\n?/, "")
    : message.content;
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
        <ContactAvatar
          src={message.senderAvatarUrl}
          name={message.senderName || "?"}
          size="sm"
          className={cn(
            "h-6 w-6 text-[10px]",
            isAgent && "border-primary/30",
          )}
        />
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
        {displayContent}
      </div>
    </article>
  );
}
