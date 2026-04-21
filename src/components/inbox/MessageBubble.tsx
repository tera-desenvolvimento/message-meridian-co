import type { Message } from "@/lib/types";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MessageBubble({ message, showSender }: { message: Message; showSender: boolean }) {
  const me = message.fromMe;
  return (
    <div className={cn("flex w-full", me ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm md:max-w-[60%]",
          me
            ? "rounded-br-sm bg-bubble-me text-bubble-me-foreground"
            : "rounded-bl-sm bg-bubble-them text-bubble-them-foreground",
        )}
      >
        {showSender && !me && (
          <div className="mb-0.5 text-xs font-semibold text-primary-glow">{message.senderName}</div>
        )}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        <div className={cn("mt-1 text-right text-[10px] opacity-70")}>{formatTime(message.createdAt)}</div>
      </div>
    </div>
  );
}
