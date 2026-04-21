import type { ConversationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const map: Record<ConversationStatus, { label: string; cls: string }> = {
  OPEN: { label: "Aberta", cls: "bg-success/15 text-success border-success/30" },
  PENDING: { label: "Pendente", cls: "bg-warning/15 text-warning border-warning/30" },
  CLOSED: { label: "Fechada", cls: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ status, className }: { status: ConversationStatus; className?: string }) {
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        s.cls,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
