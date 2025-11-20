// Database types generated from Supabase schema

export interface Database {
  public: {
    Tables: {
      bowlers: {
        Row: Bowler
        Insert: Omit<Bowler, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Bowler, 'id'>>
      }
      bowler_aliases: {
        Row: BowlerAlias
        Insert: Omit<BowlerAlias, 'id' | 'created_at'>
        Update: Partial<Omit<BowlerAlias, 'id'>>
      }
      teams: {
        Row: Team
        Insert: Omit<Team, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Team, 'id'>>
      }
      team_bowlers: {
        Row: TeamBowler
        Insert: Omit<TeamBowler, 'id' | 'created_at'>
        Update: Partial<Omit<TeamBowler, 'id'>>
      }
      sessions: {
        Row: Session
        Insert: Omit<Session, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Session, 'id'>>
      }
      series: {
        Row: Series
        Insert: Omit<Series, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Series, 'id'>>
      }
      games: {
        Row: Game
        Insert: Omit<Game, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Game, 'id'>>
      }
      frames: {
        Row: Frame
        Insert: Omit<Frame, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Frame, 'id'>>
      }
      uploads: {
        Row: Upload
        Insert: Omit<Upload, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Upload, 'id'>>
      }
      session_merge_groups: {
        Row: SessionMergeGroup
        Insert: Omit<SessionMergeGroup, 'id' | 'created_at'>
        Update: Partial<Omit<SessionMergeGroup, 'id'>>
      }
      session_merge_members: {
        Row: SessionMergeMember
        Insert: Omit<SessionMergeMember, 'id' | 'added_at'>
        Update: Partial<Omit<SessionMergeMember, 'id'>>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_bowler_stats: {
        Args: { bowler_uuid: string }
        Returns: BowlerStats
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export interface Bowler {
  id: string
  primary_user_id: string | null
  canonical_name: string
  created_by_user_id: string
  created_at: string
  updated_at: string
}

export interface BowlerAlias {
  id: string
  bowler_id: string
  alias: string
  source: 'manual' | 'auto_vision'
  confidence_score: number | null
  created_at: string
}

export interface Team {
  id: string
  name: string
  created_by_user_id: string
  created_at: string
  updated_at: string
}

export interface TeamBowler {
  id: string
  team_id: string
  bowler_id: string
  active_from: string
  active_to: string | null
  created_at: string
}

export interface Session {
  id: string
  date_time: string
  location: string | null
  lane: number | null
  bowling_alley_name: string | null
  created_by_user_id: string
  created_at: string
  updated_at: string
}

export interface Series {
  id: string
  session_id: string
  team_id: string | null
  bowler_id: string
  games_count: number
  series_total: number
  created_at: string
  updated_at: string
}

export interface Game {
  id: string
  series_id: string
  game_number: number
  bowler_id: string
  total_score: number | null
  is_partial: boolean
  handicap: number
  created_at: string
  updated_at: string
}

export interface Frame {
  id: string
  game_id: string
  frame_number: number
  roll_1: number | null
  roll_2: number | null
  roll_3: number | null
  notation: string | null
  created_at: string
  updated_at: string
}

export interface Upload {
  id: string
  user_id: string
  session_id: string | null
  storage_path: string
  original_filename: string
  file_size_bytes: number | null
  exif_datetime: string | null
  exif_location_lat: number | null
  exif_location_lng: number | null
  exif_location_name: string | null
  raw_vision_json: any | null
  parsed: boolean
  parsing_error: string | null
  created_at: string
  updated_at: string
}

export interface SessionMergeGroup {
  id: string
  canonical_session_id: string
  merge_reason: string | null
  confidence_score: number | null
  created_at: string
}

export interface SessionMergeMember {
  id: string
  merge_group_id: string
  session_id: string
  added_by_user_id: string
  added_at: string
}

// API Response types
export interface ParsedScoreboard {
  session: {
    date_time?: string
    location?: string
    lane?: number
    bowling_alley_name?: string
  }
  teams?: Array<{
    name: string
    bowlers: string[]
  }>
  bowlers: Array<{
    name: string
    team?: string
    games: Array<{
      game_number: number
      total_score?: number
      frames?: Array<{
        frame_number: number
        roll_1?: number
        roll_2?: number
        roll_3?: number
        notation?: string
      }>
    }>
  }>
}

export interface BowlerStats {
  total_games: number
  total_score: number
  average_score: number
  high_game: number
  high_series: number
}
