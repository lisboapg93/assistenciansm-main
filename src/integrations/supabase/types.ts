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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          origin: string | null
          related_session_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          origin?: string | null
          related_session_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          origin?: string | null
          related_session_id?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          entity: string | null
          entity_id: string | null
          error_location: string
          error_message: string
          id: string
          metadata: Json
          occurred_at: string
          operation: string | null
          user_id: string | null
        }
        Insert: {
          entity?: string | null
          entity_id?: string | null
          error_location: string
          error_message: string
          id?: string
          metadata?: Json
          occurred_at?: string
          operation?: string | null
          user_id?: string | null
        }
        Update: {
          entity?: string | null
          entity_id?: string | null
          error_location?: string
          error_message?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          operation?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          grau: string | null
          id: string
          is_socio_nucleo: boolean
          name: string
        }
        Insert: {
          created_at?: string
          grau?: string | null
          id?: string
          is_socio_nucleo?: boolean
          name: string
        }
        Update: {
          created_at?: string
          grau?: string | null
          id?: string
          is_socio_nucleo?: boolean
          name?: string
        }
        Relationships: []
      }
      operation_failure_logs: {
        Row: {
          entity: string
          entity_id: string | null
          error_code: string | null
          error_location: string
          error_message: string
          id: string
          input_payload: Json
          metadata: Json
          occurred_at: string
          operation: string
          user_id: string | null
        }
        Insert: {
          entity: string
          entity_id?: string | null
          error_code?: string | null
          error_location: string
          error_message: string
          id?: string
          input_payload?: Json
          metadata?: Json
          occurred_at?: string
          operation: string
          user_id?: string | null
        }
        Update: {
          entity?: string
          entity_id?: string | null
          error_code?: string | null
          error_location?: string
          error_message?: string
          id?: string
          input_payload?: Json
          metadata?: Json
          occurred_at?: string
          operation?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session: {
        Row: {
          consumption: Json
          created_at: string
          date: string
          dirigente: string
          explanador: string | null
          has_audio: boolean
          has_photo: boolean
          id: string
          leitor: string | null
          mestre_assistente: string | null
          observation: string | null
          participants: Json
          registered_by_name: string | null
          total_participants: number
          type: string
          updated_at: string
        }
        Insert: {
          consumption?: Json
          created_at?: string
          date: string
          dirigente: string
          explanador?: string | null
          has_audio?: boolean
          has_photo?: boolean
          id?: string
          leitor?: string | null
          mestre_assistente?: string | null
          observation?: string | null
          participants?: Json
          registered_by_name?: string | null
          total_participants?: number
          type: string
          updated_at?: string
        }
        Update: {
          consumption?: Json
          created_at?: string
          date?: string
          dirigente?: string
          explanador?: string | null
          has_audio?: boolean
          has_photo?: boolean
          id?: string
          leitor?: string | null
          mestre_assistente?: string | null
          observation?: string | null
          participants?: Json
          registered_by_name?: string | null
          total_participants?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movement: {
        Row: {
          created_at: string
          date: string
          details: string | null
          id: string
          quantity: number
          session_id: string | null
          type: string
          vegetal_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          details?: string | null
          id?: string
          quantity: number
          session_id?: string | null
          type: string
          vegetal_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          details?: string | null
          id?: string
          quantity?: number
          session_id?: string | null
          type?: string
          vegetal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movement_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movement_vegetal_id_fkey"
            columns: ["vegetal_id"]
            isOneToOne: false
            referencedRelation: "vegetal"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vegetal: {
        Row: {
          auxiliary: string | null
          chacrona_species: string | null
          created_at: string
          envase_date: string
          id: string
          initial_quantity: number
          is_archived: boolean
          mariri_species: string | null
          master: string
          mensageiro: string | null
          name: string
          quantity: number
          registered_by_name: string | null
          responsavel_baticao: string | null
          responsavel_chacrona: string | null
          updated_at: string
        }
        Insert: {
          auxiliary?: string | null
          chacrona_species?: string | null
          created_at?: string
          envase_date: string
          id?: string
          initial_quantity?: number
          is_archived?: boolean
          mariri_species?: string | null
          master: string
          mensageiro?: string | null
          name: string
          quantity?: number
          registered_by_name?: string | null
          responsavel_baticao?: string | null
          responsavel_chacrona?: string | null
          updated_at?: string
        }
        Update: {
          auxiliary?: string | null
          chacrona_species?: string | null
          created_at?: string
          envase_date?: string
          id?: string
          initial_quantity?: number
          is_archived?: boolean
          mariri_species?: string | null
          master?: string
          mensageiro?: string | null
          name?: string
          quantity?: number
          registered_by_name?: string | null
          responsavel_baticao?: string | null
          responsavel_chacrona?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_vegetal_stock: {
        Args: {
          p_details: string
          p_expected_quantity: number
          p_operation: string
          p_quantity: number
          p_vegetal_id: string
        }
        Returns: {
          auxiliary: string | null
          chacrona_species: string | null
          created_at: string
          envase_date: string
          id: string
          initial_quantity: number
          is_archived: boolean
          mariri_species: string | null
          master: string
          mensageiro: string | null
          name: string
          quantity: number
          registered_by_name: string | null
          responsavel_baticao: string | null
          responsavel_chacrona: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vegetal"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_vegetal_with_movement: {
        Args: { p_vegetal: Json }
        Returns: {
          auxiliary: string | null
          chacrona_species: string | null
          created_at: string
          envase_date: string
          id: string
          initial_quantity: number
          is_archived: boolean
          mariri_species: string | null
          master: string
          mensageiro: string | null
          name: string
          quantity: number
          registered_by_name: string | null
          responsavel_baticao: string | null
          responsavel_chacrona: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vegetal"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_person_members: { Args: { p_names: string[] }; Returns: undefined }
      get_stock_forecast: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
      list_audit_logs: {
        Args: {
          p_action?: string
          p_actor_query?: string
          p_entity_type?: string
          p_limit?: number
          p_occurred_from?: string
          p_occurred_until?: string
          p_offset?: number
        }
        Returns: {
          action: string
          actor_id: string
          actor_name: string
          entity_id: string
          entity_type: string
          id: string
          new_data: Json
          occurred_at: string
          old_data: Json
          origin: string
          related_session_id: string
          total_count: number
        }[]
      }
      list_operation_failure_logs: {
        Args: { p_limit?: number }
        Returns: {
          entity: string
          entity_id: string | null
          error_code: string | null
          error_location: string
          error_message: string
          id: string
          input_payload: Json
          metadata: Json
          occurred_at: string
          operation: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "operation_failure_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      log_application_error: {
        Args: {
          p_entity?: string
          p_entity_id?: string
          p_error_location: string
          p_error_message: string
          p_metadata?: Json
          p_operation?: string
        }
        Returns: string
      }
      log_operation_failure: {
        Args: {
          p_entity: string
          p_entity_id?: string
          p_error_code?: string
          p_error_location: string
          p_error_message: string
          p_input_payload?: Json
          p_metadata?: Json
          p_operation: string
        }
        Returns: string
      }
      member_display_name: {
        Args: { p_grau: string; p_name: string }
        Returns: string
      }
      member_identity_key: {
        Args: { p_grau: string; p_name: string }
        Returns: string
      }
      normalize_person_name: { Args: { p_name: string }; Returns: string }
      person_name_key: { Args: { p_name: string }; Returns: string }
      register_session_with_consumption: {
        Args: { p_member_names?: Json; p_session: Json; p_sources: Json }
        Returns: string
      }
      update_session_metadata: {
        Args: { p_session_id: string; p_updates: Json }
        Returns: {
          consumption: Json
          created_at: string
          date: string
          dirigente: string
          explanador: string | null
          has_audio: boolean
          has_photo: boolean
          id: string
          leitor: string | null
          mestre_assistente: string | null
          observation: string | null
          participants: Json
          registered_by_name: string | null
          total_participants: number
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "session"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "viewer" | "editor" | "assistant"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["viewer", "editor", "assistant"],
    },
  },
} as const
