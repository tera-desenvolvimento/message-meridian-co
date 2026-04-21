export type ConversationStatus = "OPEN" | "PENDING" | "CLOSED";
export type ConversationType = "PRIVATE" | "GROUP";

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
