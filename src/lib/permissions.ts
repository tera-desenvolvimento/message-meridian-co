import type { UserRole, Conversation, AuthUser } from "./types";

/**
 * Papéis disponíveis dentro de um workspace.
 *
 * Observação: `SUPERADMIN` ainda existe no enum do banco por compatibilidade,
 * mas o "Super Admin Dohko" agora é um operador de plataforma separado
 * (login em /dohko via código + senha). Dentro de workspace só usamos
 * ADMIN > SUPERVISOR > AGENT.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: "Administrador",
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  AGENT: "Agente",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPERADMIN: "Gerencia equipe, integrações e vê todas as conversas.",
  ADMIN: "Gerencia equipe, integrações e vê todas as conversas.",
  SUPERVISOR: "Vê todas as conversas e métricas, mas não gerencia equipe.",
  AGENT: "Vê apenas conversas atribuídas a ele ou ainda sem responsável.",
};

/** Papéis que podem ser atribuídos a membros do workspace. */
export const ASSIGNABLE_ROLES: UserRole[] = ["ADMIN", "SUPERVISOR", "AGENT"];

export function canManageTeam(role: UserRole | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function canManageIntegrations(role: UserRole | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function canViewAllConversations(role: UserRole | undefined | null): boolean {
  return role === "ADMIN" || role === "SUPERADMIN" || role === "SUPERVISOR";
}

export function canAssignRole(
  myRole: UserRole | undefined | null,
  targetRole: UserRole,
): boolean {
  if (myRole !== "ADMIN" && myRole !== "SUPERADMIN") return false;
  return ASSIGNABLE_ROLES.includes(targetRole);
}

export function assignableRoles(myRole: UserRole | undefined | null): UserRole[] {
  return ASSIGNABLE_ROLES.filter((r) => canAssignRole(myRole, r));
}

/** Filtra conversas conforme o papel do usuário. */
export function filterConversationsByRole(
  conversations: Conversation[],
  user: AuthUser | null,
): Conversation[] {
  if (!user) return [];
  if (canViewAllConversations(user.role)) return conversations;
  return conversations.filter(
    (c) => !c.assignedTo || c.assignedTo.id === user.id,
  );
}
