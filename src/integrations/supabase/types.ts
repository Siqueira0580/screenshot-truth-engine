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
      ai_generated_chords: {
        Row: {
          chord_data: Json
          chord_name: string
          created_at: string
          id: string
          instrument: string
        }
        Insert: {
          chord_data: Json
          chord_name: string
          created_at?: string
          id?: string
          instrument?: string
        }
        Update: {
          chord_data?: Json
          chord_name?: string
          created_at?: string
          id?: string
          instrument?: string
        }
        Relationships: []
      }
      artists: {
        Row: {
          about: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          photo_url: string | null
        }
        Insert: {
          about?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          photo_url?: string | null
        }
        Update: {
          about?: string | null
          created_at?: string
          created_by?: string | null
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
          file_backing_vocal: string | null
          file_full: string | null
          file_guitar: string | null
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
          file_backing_vocal?: string | null
          file_full?: string | null
          file_guitar?: string | null
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
          file_backing_vocal?: string | null
          file_full?: string | null
          file_guitar?: string | null
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
      broadcast_sessions: {
        Row: {
          created_at: string
          current_song_index: number
          id: string
          is_playing: boolean
          master_id: string
          master_name: string | null
          scroll_top: number
          setlist_id: string
          speed: number | null
          transpose: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_song_index?: number
          id: string
          is_playing?: boolean
          master_id: string
          master_name?: string | null
          scroll_top?: number
          setlist_id: string
          speed?: number | null
          transpose?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_song_index?: number
          id?: string
          is_playing?: boolean
          master_id?: string
          master_name?: string | null
          scroll_top?: number
          setlist_id?: string
          speed?: number | null
          transpose?: number
          updated_at?: string
        }
        Relationships: []
      }
      community_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      community_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          content: string
          created_at: string
          facebook_url: string | null
          group_id: string | null
          id: string
          image_url: string | null
          instagram_url: string | null
          setlist_id: string | null
          updated_at: string | null
          user_id: string | null
          youtube_url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          facebook_url?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          setlist_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          facebook_url?: string | null
          group_id?: string | null
          id?: string
          image_url?: string | null
          instagram_url?: string | null
          setlist_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      composition_audios: {
        Row: {
          audio_url: string
          composition_id: string
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          audio_url: string
          composition_id: string
          created_at?: string
          id?: string
          title?: string
          user_id: string
        }
        Update: {
          audio_url?: string
          composition_id?: string
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "composition_audios_composition_id_fkey"
            columns: ["composition_id"]
            isOneToOne: false
            referencedRelation: "compositions"
            referencedColumns: ["id"]
          },
        ]
      }
      compositions: {
        Row: {
          audio_url: string | null
          body_text: string | null
          bpm: number | null
          composers: string | null
          created_at: string
          id: string
          musical_key: string | null
          shared_with_emails: string[] | null
          style: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          body_text?: string | null
          bpm?: number | null
          composers?: string | null
          created_at?: string
          id?: string
          musical_key?: string | null
          shared_with_emails?: string[] | null
          style?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          body_text?: string | null
          bpm?: number | null
          composers?: string | null
          created_at?: string
          id?: string
          musical_key?: string | null
          shared_with_emails?: string[] | null
          style?: string | null
          title?: string
          updated_at?: string
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
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          receiver_id: string | null
          sender_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          receiver_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      group_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          group_id: string
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          group_id: string
          id?: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          group_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "community_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          chord_preferences: Json | null
          created_at: string
          default_genre: string | null
          default_instrument: string | null
          email: string | null
          facebook_url: string | null
          favorite_artists: Json | null
          favorite_styles: string[] | null
          first_name: string | null
          has_seen_repertoire_wizard: boolean | null
          has_seen_wizard: boolean | null
          id: string
          instagram_url: string | null
          is_admin: boolean | null
          is_banned: boolean | null
          last_name: string | null
          library_setup_completed: boolean
          phone: string | null
          preferred_instrument: string
          pro_expires_at: string | null
          role: string | null
          started_with_empty_studio: boolean
          subscription_plan: string
          terms_accepted: boolean
          wizard_completed: boolean
        }
        Insert: {
          avatar_url?: string | null
          chord_preferences?: Json | null
          created_at?: string
          default_genre?: string | null
          default_instrument?: string | null
          email?: string | null
          facebook_url?: string | null
          favorite_artists?: Json | null
          favorite_styles?: string[] | null
          first_name?: string | null
          has_seen_repertoire_wizard?: boolean | null
          has_seen_wizard?: boolean | null
          id: string
          instagram_url?: string | null
          is_admin?: boolean | null
          is_banned?: boolean | null
          last_name?: string | null
          library_setup_completed?: boolean
          phone?: string | null
          preferred_instrument?: string
          pro_expires_at?: string | null
          role?: string | null
          started_with_empty_studio?: boolean
          subscription_plan?: string
          terms_accepted?: boolean
          wizard_completed?: boolean
        }
        Update: {
          avatar_url?: string | null
          chord_preferences?: Json | null
          created_at?: string
          default_genre?: string | null
          default_instrument?: string | null
          email?: string | null
          facebook_url?: string | null
          favorite_artists?: Json | null
          favorite_styles?: string[] | null
          first_name?: string | null
          has_seen_repertoire_wizard?: boolean | null
          has_seen_wizard?: boolean | null
          id?: string
          instagram_url?: string | null
          is_admin?: boolean | null
          is_banned?: boolean | null
          last_name?: string | null
          library_setup_completed?: boolean
          phone?: string | null
          preferred_instrument?: string
          pro_expires_at?: string | null
          role?: string | null
          started_with_empty_studio?: boolean
          subscription_plan?: string
          terms_accepted?: boolean
          wizard_completed?: boolean
        }
        Relationships: []
      }
      setlist_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          setlist_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          setlist_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          setlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlist_comments_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
            referencedColumns: ["id"]
          },
        ]
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
      setlist_likes: {
        Row: {
          created_at: string
          id: string
          setlist_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          setlist_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          setlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setlist_likes_setlist_id_fkey"
            columns: ["setlist_id"]
            isOneToOne: false
            referencedRelation: "setlists"
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
          is_public: boolean
          musicians: Json | null
          name: string
          public_share_token: string | null
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
          is_public?: boolean
          musicians?: Json | null
          name: string
          public_share_token?: string | null
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
          is_public?: boolean
          musicians?: Json | null
          name?: string
          public_share_token?: string | null
          show_date?: string | null
          show_duration?: number | null
          start_time?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      song_edits: {
        Row: {
          created_at: string
          id: string
          song_id: string
          summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          song_id: string
          summary?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          song_id?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_edits_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
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
          created_by: string | null
          default_speed: number | null
          enrichment_status: string | null
          id: string
          loop_count: number | null
          musical_key: string | null
          pdf_url: string | null
          style: string | null
          time_signature: string | null
          title: string
          updated_at: string
          user_id: string | null
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
          created_by?: string | null
          default_speed?: number | null
          enrichment_status?: string | null
          id?: string
          loop_count?: number | null
          musical_key?: string | null
          pdf_url?: string | null
          style?: string | null
          time_signature?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
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
          created_by?: string | null
          default_speed?: number | null
          enrichment_status?: string | null
          id?: string
          loop_count?: number | null
          musical_key?: string | null
          pdf_url?: string | null
          style?: string | null
          time_signature?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
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
      user_library: {
        Row: {
          added_at: string
          id: string
          song_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          song_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_library_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_login_logs: {
        Row: {
          id: string
          ip_address: string | null
          login_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          login_at?: string
          user_agent?: string | null
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_setlist: {
        Args: { p_token: string }
        Returns: {
          end_time: string
          id: string
          is_public: boolean
          musicians: Json
          name: string
          show_date: string
          start_time: string
        }[]
      }
      get_public_setlist_items: {
        Args: { p_token: string }
        Returns: {
          bpm: number
          id: string
          loop_count: number
          position: number
          song_artist: string
          song_id: string
          song_musical_key: string
          song_title: string
          speed: number
          transposed_key: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_creator: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
