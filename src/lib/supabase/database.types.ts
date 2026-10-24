// Archivo generado por scripts/gen-db-types.mjs (npm run db:types). No editar a mano.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      hubgames_capturas: {
        Row: {
          captura: string
          id_videojuego: number | null
        }
        Insert: {
          captura: string
          id_videojuego?: number | null
        }
        Update: {
          captura?: string
          id_videojuego?: number | null
        }
        Relationships: []
      }
      hubgames_generos: {
        Row: {
          genero: string
        }
        Insert: {
          genero: string
        }
        Update: {
          genero?: string
        }
        Relationships: []
      }
      hubgames_judi_fases_usuario: {
        Row: {
          id_lista_judi: number
          id_usuario: string
          completado: boolean
          fecha_completado: string | null
          fase1: boolean
          fase2: boolean
          fase3: boolean
          fase4: boolean
          fase5: boolean
          fase6: boolean
          fase7: boolean
        }
        Insert: {
          id_lista_judi: number
          id_usuario: string
          completado?: boolean
          fecha_completado?: string | null
          fase1?: boolean
          fase2?: boolean
          fase3?: boolean
          fase4?: boolean
          fase5?: boolean
          fase6?: boolean
          fase7?: boolean
        }
        Update: {
          id_lista_judi?: number
          id_usuario?: string
          completado?: boolean
          fecha_completado?: string | null
          fase1?: boolean
          fase2?: boolean
          fase3?: boolean
          fase4?: boolean
          fase5?: boolean
          fase6?: boolean
          fase7?: boolean
        }
        Relationships: []
      }
      hubgames_judi_generacion_logs: {
        Row: {
          id: number
          fecha_ejecucion: string | null
          exito: boolean
          error_mensaje: string | null
          error_stack: string | null
          id_juego_rawg: number | null
          nombre_juego: string | null
          fecha_judi: string | null
          id_juego_steam: number | null
          fuente: string | null
        }
        Insert: {
          id?: number
          fecha_ejecucion?: string | null
          exito: boolean
          error_mensaje?: string | null
          error_stack?: string | null
          id_juego_rawg?: number | null
          nombre_juego?: string | null
          fecha_judi?: string | null
          id_juego_steam?: number | null
          fuente?: string | null
        }
        Update: {
          id?: number
          fecha_ejecucion?: string | null
          exito?: boolean
          error_mensaje?: string | null
          error_stack?: string | null
          id_juego_rawg?: number | null
          nombre_juego?: string | null
          fecha_judi?: string | null
          id_juego_steam?: number | null
          fuente?: string | null
        }
        Relationships: []
      }
      hubgames_judi_intentos: {
        Row: {
          id: number
          id_lista_judi: number
          id_usuario: string
          intento: string
          created_at: string | null
        }
        Insert: {
          id?: number
          id_lista_judi: number
          id_usuario: string
          intento: string
          created_at?: string | null
        }
        Update: {
          id?: number
          id_lista_judi?: number
          id_usuario?: string
          intento?: string
          created_at?: string | null
        }
        Relationships: []
      }
      hubgames_judi_pool: {
        Row: {
          id: number
          week_start_date: string
          week_end_date: string
          steam_appid: number
          game_name: string
          relevance_score: number
          is_eligible: boolean
          eligibility_reasons: string[] | null
          filter_reviews_min_pass: boolean
          filter_screenshots_pass: boolean
          filter_positive_score_pass: boolean
          filter_metadata_complete_pass: boolean
          selected_for_daily: boolean
          selected_daily_date: string | null
          selected_daily_list_id: number | null
          discarded: boolean
          discarded_reason: string | null
          source_tag: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          week_start_date: string
          week_end_date: string
          steam_appid: number
          game_name: string
          relevance_score?: number
          is_eligible?: boolean
          eligibility_reasons?: string[] | null
          filter_reviews_min_pass?: boolean
          filter_screenshots_pass?: boolean
          filter_positive_score_pass?: boolean
          filter_metadata_complete_pass?: boolean
          selected_for_daily?: boolean
          selected_daily_date?: string | null
          selected_daily_list_id?: number | null
          discarded?: boolean
          discarded_reason?: string | null
          source_tag?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          week_start_date?: string
          week_end_date?: string
          steam_appid?: number
          game_name?: string
          relevance_score?: number
          is_eligible?: boolean
          eligibility_reasons?: string[] | null
          filter_reviews_min_pass?: boolean
          filter_screenshots_pass?: boolean
          filter_positive_score_pass?: boolean
          filter_metadata_complete_pass?: boolean
          selected_for_daily?: boolean
          selected_daily_date?: string | null
          selected_daily_list_id?: number | null
          discarded?: boolean
          discarded_reason?: string | null
          source_tag?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hubgames_juegos_steam: {
        Row: {
          steam_appid: number
          name: string
          type: string | null
          required_age: number | null
          is_free: boolean | null
          short_description: string | null
          detailed_description: string | null
          about_the_game: string | null
          supported_languages: string | null
          developers: string[] | null
          publishers: string[] | null
          website: string | null
          header_image: string | null
          capsule_image: string | null
          capsule_imagev5: string | null
          background: string | null
          background_raw: string | null
          release_date_text: string | null
          release_date: string | null
          coming_soon: boolean | null
          metacritic_score: number | null
          metacritic_url: string | null
          categories: Json | null
          genres: Json | null
          screenshots: Json | null
          movies: Json | null
          price_overview: Json | null
          packages: Json | null
          platforms: Json | null
          recommendations_total: number | null
          achievements_total: number | null
          steamspy_score_rank: number | null
          steamspy_positive: number | null
          steamspy_negative: number | null
          steamspy_userscore: number | null
          steamspy_owners: string | null
          steamspy_average_forever: number | null
          steamspy_average_2weeks: number | null
          steamspy_median_forever: number | null
          steamspy_median_2weeks: number | null
          steamspy_ccu: number | null
          steamspy_tags: Json | null
          steamspy_raw: Json | null
          steam_web_raw: Json | null
          steam_store_raw: Json | null
          source_priority: number | null
          last_synced_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          steam_appid?: number
          name: string
          type?: string | null
          required_age?: number | null
          is_free?: boolean | null
          short_description?: string | null
          detailed_description?: string | null
          about_the_game?: string | null
          supported_languages?: string | null
          developers?: string[] | null
          publishers?: string[] | null
          website?: string | null
          header_image?: string | null
          capsule_image?: string | null
          capsule_imagev5?: string | null
          background?: string | null
          background_raw?: string | null
          release_date_text?: string | null
          release_date?: string | null
          coming_soon?: boolean | null
          metacritic_score?: number | null
          metacritic_url?: string | null
          categories?: Json | null
          genres?: Json | null
          screenshots?: Json | null
          movies?: Json | null
          price_overview?: Json | null
          packages?: Json | null
          platforms?: Json | null
          recommendations_total?: number | null
          achievements_total?: number | null
          steamspy_score_rank?: number | null
          steamspy_positive?: number | null
          steamspy_negative?: number | null
          steamspy_userscore?: number | null
          steamspy_owners?: string | null
          steamspy_average_forever?: number | null
          steamspy_average_2weeks?: number | null
          steamspy_median_forever?: number | null
          steamspy_median_2weeks?: number | null
          steamspy_ccu?: number | null
          steamspy_tags?: Json | null
          steamspy_raw?: Json | null
          steam_web_raw?: Json | null
          steam_store_raw?: Json | null
          source_priority?: number | null
          last_synced_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          steam_appid?: number
          name?: string
          type?: string | null
          required_age?: number | null
          is_free?: boolean | null
          short_description?: string | null
          detailed_description?: string | null
          about_the_game?: string | null
          supported_languages?: string | null
          developers?: string[] | null
          publishers?: string[] | null
          website?: string | null
          header_image?: string | null
          capsule_image?: string | null
          capsule_imagev5?: string | null
          background?: string | null
          background_raw?: string | null
          release_date_text?: string | null
          release_date?: string | null
          coming_soon?: boolean | null
          metacritic_score?: number | null
          metacritic_url?: string | null
          categories?: Json | null
          genres?: Json | null
          screenshots?: Json | null
          movies?: Json | null
          price_overview?: Json | null
          packages?: Json | null
          platforms?: Json | null
          recommendations_total?: number | null
          achievements_total?: number | null
          steamspy_score_rank?: number | null
          steamspy_positive?: number | null
          steamspy_negative?: number | null
          steamspy_userscore?: number | null
          steamspy_owners?: string | null
          steamspy_average_forever?: number | null
          steamspy_average_2weeks?: number | null
          steamspy_median_forever?: number | null
          steamspy_median_2weeks?: number | null
          steamspy_ccu?: number | null
          steamspy_tags?: Json | null
          steamspy_raw?: Json | null
          steam_web_raw?: Json | null
          steam_store_raw?: Json | null
          source_priority?: number | null
          last_synced_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hubgames_lista_videojuegos_judi: {
        Row: {
          id: number
          id_videojuego: number
          nombre: string
          fecha: string
          calificacion: number
          desarrollador: string
          released: string
          steam_appid: number | null
          data_source: string
        }
        Insert: {
          id?: number
          id_videojuego: number
          nombre: string
          fecha: string
          calificacion: number
          desarrollador: string
          released: string
          steam_appid?: number | null
          data_source?: string
        }
        Update: {
          id?: number
          id_videojuego?: number
          nombre?: string
          fecha?: string
          calificacion?: number
          desarrollador?: string
          released?: string
          steam_appid?: number | null
          data_source?: string
        }
        Relationships: []
      }
      hubgames_plataformas: {
        Row: {
          plataforma: string
        }
        Insert: {
          plataforma: string
        }
        Update: {
          plataforma?: string
        }
        Relationships: []
      }
      hubgames_push_subscriptions: {
        Row: {
          id: string
          user_id: string
          subscription: Json
          enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription: Json
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subscription?: Json
          enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hubgames_usuarios: {
        Row: {
          id: string
          username: string
          email: string
          password_hash: string | null
          email_verificado: boolean
          fecha_creacion: string
          cuenta_google: boolean
          administrador: boolean
        }
        Insert: {
          id?: string
          username: string
          email: string
          password_hash?: string | null
          email_verificado?: boolean
          fecha_creacion?: string
          cuenta_google?: boolean
          administrador?: boolean
        }
        Update: {
          id?: string
          username?: string
          email?: string
          password_hash?: string | null
          email_verificado?: boolean
          fecha_creacion?: string
          cuenta_google?: boolean
          administrador?: boolean
        }
        Relationships: []
      }
      hubgames_videojuego_genero: {
        Row: {
          id_videojuego: number
          genero: string
        }
        Insert: {
          id_videojuego: number
          genero: string
        }
        Update: {
          id_videojuego?: number
          genero?: string
        }
        Relationships: []
      }
      hubgames_videojuego_plataforma: {
        Row: {
          id_videojuego: number
          plataforma: string
        }
        Insert: {
          id_videojuego: number
          plataforma: string
        }
        Update: {
          id_videojuego?: number
          plataforma?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hubgames_check_available: {
        Args: { p_email: string; p_username: string }
        Returns: { email_taken: boolean; username_taken: boolean }
      }
      hubgames_judi_ranking_rows: {
        Args: never
        Returns: {
          completado: boolean
          fase1: boolean
          fase2: boolean
          fase3: boolean
          fase4: boolean
          fase5: boolean
          fase6: boolean
          id_usuario: string
          username: string | null
        }[]
      }
      hubgames_judi_search_pool: {
        Args: { p_query: string }
        Returns: { game_name: string; steam_appid: number }[]
      }
      is_admin: {
        Args: never
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
