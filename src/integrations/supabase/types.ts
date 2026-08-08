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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      juri: {
        Row: {
          aktif_menilai: boolean
          approved: boolean
          bacaan_mazmur: string | null
          created_at: string
          email: string | null
          id: string
          is_dummy: boolean
          jabatan: string | null
          jumlah_ayat: number | null
          nama: string
          role: Database["public"]["Enums"]["app_role"] | null
          user_id: string | null
        }
        Insert: {
          aktif_menilai?: boolean
          approved?: boolean
          bacaan_mazmur?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_dummy?: boolean
          jabatan?: string | null
          jumlah_ayat?: number | null
          nama: string
          role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string | null
        }
        Update: {
          aktif_menilai?: boolean
          approved?: boolean
          bacaan_mazmur?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_dummy?: boolean
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
      live_ranking_sesi: {
        Row: {
          approved_at: string | null
          created_at: string
          hidden: boolean
          requested_at: string | null
          requested_by: string | null
          sesi_no: number
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          hidden?: boolean
          requested_at?: string | null
          requested_by?: string | null
          sesi_no: number
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          hidden?: boolean
          requested_at?: string | null
          requested_by?: string | null
          sesi_no?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      live_ranking_vote: {
        Row: {
          catatan: string | null
          created_at: string
          id: string
          juri_id: string
          sesi_no: number
          setuju: boolean
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          id?: string
          juri_id: string
          sesi_no: number
          setuju: boolean
        }
        Update: {
          catatan?: string | null
          created_at?: string
          id?: string
          juri_id?: string
          sesi_no?: number
          setuju?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "live_ranking_vote_sesi_no_fkey"
            columns: ["sesi_no"]
            isOneToOne: false
            referencedRelation: "live_ranking_sesi"
            referencedColumns: ["sesi_no"]
          },
        ]
      }
      masukan_juri: {
        Row: {
          catatan: Json
          created_at: string
          id: string
          juri_id: string
          mazmur_id: string | null
          peserta_id: string
          updated_at: string
        }
        Insert: {
          catatan?: Json
          created_at?: string
          id?: string
          juri_id: string
          mazmur_id?: string | null
          peserta_id: string
          updated_at?: string
        }
        Update: {
          catatan?: Json
          created_at?: string
          id?: string
          juri_id?: string
          mazmur_id?: string | null
          peserta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "masukan_juri_juri_id_fkey"
            columns: ["juri_id"]
            isOneToOne: false
            referencedRelation: "juri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "masukan_juri_juri_id_fkey"
            columns: ["juri_id"]
            isOneToOne: false
            referencedRelation: "juri_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "masukan_juri_mazmur_id_fkey"
            columns: ["mazmur_id"]
            isOneToOne: false
            referencedRelation: "mazmur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "masukan_juri_peserta_id_fkey"
            columns: ["peserta_id"]
            isOneToOne: false
            referencedRelation: "peserta"
            referencedColumns: ["id"]
          },
        ]
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
      password_reset_request: {
        Row: {
          created_at: string
          id: string
          identifier: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pengumuman_state: {
        Row: {
          id: number
          peserta_id: string | null
          running: boolean
          updated_at: string
        }
        Insert: {
          id?: number
          peserta_id?: string | null
          running?: boolean
          updated_at?: string
        }
        Update: {
          id?: number
          peserta_id?: string | null
          running?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pengumuman_state_peserta_id_fkey"
            columns: ["peserta_id"]
            isOneToOne: false
            referencedRelation: "peserta"
            referencedColumns: ["id"]
          },
        ]
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
          terlambat: boolean
          terlambat_at: string | null
        }
        Insert: {
          asal?: string | null
          created_at?: string
          id?: string
          kategori?: string | null
          nama: string
          nomor_urut: number
          sesi?: string | null
          terlambat?: boolean
          terlambat_at?: string | null
        }
        Update: {
          asal?: string | null
          created_at?: string
          id?: string
          kategori?: string | null
          nama?: string
          nomor_urut?: number
          sesi?: string | null
          terlambat?: boolean
          terlambat_at?: string | null
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
      system_config: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
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
      var_clarification_response: {
        Row: {
          catatan: string | null
          clarification_id: string
          id: string
          juri_id: string
          keputusan: boolean
          komponen: string
          submitted_at: string
        }
        Insert: {
          catatan?: string | null
          clarification_id: string
          id?: string
          juri_id: string
          keputusan: boolean
          komponen: string
          submitted_at?: string
        }
        Update: {
          catatan?: string | null
          clarification_id?: string
          id?: string
          juri_id?: string
          keputusan?: boolean
          komponen?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "var_clarification_response_clarification_id_fkey"
            columns: ["clarification_id"]
            isOneToOne: false
            referencedRelation: "var_clarification_session"
            referencedColumns: ["id"]
          },
        ]
      }
      var_clarification_session: {
        Row: {
          created_at: string
          finalized_at: string | null
          id: string
          komponen_berbeda: Json
          mazmur_id: string | null
          peserta_id: string
          started_at: string | null
          started_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          komponen_berbeda?: Json
          mazmur_id?: string | null
          peserta_id: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          finalized_at?: string | null
          id?: string
          komponen_berbeda?: Json
          mazmur_id?: string | null
          peserta_id?: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      var_review: {
        Row: {
          catatan: string | null
          created_at: string
          id: string
          inspektur_id: string
          keputusan: string
          peserta_id: string
          session_id: string | null
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          id?: string
          inspektur_id: string
          keputusan?: string
          peserta_id: string
          session_id?: string | null
        }
        Update: {
          catatan?: string | null
          created_at?: string
          id?: string
          inspektur_id?: string
          keputusan?: string
          peserta_id?: string
          session_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      juri_public: {
        Row: {
          aktif_menilai: boolean | null
          approved: boolean | null
          bacaan_mazmur: string | null
          created_at: string | null
          id: string | null
          is_dummy: boolean | null
          jabatan: string | null
          jumlah_ayat: number | null
          nama: string | null
          role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          aktif_menilai?: boolean | null
          approved?: boolean | null
          bacaan_mazmur?: string | null
          created_at?: string | null
          id?: string | null
          is_dummy?: boolean | null
          jabatan?: string | null
          jumlah_ayat?: number | null
          nama?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          aktif_menilai?: boolean | null
          approved?: boolean | null
          bacaan_mazmur?: string | null
          created_at?: string | null
          id?: string | null
          is_dummy?: boolean | null
          jabatan?: string | null
          jumlah_ayat?: number | null
          nama?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_buka_penilaian_ulang: {
        Args: { _catatan?: string; _peserta: string }
        Returns: string
      }
      admin_list_juri: {
        Args: never
        Returns: {
          aktif_menilai: boolean
          approved: boolean
          bacaan_mazmur: string | null
          created_at: string
          email: string | null
          id: string
          is_dummy: boolean
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
      admin_set_juri_aktif: {
        Args: { _aktif: boolean; _juri: string }
        Returns: undefined
      }
      akhiri_sesi: { Args: { _id: string }; Returns: undefined }
      all_juri_submitted: { Args: { _peserta: string }; Returns: boolean }
      detect_potensi_var: { Args: { _peserta: string }; Returns: string }
      get_klarifikasi_status: { Args: { _peserta: string }; Returns: Json }
      get_ranking: {
        Args: never
        Returns: {
          asal: string
          jumlah_juri: number
          juri_spread: number
          juri_total_sum: number
          nama: string
          nilai_akhir: number
          nomor_urut: number
          peserta_id: string
          rata_rata: number
          total_skor: number
          var_status: string
        }[]
      }
      get_submission_progress: {
        Args: { _peserta: string }
        Returns: {
          done_count: number
          total_count: number
        }[]
      }
      get_var_aktif: {
        Args: never
        Returns: {
          bacaan: string
          juri_total: number
          komponen_berbeda: Json
          nama: string
          nomor_urut: number
          peserta_id: string
          session_id: string
          status: string
          submitted_count: number
        }[]
      }
      get_var_manual_pending: {
        Args: never
        Returns: {
          alasan: string
          nomor_urut: number
          peserta_id: string
          peserta_nama: string
          session_id: string
          sudah_vote: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hitung_nilai_akhir: { Args: { _peserta: string }; Returns: number }
      hitung_nilai_juri: {
        Args: { _juri: string; _peserta: string }
        Returns: number
      }
      inspektur_ajukan_live_ranking: { Args: { _sesi: number }; Returns: Json }
      inspektur_ajukan_var: {
        Args: { _alasan: string; _peserta: string }
        Returns: string
      }
      inspektur_akhiri_sesi: { Args: { _peserta: string }; Returns: undefined }
      inspektur_batalkan_live_ranking: {
        Args: { _sesi: number }
        Returns: Json
      }
      inspektur_buka_perhatian: {
        Args: { _catatan?: string; _peserta: string }
        Returns: string
      }
      inspektur_catat: {
        Args: { _catatan: string; _keputusan: string; _peserta: string }
        Returns: string
      }
      inspektur_list_var: {
        Args: never
        Returns: {
          bacaan: string
          detected_at: string
          juri_berbeda: number
          kategori: string
          komponen_berbeda: Json
          nama: string
          nomor_urut: number
          peserta_id: string
          status: string
        }[]
      }
      inspektur_monitor: {
        Args: never
        Returns: {
          bacaan: string
          juri_done: number
          juri_total: number
          kategori: string
          nama: string
          nomor_urut: number
          peserta_id: string
          status: string
        }[]
      }
      inspektur_progres_juri: { Args: { _peserta: string }; Returns: Json }
      inspektur_ringkasan: {
        Args: never
        Returns: {
          belum_tampil: number
          sedang_tampil: number
          sesi_aktif: number
          sesi_selesai: number
          sudah_tampil: number
          total_peserta: number
          total_var: number
        }[]
      }
      inspektur_selesaikan_var: {
        Args: { _catatan: string; _keputusan: string; _peserta: string }
        Returns: string
      }
      inspektur_set_hide_live_ranking: {
        Args: { _hidden: boolean; _sesi: number }
        Returns: Json
      }
      inspektur_terapkan_perbaikan: {
        Args: { _catatan?: string; _peserta: string }
        Returns: string
      }
      inspektur_var_detail: { Args: { _peserta: string }; Returns: Json }
      is_peserta_final: { Args: { _peserta: string }; Returns: boolean }
      is_peserta_uji: { Args: { _peserta: string }; Returns: boolean }
      is_vmix_viewer: { Args: { _uid: string }; Returns: boolean }
      juri_hasil_final: { Args: never; Returns: Json }
      juri_in_pool: {
        Args: { _juri: string; _peserta: string }
        Returns: boolean
      }
      juri_live_ranking_pending: { Args: never; Returns: Json }
      juri_pool_count: { Args: { _peserta: string }; Returns: number }
      juri_vote_live_ranking: {
        Args: { _catatan?: string; _sesi: number; _setuju: boolean }
        Returns: Json
      }
      juri_vote_var: {
        Args: { _session: string; _setuju: boolean }
        Returns: Json
      }
      live_ranking_sesi_list: { Args: never; Returns: Json }
      lookup_nilai: { Args: { _grade: number }; Returns: number }
      mulai_klarifikasi_var: { Args: { _peserta: string }; Returns: string }
      mulai_sesi: {
        Args: { _mazmur: string; _peserta: string }
        Returns: string
      }
      public_live_state: { Args: never; Returns: Json }
      public_pengumuman_state: { Args: never; Returns: Json }
      set_pengumuman_state: {
        Args: { _peserta: string; _running: boolean }
        Returns: undefined
      }
      set_peserta_terlambat: {
        Args: { _peserta: string; _terlambat: boolean }
        Returns: undefined
      }
      submit_klarifikasi_var: {
        Args: { _peserta: string; _responses: Json }
        Returns: Json
      }
      ubah_mazmur_sesi: {
        Args: { _id: string; _mazmur: string }
        Returns: undefined
      }
      var_detail_persepsi: { Args: { _peserta: string }; Returns: Json }
      viewer_catatan_peserta: { Args: { _peserta: string }; Returns: Json }
      viewer_peserta_list: { Args: never; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "juri"
        | "viewer"
        | "panitia"
        | "inspektur"
        | "ketua_juri"
        | "operator_vmix"
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
      app_role: [
        "admin",
        "juri",
        "viewer",
        "panitia",
        "inspektur",
        "ketua_juri",
        "operator_vmix",
      ],
    },
  },
} as const
