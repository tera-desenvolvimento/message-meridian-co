import type { Message } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MessageBubble({ message, showSender }: { message: Message; showSender: boolean }) {
  const me = message.fromMe;
  return (
    <div className={cn("flex w-full", me ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%]",
          me
            ? "rounded-br-md bg-bubble-me text-bubble-me-foreground"
            : "rounded-bl-md bg-bubble-them text-bubble-them-foreground",
        )}
      >
        {showSender && !me && (
          <div className="mb-0.5 text-[11px] font-semibold text-primary-glow/90">{message.senderName}</div>
        )}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        <div className="mt-1 text-right text-[10px] opacity-70">{formatTime(message.createdAt)}</div>
      </div>
    </div>
  );
}
