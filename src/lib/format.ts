export function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Formata um chat_id do WhatsApp (ex.: "5511999998888@s.whatsapp.net" ou
 * um id de grupo "...@g.us") em algo legível.
 */
export function formatWhatsappId(externalId: string | null | undefined): string {
  if (!externalId) return "";
  if (externalId.includes("@g.us")) return "Grupo";
  const digits = externalId.split("@")[0]?.replace(/\D/g, "") ?? "";
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const half = rest.length - 4;
    return `+55 ${ddd} ${rest.slice(0, half)}-${rest.slice(half)}`;
  }
  return `+${digits}`;
}
