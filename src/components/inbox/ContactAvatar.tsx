import { Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

interface Props {
  src?: string | null;
  name: string;
  isGroup?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  ringColor?: string;
}

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-[11px]",
  lg: "h-10 w-10 text-[12px]",
};

const ICON_SIZES: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4.5 w-4.5",
};

/**
 * Avatar for WhatsApp contacts. Tries to render the profile picture URL;
 * falls back to initials, then to a User/Users icon. Designed to look
 * good both with and without an image (no broken image flicker).
 */
export function ContactAvatar({
  src,
  name,
  isGroup = false,
  size = "md",
  className,
}: Props) {
  const sizeCls = SIZES[size];
  const iconCls = ICON_SIZES[size];
  const ini = initials(name);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 font-semibold text-muted-foreground",
        sizeCls,
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={(e) => {
            // Hide broken image so the fallback (rendered behind) shows through.
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : ini ? (
        <span className="bg-primary/15 text-primary inset-0 flex h-full w-full items-center justify-center">
          {ini}
        </span>
      ) : isGroup ? (
        <Users className={iconCls} />
      ) : (
        <User className={iconCls} />
      )}
    </div>
  );
}
