export type ConversationStatus = "OPEN" | "PENDING" | "CLOSED";
export type ConversationType = "PRIVATE" | "GROUP";
export type ConversationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface Assignee {
  id: string;
  name: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string;
  externalId: string | null;
  lastMessage: string;
  lastMessageAt: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedTo: Assignee | null;
  avatarUrl: string | null;
  botActive: boolean;
  /**
   * Timestamp da última mensagem recebida do cliente que ainda não foi
   * respondida pela equipe. `null` quando a última mensagem foi enviada
   * por um agente (ou seja, já respondemos).
   */
  awaitingReplySince: string | null;
}

export type MediaType = "image" | "video" | "audio" | "document" | "sticker";

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  fromMe: boolean;
  senderName: string;
  senderAvatarUrl: string | null;
  createdAt: string;
  type?: "text" | "image" | "audio";
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaType?: MediaType | null;
}

// ---------- Auth & Workspace ----------

export type UserRole = "SUPERADMIN" | "ADMIN" | "SUPERVISOR" | "AGENT";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  workspaceId: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  trialEndsAt: string;
  subscriptionActive: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "DISABLED" | "INVITED";
  active: boolean;
  joinedAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface Invitation {
  id: string;
  email: string | null;
  role: UserRole;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  inviteUrl: string;
}
