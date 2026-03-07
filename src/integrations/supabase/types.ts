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
      artists: {
        Row: {
          about: string | null
          created_at: string
          id: string
          name: string
          photo_url: string | null
        }
        Insert: {
          about?: string | null
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
        }
        Update: {
          about?: string | null
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
        }
        Relationships: []
      }
      audio_tracks: {
        Row: {
          ai_chordpro_text: string | null
          created_at: string
          file_full: string | null
          file_harmony: string | null
          file_percussion: string | null
          file_vocals: string | null
          id: string
          song_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_chordpro_text?: string | null
          created_at?: string
          file_full?: string | null
          file_harmony?: string | null
          file_percussion?: string | null
          file_vocals?: string | null
          id?: string
          song_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_chordpro_text?: string | null
          created_at?: string
          file_full?: string | null
          file_harmony?: string | null
          file_percussion?: string | null
          file_vocals?: string | null
          id?: string
          song_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_tracks_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_group_members: {
        Row: {
          created_at: string
          email: string
          group_id: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          group_id: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          group_id?: string
          id?: string
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "broadcast_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_chords: {
        Row: {
          chord_name: string
          created_at: string
          frets: number[] | null
          id: string
          image_url: string | null
          instrument: string
          user_id: string | null
        }
        Insert: {
          chord_name: string
          created_at?: string
          frets?: number[] | null
          id?: string
          image_url?: string | null
          instrument?: string
          user_id?: string | null
        }
        Update: {
          chord_name?: string
          created_at?: string
          frets?: number[] | null
          id?: string
          image_url?: string | null
          instrument?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          preferred_instrument: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          preferred_instrument?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          preferred_instrument?: string
        }
        Relationships: []
      }
      setlist_items: {
        Row: {
          bpm: number | null
          id: string
          loop_count: number | null
          position: number
          setlist_id: string
          song_id: string
          speed: number | null
          transposed_key: string | null
        }
        Insert: {
          bpm?: number | null
          id?: string
          loop_count?: number | null
          position: number
          setlist_id: string
          song_id: string
          speed?: number | null
          transposed_key?: string | null
        }
        Update: {
          bpm?: number | null
          id?: string
          loop_count?: number | null
          position?: number
          setlist_id?: string
          song_id?: string
          speed?: number | null
          transposed_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setlist_items_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setlist_items_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      setlists: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          interval_duration: number | null
          musicians: Json | null
          name: string
          show_date: string | null
          show_duration: number | null
          start_time: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          interval_duration?: number | null
          musicians?: Json | null
          name: string
          show_date?: string | null
          show_duration?: number | null
          start_time?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          interval_duration?: number | null
          musicians?: Json | null
          name?: string
          show_date?: string | null
          show_duration?: number | null
          start_time?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      songs: {
        Row: {
          access_count: number | null
          artist: string | null
          auto_next: boolean | null
          body_text: string | null
          bpm: number | null
          composer: string | null
          created_at: string
          default_speed: number | null
          id: string
          loop_count: number | null
          musical_key: string | null
          style: string | null
          time_signature: string | null
          title: string
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          access_count?: number | null
          artist?: string | null
          auto_next?: boolean | null
          body_text?: string | null
          bpm?: number | null
          composer?: string | null
          created_at?: string
          default_speed?: number | null
          id?: string
          loop_count?: number | null
          musical_key?: string | null
          style?: string | null
          time_signature?: string | null
          title: string
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          access_count?: number | null
          artist?: string | null
          auto_next?: boolean | null
          body_text?: string | null
          bpm?: number | null
          composer?: string | null
          created_at?: string
          default_speed?: number | null
          id?: string
          loop_count?: number | null
          musical_key?: string | null
          style?: string | null
          time_signature?: string | null
          title?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      sync_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          guest_email: string
          id: string
          master_id: string
          setlist_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          guest_email: string
          id?: string
          master_id: string
          setlist_id: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          guest_email?: string
          id?: string
          master_id?: string
          setlist_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_invites_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
