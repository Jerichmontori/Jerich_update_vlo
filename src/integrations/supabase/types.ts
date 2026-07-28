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
      juri: {
        Row: {
          approved: boolean
          bacaan_mazmur: string | null
          created_at: string
          email: string | null
          id: string
          jabatan: string | null
          jumlah_ayat: number | null
          nama: string
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Insert: {
          approved?: boolean
          bacaan_mazmur?: string | null
          created_at?: string
          email?: string | null
          id?: string
          jabatan?: string | null
          jumlah_ayat?: number | null
          nama: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Update: {
          approved?: boolean
          bacaan_mazmur?: string | null
          created_at?: string
          email?: string | null
          id?: string
          jabatan?: string | null
          jumlah_ayat?: number | null
          nama?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      kategori: {
        Row: {
          batas_atas: number
          batas_bawah: number
          bobot: number
          created_at: string
          id: string
          kategori: string | null
          kriteria_penilaian: string | null
          kriteria_peserta: string | null
          nilai_standart: number
          nilai_tengah: number
          updated_at: string
        }
        Insert: {
          batas_atas?: number
          batas_bawah?: number
          bobot?: number
          created_at?: string
          id?: string
          kategori?: string | null
          kriteria_penilaian?: string | null
          kriteria_peserta?: string | null
          nilai_standart?: number
          nilai_tengah?: number
          updated_at?: string
        }
        Update: {
          batas_atas?: number
          batas_bawah?: number
          bobot?: number
          created_at?: string
          id?: string
          kategori?: string | null
          kriteria_penilaian?: string | null
          kriteria_peserta?: string | null
          nilai_standart?: number
          nilai_tengah?: number
          updated_at?: string
        }
        Relationships: []
      }
      kriteria: {
        Row: {
          batas_atas: number
          batas_bawah: number
          bobot: number
          created_at: string
          id: string
          nama: string
        }
        Insert: {
          batas_atas?: number
          batas_bawah?: number
          bobot?: number
          created_at?: string
          id?: string
          nama: string
        }
        Update: {
          batas_atas?: number
          batas_bawah?: number
          bobot?: number
          created_at?: string
          id?: string
          nama?: string
        }
        Relationships: []
      }
      mazmur: {
        Row: {
          bacaan: string
          created_at: string
          id: string
          jumlah_ayat: number
          kategori: string | null
        }
        Insert: {
          bacaan: string
          created_at?: string
          id?: string
          jumlah_ayat?: number
          kategori?: string | null
        }
        Update: {
          bacaan?: string
          created_at?: string
          id?: string
          jumlah_ayat?: number
          kategori?: string | null
        }
        Relationships: []
      }
      operator_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          mazmur_id: string | null
          metadata: Json | null
          peserta_id: string | null
          role: string | null
          session_id: string | null
          user_id: string | null
          user_nama: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          mazmur_id?: string | null
          metadata?: Json | null
          peserta_id?: string | null
          role?: string | null
          session_id?: string | null
          user_id?: string | null
          user_nama?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          mazmur_id?: string | null
          metadata?: Json | null
          peserta_id?: string | null
          role?: string | null
          session_id?: string | null
          user_id?: string | null
          user_nama?: string | null
        }
        Relationships: []
      }
      penilaian: {
        Row: {
          created_at: string
          detail: Json | null
          id: string
          juri_id: string
          kriteria_id: string
          mazmur_id: string | null
          nilai: number
          peserta_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          id?: string
          juri_id: string
          kriteria_id: string
          mazmur_id?: string | null
          nilai: number
          peserta_id: string
        }
        Update: {
          created_at?: string
          detail?: Json | null
          id?: string
          juri_id?: string
          kriteria_id?: string
          mazmur_id?: string | null
          nilai?: number
          peserta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "penilaian_juri_id_fkey"
            columns: ["juri_id"]
            isOneToOne: false
            referencedRelation: "juri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_juri_id_fkey"
            columns: ["juri_id"]
            isOneToOne: false
            referencedRelation: "juri_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_kriteria_id_fkey"
            columns: ["kriteria_id"]
            isOneToOne: false
            referencedRelation: "kriteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_mazmur_id_fkey"
            columns: ["mazmur_id"]
            isOneToOne: false
            referencedRelation: "mazmur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_peserta_id_fkey"
            columns: ["peserta_id"]
            isOneToOne: false
            referencedRelation: "peserta"
            referencedColumns: ["id"]
          },
        ]
      }
      penilaian_submission: {
        Row: {
          created_at: string
          id: string
          juri_id: string
          peserta_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          juri_id: string
          peserta_id: string
        }
        Update: {
          created_at?: string
          id?: string
          juri_id?: string
          peserta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "penilaian_submission_juri_id_fkey"
            columns: ["juri_id"]
            isOneToOne: false
            referencedRelation: "juri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_submission_juri_id_fkey"
            columns: ["juri_id"]
            isOneToOne: false
            referencedRelation: "juri_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_submission_peserta_id_fkey"
            columns: ["peserta_id"]
            isOneToOne: false
            referencedRelation: "peserta"
            referencedColumns: ["id"]
          },
        ]
      }
      peserta: {
        Row: {
          asal: string | null
          created_at: string
          id: string
          kategori: string | null
          nama: string
          nomor_urut: number
          sesi: string | null
        }
        Insert: {
          asal?: string | null
          created_at?: string
          id?: string
          kategori?: string | null
          nama: string
          nomor_urut: number
          sesi?: string | null
        }
        Update: {
          asal?: string | null
          created_at?: string
          id?: string
          kategori?: string | null
          nama?: string
          nomor_urut?: number
          sesi?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_session_id: string | null
          created_at: string
          id: string
          juri_id: string | null
          nama: string
          updated_at: string
        }
        Insert: {
          active_session_id?: string | null
          created_at?: string
          id: string
          juri_id?: string | null
          nama: string
          updated_at?: string
        }
        Update: {
          active_session_id?: string | null
          created_at?: string
          id?: string
          juri_id?: string | null
          nama?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_juri_id_fkey"
            columns: ["juri_id"]
            isOneToOne: false
            referencedRelation: "juri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_juri_id_fkey"
            columns: ["juri_id"]
            isOneToOne: false
            referencedRelation: "juri_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sesi_penilaian: {
        Row: {
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          kategori: string | null
          mazmur_id: string | null
          peserta_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          kategori?: string | null
          mazmur_id?: string | null
          peserta_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          kategori?: string | null
          mazmur_id?: string | null
          peserta_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesi_penilaian_mazmur_id_fkey"
            columns: ["mazmur_id"]
            isOneToOne: false
            referencedRelation: "mazmur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sesi_penilaian_peserta_id_fkey"
            columns: ["peserta_id"]
            isOneToOne: false
            referencedRelation: "peserta"
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      juri_public: {
        Row: {
          approved: boolean | null
          bacaan_mazmur: string | null
          created_at: string | null
          id: string | null
          jabatan: string | null
          jumlah_ayat: number | null
          nama: string | null
          role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          approved?: boolean | null
          bacaan_mazmur?: string | null
          created_at?: string | null
          id?: string | null
          jabatan?: string | null
          jumlah_ayat?: number | null
          nama?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          approved?: boolean | null
          bacaan_mazmur?: string | null
          created_at?: string | null
          id?: string | null
          jabatan?: string | null
          jumlah_ayat?: number | null
          nama?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_list_juri: {
        Args: never
        Returns: {
          approved: boolean
          bacaan_mazmur: string | null
          created_at: string
          email: string | null
          id: string
          jabatan: string | null
          jumlah_ayat: number | null
          nama: string
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "juri"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_penilaian: {
        Args: never
        Returns: {
          created_at: string
          detail: Json | null
          id: string
          juri_id: string
          kriteria_id: string
          mazmur_id: string | null
          nilai: number
          peserta_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "penilaian"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_reset_all_penilaian: { Args: never; Returns: undefined }
      akhiri_sesi: { Args: { _id: string }; Returns: undefined }
      get_ranking: {
        Args: never
        Returns: {
          asal: string
          jumlah_juri: number
          nama: string
          nomor_urut: number
          peserta_id: string
          rata_rata: number
          total_skor: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mulai_sesi: {
        Args: { _mazmur: string; _peserta: string }
        Returns: string
      }
      ubah_mazmur_sesi: {
        Args: { _id: string; _mazmur: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "juri" | "viewer" | "panitia"
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
      app_role: ["admin", "juri", "viewer", "panitia"],
    },
  },
} as const
