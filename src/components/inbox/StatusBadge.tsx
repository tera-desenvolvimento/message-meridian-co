import type { ConversationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const map: Record<ConversationStatus, { label: string; cls: string; dot: string }> = {
  OPEN: {
    label: "Open",
    cls: "bg-success/10 text-success border-success/30",
    dot: "bg-success",
  },
  PENDING: {
    label: "Pending",
    cls: "bg-warning/10 text-warning border-warning/30",
    dot: "bg-warning",
  },
  CLOSED: {
    label: "Closed",
    cls: "bg-muted text-muted-foreground border-border-strong",
    dot: "bg-muted-foreground",
  },
};

export function StatusBadge({
  status,
  className,
  size = "sm",
}: {
  status: ConversationStatus;
  className?: string;
  size?: "sm" | "md";
}) {
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border font-medium uppercase tracking-wider",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        s.cls,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function TypeTag({ type, className }: { type: "PRIVATE" | "GROUP"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {type === "GROUP" ? "Group" : "Direct"}
    </span>
  );
}

export function PriorityTag({
  level,
  className,
}: {
  level: "low" | "normal" | "high";
  className?: string;
}) {
  const map = {
    low: { label: "Low", cls: "text-muted-foreground" },
    normal: { label: "Normal", cls: "text-info" },
    high: { label: "High", cls: "text-destructive" },
  } as const;
  const s = map[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider",
        s.cls,
        className,
      )}
    >
      <span className={cn("h-1 w-1 rounded-full bg-current")} />
      {s.label}
    </span>
  );
}
