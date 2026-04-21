import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

export function Avatar({
  name,
  isGroup,
  size = 44,
  className,
}: {
  name: string;
  isGroup?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-sm font-semibold text-foreground ring-1 ring-border",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {isGroup ? <Users className="h-5 w-5 opacity-80" /> : initials(name) || "?"}
    </div>
  );
}
