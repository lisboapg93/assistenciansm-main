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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
          chamadas: string | null
          consumption: Json
          created_at: string
          date: string
          dirigente: string
          explanador: string | null
          has_audio: boolean
          has_photo: boolean
          historias: string | null
          id: string
          leitor: string | null
          mestre_assistente: string | null
          observation: string | null
          participants: Json
          total_participants: number
          type: string
          updated_at: string
        }
        Insert: {
          chamadas?: string | null
          consumption?: Json
          created_at?: string
          date: string
          dirigente: string
          explanador?: string | null
          has_audio?: boolean
          has_photo?: boolean
          historias?: string | null
          id?: string
          leitor?: string | null
          mestre_assistente?: string | null
          observation?: string | null
          participants?: Json
          total_participants?: number
          type: string
          updated_at?: string
        }
        Update: {
          chamadas?: string | null
          consumption?: Json
          created_at?: string
          date?: string
          dirigente?: string
          explanador?: string | null
          has_audio?: boolean
          has_photo?: boolean
          historias?: string | null
          id?: string
          leitor?: string | null
          mestre_assistente?: string | null
          observation?: string | null
          participants?: Json
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
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
      app_role: ["viewer", "editor", "assistant"],
    },
  },
} as const
