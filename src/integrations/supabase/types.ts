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
      adv_cautions_custom: {
        Row: {
          created_at: string
          id: string
          nom: string
          project_id: string
          statut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom?: string
          project_id: string
          statut?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
          project_id?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adv_cautions_custom_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      adv_historique: {
        Row: {
          date: string
          description: string
          id: string
          project_id: string
          user_email: string
        }
        Insert: {
          date?: string
          description: string
          id?: string
          project_id: string
          user_email?: string
        }
        Update: {
          date?: string
          description?: string
          id?: string
          project_id?: string
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "adv_historique_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      adv_relances: {
        Row: {
          created_at: string
          demarche: string
          echeance: string
          id: string
          project_id: string
          source_id: string | null
          statut: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          demarche: string
          echeance: string
          id?: string
          project_id: string
          source_id?: string | null
          statut?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          demarche?: string
          echeance?: string
          id?: string
          project_id?: string
          source_id?: string | null
          statut?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adv_relances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      adv_status: {
        Row: {
          caution_rg: string
          commentaire: string
          compte_client: string
          contrat_client: string
          contrat_st: string
          created_at: string
          dast: string
          garantie_sfac: string
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          caution_rg?: string
          commentaire?: string
          compte_client?: string
          contrat_client?: string
          contrat_st?: string
          created_at?: string
          dast?: string
          garantie_sfac?: string
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          caution_rg?: string
          commentaire?: string
          compte_client?: string
          contrat_client?: string
          contrat_st?: string
          created_at?: string
          dast?: string
          garantie_sfac?: string
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adv_status_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      beam_elements: {
        Row: {
          created_at: string | null
          factory: string | null
          id: string
          length: number | null
          product_type: string | null
          project_id: string
          repere: string
          section: string | null
          weight: number | null
          zone: string | null
        }
        Insert: {
          created_at?: string | null
          factory?: string | null
          id?: string
          length?: number | null
          product_type?: string | null
          project_id: string
          repere?: string
          section?: string | null
          weight?: number | null
          zone?: string | null
        }
        Update: {
          created_at?: string | null
          factory?: string | null
          id?: string
          length?: number | null
          product_type?: string | null
          project_id?: string
          repere?: string
          section?: string | null
          weight?: number | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beam_elements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_slots: {
        Row: {
          created_at: string
          date_end: string
          date_start: string
          forecasted_trucks: Json
          id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          date_end: string
          date_start: string
          forecasted_trucks?: Json
          id?: string
          project_id: string
        }
        Update: {
          created_at?: string
          date_end?: string
          date_start?: string
          forecasted_trucks?: Json
          id?: string
          project_id?: string
        }
        Relationships: []
      }
      forecast_weeks: {
        Row: {
          created_at: string
          id: string
          project_id: string
          team_index: number
          week_number: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          team_index?: number
          week_number: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          team_index?: number
          week_number?: number
          year?: number
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string | null
          detected_reperes: Json | null
          id: string
          name: string
          pdf_data_url: string | null
          product_types: Json | null
          project_id: string
          zones: Json | null
        }
        Insert: {
          created_at?: string | null
          detected_reperes?: Json | null
          id?: string
          name?: string
          pdf_data_url?: string | null
          product_types?: Json | null
          project_id: string
          zones?: Json | null
        }
        Update: {
          created_at?: string | null
          detected_reperes?: Json | null
          id?: string
          name?: string
          pdf_data_url?: string | null
          product_types?: Json | null
          project_id?: string
          zones?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_access_links: {
        Row: {
          created_at: string | null
          id: string
          label: string | null
          project_id: string
          role: Database["public"]["Enums"]["access_role"]
          token: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["access_role"]
          token?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["access_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_access_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean
          client_name: string | null
          conductor: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          database_comment: string | null
          database_complete: boolean
          forecast_period_end: string | null
          forecast_period_start: string | null
          forecast_team_count: number
          forecasted_transports: Json
          id: string
          otp_number: string | null
          show_saturdays: boolean | null
          site_address: string | null
          site_name: string | null
          subcontractor: string | null
          supply_only: boolean
          updated_at: string | null
        }
        Insert: {
          archived?: boolean
          client_name?: string | null
          conductor?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          database_comment?: string | null
          database_complete?: boolean
          forecast_period_end?: string | null
          forecast_period_start?: string | null
          forecast_team_count?: number
          forecasted_transports?: Json
          id?: string
          otp_number?: string | null
          show_saturdays?: boolean | null
          site_address?: string | null
          site_name?: string | null
          subcontractor?: string | null
          supply_only?: boolean
          updated_at?: string | null
        }
        Update: {
          archived?: boolean
          client_name?: string | null
          conductor?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          database_comment?: string | null
          database_complete?: boolean
          forecast_period_end?: string | null
          forecast_period_start?: string | null
          forecast_team_count?: number
          forecasted_transports?: Json
          id?: string
          otp_number?: string | null
          show_saturdays?: boolean | null
          site_address?: string | null
          site_name?: string | null
          subcontractor?: string | null
          supply_only?: boolean
          updated_at?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string
          project_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      trucks: {
        Row: {
          comment: string | null
          created_at: string | null
          date: string
          element_ids: Json | null
          forced_category: string | null
          forced_category_reason: string | null
          handling_means: Json | null
          id: string
          number: string
          project_id: string
          team_id: string | null
          time: string
          transporter: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          date?: string
          element_ids?: Json | null
          forced_category?: string | null
          forced_category_reason?: string | null
          handling_means?: Json | null
          id?: string
          number?: string
          project_id: string
          team_id?: string | null
          time?: string
          transporter?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          date?: string
          element_ids?: Json | null
          forced_category?: string | null
          forced_category_reason?: string | null
          handling_means?: Json | null
          id?: string
          number?: string
          project_id?: string
          team_id?: string | null
          time?: string
          transporter?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trucks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trucks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_project: { Args: never; Returns: Json }
      delete_project: { Args: { p_token: string }; Returns: boolean }
      delete_project_by_id: { Args: { p_project_id: string }; Returns: boolean }
      validate_token: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      access_role: "admin" | "editor" | "viewer"
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
      access_role: ["admin", "editor", "viewer"],
    },
  },
} as const
