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
  lastMessage: string;
  lastMessageAt: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  assignedTo: Assignee | null;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  fromMe: boolean;
  senderName: string;
  createdAt: string;
  type?: "text" | "image" | "audio";
}

// ---------- Auth & Workspace ----------

export type UserRole = "ADMIN" | "AGENT";

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
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "INVITED";
  joinedAt: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
