export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bot_flows: {
        Row: {
          created_at: string
          definition: Json
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_flows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_states: {
        Row: {
          conversation_id: string
          current_block_id: string | null
          flow_id: string
          id: string
          updated_at: string
          variables: Json
        }
        Insert: {
          conversation_id: string
          current_block_id?: string | null
          flow_id: string
          id?: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          conversation_id?: string
          current_block_id?: string | null
          flow_id?: string
          id?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bot_states_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_states_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "bot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          avatar_updated_at: string | null
          avatar_url: string | null
          bot_active: boolean
          created_at: string
          external_id: string | null
          id: string
          last_message: string
          last_message_at: string
          name: string
          priority: Database["public"]["Enums"]["conversation_priority"]
          status: Database["public"]["Enums"]["conversation_status"]
          type: Database["public"]["Enums"]["conversation_type"]
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          avatar_updated_at?: string | null
          avatar_url?: string | null
          bot_active?: boolean
          created_at?: string
          external_id?: string | null
          id?: string
          last_message?: string
          last_message_at?: string
          name: string
          priority?: Database["public"]["Enums"]["conversation_priority"]
          status?: Database["public"]["Enums"]["conversation_status"]
          type?: Database["public"]["Enums"]["conversation_type"]
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          avatar_updated_at?: string | null
          avatar_url?: string | null
          bot_active?: boolean
          created_at?: string
          external_id?: string | null
          id?: string
          last_message?: string
          last_message_at?: string
          name?: string
          priority?: Database["public"]["Enums"]["conversation_priority"]
          status?: Database["public"]["Enums"]["conversation_status"]
          type?: Database["public"]["Enums"]["conversation_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          token: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          external_id: string | null
          from_me: boolean
          id: string
          media_mime_type: string | null
          media_type: string | null
          media_url: string | null
          sender_avatar_url: string | null
          sender_name: string
          sender_phone: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          external_id?: string | null
          from_me?: boolean
          id?: string
          media_mime_type?: string | null
          media_type?: string | null
          media_url?: string | null
          sender_avatar_url?: string | null
          sender_name?: string
          sender_phone?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          external_id?: string | null
          from_me?: boolean
          id?: string
          media_mime_type?: string | null
          media_type?: string | null
          media_url?: string | null
          sender_avatar_url?: string | null
          sender_name?: string
          sender_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          signature: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string
          signature?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          signature?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      workspace_integrations: {
        Row: {
          api_url: string
          created_at: string
          enabled: boolean
          id: string
          phone_number: string | null
          provider: string
          token: string | null
          updated_at: string
          webhook_secret: string | null
          workspace_id: string
        }
        Insert: {
          api_url?: string
          created_at?: string
          enabled?: boolean
          id?: string
          phone_number?: string | null
          provider?: string
          token?: string | null
          updated_at?: string
          webhook_secret?: string | null
          workspace_id: string
        }
        Update: {
          api_url?: string
          created_at?: string
          enabled?: boolean
          id?: string
          phone_number?: string | null
          provider?: string
          token?: string | null
          updated_at?: string
          webhook_secret?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          default_bot_flow_id: string | null
          id: string
          name: string
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          default_bot_flow_id?: string | null
          id?: string
          name: string
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          default_bot_flow_id?: string | null
          id?: string
          name?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_default_bot_flow_id_fkey"
            columns: ["default_bot_flow_id"]
            isOneToOne: false
            referencedRelation: "bot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_workspace_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      is_active_member: { Args: { _workspace_id: string }; Returns: boolean }
      is_admin_of: { Args: { _workspace_id: string }; Returns: boolean }
      is_member_of: { Args: { _workspace_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      shares_workspace_with: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      conversation_priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
      conversation_status: "OPEN" | "PENDING" | "CLOSED"
      conversation_type: "PRIVATE" | "GROUP"
      user_role: "ADMIN" | "AGENT" | "SUPERADMIN" | "SUPERVISOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      conversation_priority: ["LOW", "NORMAL", "HIGH", "URGENT"],
      conversation_status: ["OPEN", "PENDING", "CLOSED"],
      conversation_type: ["PRIVATE", "GROUP"],
      user_role: ["ADMIN", "AGENT", "SUPERADMIN", "SUPERVISOR"],
    },
  },
} as const
