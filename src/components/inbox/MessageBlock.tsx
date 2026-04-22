import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContactAvatar } from "./ContactAvatar";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Chat-style message bubble. Outgoing messages (fromMe / agents) align to the
 * right with the primary color; incoming messages align to the left in a
 * neutral surface tone — similar to WhatsApp.
 */
export function MessageBlock({ message }: { message: Message }) {
  const isAgent = message.fromMe;
  // Outgoing messages are sent with a "*Sender Name:*\n" signature prefix so
  // the recipient on WhatsApp sees who wrote it. Strip it locally to avoid
  // showing the agent name twice (header + body).
  const displayContent = isAgent
    ? message.content.replace(/^\*[^*\n]+:\*\n?/, "")
    : message.content;

  const mediaType = message.mediaType ?? null;
  const mediaUrl = message.mediaUrl ?? null;
  const mimeType = message.mediaMimeType ?? undefined;

  return (
    <div
      className={cn(
        "flex w-full items-end gap-2",
        isAgent ? "justify-end" : "justify-start",
      )}
    >
      {!isAgent && (
        <ContactAvatar
          src={message.senderAvatarUrl}
          name={message.senderName || "?"}
          size="sm"
          className="h-7 w-7 shrink-0 text-[10px]"
        />
      )}

      <div
        className={cn(
          "flex max-w-[75%] flex-col gap-1 rounded-2xl px-3 py-2 shadow-sm sm:max-w-[65%]",
          isAgent
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-surface text-foreground border border-border",
        )}
      >
        {/* Sender name — show for both incoming and outgoing messages so the
            team can quickly tell which agent replied (and which contact wrote
            in group chats). */}
        {message.senderName && (
          <span
            className={cn(
              "text-[11px] font-semibold",
              isAgent ? "text-primary-foreground/90" : "text-primary",
            )}
          >
            {message.senderName}
          </span>
        )}

        {mediaUrl && mediaType === "image" && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg"
          >
            <img
              src={mediaUrl}
              alt={displayContent || "Imagem"}
              className="h-auto max-h-80 w-full object-cover"
              loading="lazy"
            />
          </a>
        )}

        {mediaUrl && mediaType === "video" && (
          <video src={mediaUrl} controls className="max-h-80 w-full rounded-lg" />
        )}

        {mediaUrl && mediaType === "audio" && (
          <audio src={mediaUrl} controls className="w-full min-w-[220px]" />
        )}

        {mediaUrl && (mediaType === "document" || mediaType === "sticker") && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
              isAgent
                ? "bg-primary-foreground/15 hover:bg-primary-foreground/25"
                : "bg-background hover:bg-surface-2 border border-border",
            )}
          >
            📎 {mediaType === "sticker" ? "Sticker" : "Abrir documento"}
            {mimeType && (
              <span
                className={cn(
                  "text-[11px]",
                  isAgent ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                ({mimeType})
              </span>
            )}
          </a>
        )}

        {displayContent && (
          <div className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
            {displayContent}
          </div>
        )}

        <span
          className={cn(
            "self-end font-mono text-[10px] leading-none",
            isAgent ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {formatTime(message.createdAt)}
        </span>
      </div>

      {isAgent && (
        <ContactAvatar
          src={message.senderAvatarUrl}
          name={message.senderName || "?"}
          size="sm"
          className="h-7 w-7 shrink-0 border-primary/30 text-[10px]"
        />
      )}
    </div>
  );
}
