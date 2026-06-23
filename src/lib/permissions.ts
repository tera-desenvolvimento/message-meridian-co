import type { UserRole, Conversation, AuthUser } from "./types";

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  AGENT: "Agente",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPERADMIN: "Acesso total: todas as conversas, configurações e equipe.",
  ADMIN: "Gerencia equipe, integrações e vê todas as conversas.",
  SUPERVISOR: "Vê todas as conversas e métricas, mas não gerencia equipe.",
  AGENT: "Vê apenas conversas atribuídas a ele ou ainda sem responsável.",
};

export const ALL_ROLES: UserRole[] = [
  "SUPERADMIN",
  "ADMIN",
  "SUPERVISOR",
  "AGENT",
];

export function canManageTeam(role: UserRole | undefined | null): boolean {
  return role === "SUPERADMIN" || role === "ADMIN";
}

export function canManageIntegrations(role: UserRole | undefined | null): boolean {
  return role === "SUPERADMIN" || role === "ADMIN";
}

export function canViewAllConversations(role: UserRole | undefined | null): boolean {
  return role === "SUPERADMIN" || role === "ADMIN" || role === "SUPERVISOR";
}

export function canAssignRole(
  myRole: UserRole | undefined | null,
  targetRole: UserRole,
): boolean {
  if (myRole === "SUPERADMIN") return true;
  if (myRole === "ADMIN") return targetRole !== "SUPERADMIN";
  return false;
}

export function assignableRoles(myRole: UserRole | undefined | null): UserRole[] {
  return ALL_ROLES.filter((r) => canAssignRole(myRole, r));
}

/** Filtra conversas conforme o papel do usuário. */
export function filterConversationsByRole(
  conversations: Conversation[],
  user: AuthUser | null,
): Conversation[] {
  if (!user) return [];
  if (canViewAllConversations(user.role)) return conversations;
  // Agente: apenas atribuídas a ele OU sem responsável (pool aberto).
  return conversations.filter(
    (c) => !c.assignedTo || c.assignedTo.id === user.id,
  );
}
