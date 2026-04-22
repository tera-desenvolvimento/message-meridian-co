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
 * Renders inline media (images/video/audio) when the message carries a media URL.
 */
export function MessageBlock({ message }: { message: Message }) {
  const isAgent = message.fromMe;
  // Outgoing messages are sent with a "*Sender Name:*\n" signature prefix so the
  // recipient on WhatsApp sees who wrote it. Strip it locally to avoid showing
  // the agent name twice (header + body).
  const displayContent = isAgent
    ? message.content.replace(/^\*[^*\n]+:\*\n?/, "")
    : message.content;

  const mediaType = message.mediaType ?? null;
  const mediaUrl = message.mediaUrl ?? null;
  const mimeType = message.mediaMimeType ?? undefined;

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

      <div className="space-y-2 pl-8">
        {mediaUrl && mediaType === "image" && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-sm overflow-hidden rounded-md border border-border bg-background"
          >
            <img
              src={mediaUrl}
              alt={displayContent || "Imagem recebida"}
              className="h-auto w-full object-cover"
              loading="lazy"
            />
          </a>
        )}

        {mediaUrl && mediaType === "video" && (
          <video
            src={mediaUrl}
            controls
            className="max-w-sm rounded-md border border-border bg-background"
          />
        )}

        {mediaUrl && mediaType === "audio" && (
          <audio src={mediaUrl} controls className="w-full max-w-sm" />
        )}

        {mediaUrl && (mediaType === "document" || mediaType === "sticker") && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground/90 hover:bg-surface"
          >
            📎 {mediaType === "sticker" ? "Sticker" : "Abrir documento"}
            {mimeType && (
              <span className="text-[11px] text-muted-foreground">({mimeType})</span>
            )}
          </a>
        )}

        {displayContent && (
          <div className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
            {displayContent}
          </div>
        )}
      </div>
    </article>
  );
}
