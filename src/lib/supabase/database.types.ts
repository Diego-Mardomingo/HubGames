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
      hubgames_achievements: {
        Row: {
          user_id: string | null
          appid: number | null
          apiname: string | null
          achieved: boolean | null
          unlocktime: string | null
          display_name: string | null
          description: string | null
          icon: string | null
          icongray: string | null
          hidden: boolean | null
          global_percent: number | null
        }
        Insert: {
          user_id?: string | null
          appid?: number | null
          apiname?: string | null
          achieved?: boolean | null
          unlocktime?: string | null
          display_name?: string | null
          description?: string | null
          icon?: string | null
          icongray?: string | null
          hidden?: boolean | null
          global_percent?: number | null
        }
        Update: {
          user_id?: string | null
          appid?: number | null
          apiname?: string | null
          achieved?: boolean | null
          unlocktime?: string | null
          display_name?: string | null
          description?: string | null
          icon?: string | null
          icongray?: string | null
          hidden?: boolean | null
          global_percent?: number | null
        }
        Relationships: []
      }
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
      hubgames_game_duration: {
        Row: {
          appid: number | null
          main: number | null
          main_extra: number | null
          completionist: number | null
          source: string | null
          hltb_id: number | null
          match_confidence: number | null
        }
        Insert: {
          appid?: number | null
          main?: number | null
          main_extra?: number | null
          completionist?: number | null
          source?: string | null
          hltb_id?: number | null
          match_confidence?: number | null
        }
        Update: {
          appid?: number | null
          main?: number | null
          main_extra?: number | null
          completionist?: number | null
          source?: string | null
          hltb_id?: number | null
          match_confidence?: number | null
        }
        Relationships: []
      }
      hubgames_game_prices: {
        Row: {
          appid: number
          currency: string | null
          price_initial: number | null
          price_final: number | null
          discount_percent: number | null
          price_synced_at: string | null
          itad_id: string | null
          itad_checked_at: string | null
          steam_low: number | null
          steam_low_at: string | null
          all_low: number | null
          all_low_shop: string | null
          all_low_at: string | null
          lows_synced_at: string | null
        }
        Insert: {
          appid?: number
          currency?: string | null
          price_initial?: number | null
          price_final?: number | null
          discount_percent?: number | null
          price_synced_at?: string | null
          itad_id?: string | null
          itad_checked_at?: string | null
          steam_low?: number | null
          steam_low_at?: string | null
          all_low?: number | null
          all_low_shop?: string | null
          all_low_at?: string | null
          lows_synced_at?: string | null
        }
        Update: {
          appid?: number
          currency?: string | null
          price_initial?: number | null
          price_final?: number | null
          discount_percent?: number | null
          price_synced_at?: string | null
          itad_id?: string | null
          itad_checked_at?: string | null
          steam_low?: number | null
          steam_low_at?: string | null
          all_low?: number | null
          all_low_shop?: string | null
          all_low_at?: string | null
          lows_synced_at?: string | null
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
      hubgames_hltb: {
        Row: {
          appid: number
          hltb_id: number | null
          hltb_name: string | null
          main: number | null
          main_extra: number | null
          completionist: number | null
          match_confidence: number | null
          fetched_at: string
        }
        Insert: {
          appid?: number
          hltb_id?: number | null
          hltb_name?: string | null
          main?: number | null
          main_extra?: number | null
          completionist?: number | null
          match_confidence?: number | null
          fetched_at?: string
        }
        Update: {
          appid?: number
          hltb_id?: number | null
          hltb_name?: string | null
          main?: number | null
          main_extra?: number | null
          completionist?: number | null
          match_confidence?: number | null
          fetched_at?: string
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
          intento: string | null
          created_at: string | null
        }
        Insert: {
          id?: number
          id_lista_judi: number
          id_usuario: string
          intento?: string | null
          created_at?: string | null
        }
        Update: {
          id?: number
          id_lista_judi?: number
          id_usuario?: string
          intento?: string | null
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
      hubgames_library: {
        Row: {
          user_id: string | null
          appid: number | null
          status: string | null
          status_source: string | null
          rating: number | null
          started_at: string | null
          completed_at: string | null
          review: string | null
          backlog_position: number | null
          goal: string | null
          created_at: string | null
          updated_at: string | null
          playtime_forever: number | null
          playtime_2weeks: number | null
          rtime_last_played: string | null
          achievements_total: number | null
          achievements_unlocked: number | null
          last_unlock_at: string | null
          name: string | null
          header_image: string | null
          steamspy_userscore: number | null
          status_changed_at: string | null
          suggestion: string | null
          suggestion_dismissed_at: string | null
          genres: Json | null
          release_date: string | null
          steamspy_median_forever: number | null
          hltb_main: number | null
          hltb_main_extra: number | null
          hltb_completionist: number | null
          favorite: boolean | null
          endless: boolean | null
          owned: boolean | null
          metacritic_score: number | null
          is_free: boolean | null
          coming_soon: boolean | null
          price_initial: number | null
          price_final: number | null
          discount_percent: number | null
          itad_id: string | null
          steam_low: number | null
          steam_low_at: string | null
          all_low: number | null
          all_low_shop: string | null
          all_low_at: string | null
        }
        Insert: {
          user_id?: string | null
          appid?: number | null
          status?: string | null
          status_source?: string | null
          rating?: number | null
          started_at?: string | null
          completed_at?: string | null
          review?: string | null
          backlog_position?: number | null
          goal?: string | null
          created_at?: string | null
          updated_at?: string | null
          playtime_forever?: number | null
          playtime_2weeks?: number | null
          rtime_last_played?: string | null
          achievements_total?: number | null
          achievements_unlocked?: number | null
          last_unlock_at?: string | null
          name?: string | null
          header_image?: string | null
          steamspy_userscore?: number | null
          status_changed_at?: string | null
          suggestion?: string | null
          suggestion_dismissed_at?: string | null
          genres?: Json | null
          release_date?: string | null
          steamspy_median_forever?: number | null
          hltb_main?: number | null
          hltb_main_extra?: number | null
          hltb_completionist?: number | null
          favorite?: boolean | null
          endless?: boolean | null
          owned?: boolean | null
          metacritic_score?: number | null
          is_free?: boolean | null
          coming_soon?: boolean | null
          price_initial?: number | null
          price_final?: number | null
          discount_percent?: number | null
          itad_id?: string | null
          steam_low?: number | null
          steam_low_at?: string | null
          all_low?: number | null
          all_low_shop?: string | null
          all_low_at?: string | null
        }
        Update: {
          user_id?: string | null
          appid?: number | null
          status?: string | null
          status_source?: string | null
          rating?: number | null
          started_at?: string | null
          completed_at?: string | null
          review?: string | null
          backlog_position?: number | null
          goal?: string | null
          created_at?: string | null
          updated_at?: string | null
          playtime_forever?: number | null
          playtime_2weeks?: number | null
          rtime_last_played?: string | null
          achievements_total?: number | null
          achievements_unlocked?: number | null
          last_unlock_at?: string | null
          name?: string | null
          header_image?: string | null
          steamspy_userscore?: number | null
          status_changed_at?: string | null
          suggestion?: string | null
          suggestion_dismissed_at?: string | null
          genres?: Json | null
          release_date?: string | null
          steamspy_median_forever?: number | null
          hltb_main?: number | null
          hltb_main_extra?: number | null
          hltb_completionist?: number | null
          favorite?: boolean | null
          endless?: boolean | null
          owned?: boolean | null
          metacritic_score?: number | null
          is_free?: boolean | null
          coming_soon?: boolean | null
          price_initial?: number | null
          price_final?: number | null
          discount_percent?: number | null
          itad_id?: string | null
          steam_low?: number | null
          steam_low_at?: string | null
          all_low?: number | null
          all_low_shop?: string | null
          all_low_at?: string | null
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
          fecha_date: string | null
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
          fecha_date?: string | null
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
          fecha_date?: string | null
        }
        Relationships: []
      }
      hubgames_monthly_goals: {
        Row: {
          user_id: string
          month: string
          kind: string
          target: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          month: string
          kind: string
          target: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          month?: string
          kind?: string
          target?: number
          created_at?: string
          updated_at?: string
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
      hubgames_playtime_daily: {
        Row: {
          user_id: string | null
          appid: number | null
          date: string | null
          minutes: number | null
        }
        Insert: {
          user_id?: string | null
          appid?: number | null
          date?: string | null
          minutes?: number | null
        }
        Update: {
          user_id?: string | null
          appid?: number | null
          date?: string | null
          minutes?: number | null
        }
        Relationships: []
      }
      hubgames_playtime_minutes: {
        Row: {
          user_id: string
          appid: number
          date: string
          minutes: number
        }
        Insert: {
          user_id: string
          appid: number
          date: string
          minutes: number
        }
        Update: {
          user_id?: string
          appid?: number
          date?: string
          minutes?: number
        }
        Relationships: []
      }
      hubgames_playtime_snapshots: {
        Row: {
          user_id: string
          appid: number
          date: string
          playtime_forever: number
          taken_at: string
        }
        Insert: {
          user_id: string
          appid: number
          date: string
          playtime_forever: number
          taken_at?: string
        }
        Update: {
          user_id?: string
          appid?: number
          date?: string
          playtime_forever?: number
          taken_at?: string
        }
        Relationships: []
      }
      hubgames_price_alerts: {
        Row: {
          user_id: string
          appid: number
          mode: string
          target_price: number | null
          target_discount: number | null
          last_notified_price: number | null
          last_notified_at: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          appid: number
          mode?: string
          target_price?: number | null
          target_discount?: number | null
          last_notified_price?: number | null
          last_notified_at?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          appid?: number
          mode?: string
          target_price?: number | null
          target_discount?: number | null
          last_notified_price?: number | null
          last_notified_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hubgames_price_snapshots: {
        Row: {
          appid: number
          date: string
          price_initial: number
          price_final: number
          discount_percent: number
        }
        Insert: {
          appid: number
          date: string
          price_initial: number
          price_final: number
          discount_percent: number
        }
        Update: {
          appid?: number
          date?: string
          price_initial?: number
          price_final?: number
          discount_percent?: number
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
      hubgames_steam_achievement_apps: {
        Row: {
          appid: number
          total: number
          schema_synced_at: string
          percents_synced_at: string | null
        }
        Insert: {
          appid?: number
          total?: number
          schema_synced_at?: string
          percents_synced_at?: string | null
        }
        Update: {
          appid?: number
          total?: number
          schema_synced_at?: string
          percents_synced_at?: string | null
        }
        Relationships: []
      }
      hubgames_steam_achievement_schema: {
        Row: {
          appid: number
          apiname: string
          display_name: string | null
          description: string | null
          icon: string | null
          icongray: string | null
          hidden: boolean
          global_percent: number | null
          updated_at: string
        }
        Insert: {
          appid: number
          apiname: string
          display_name?: string | null
          description?: string | null
          icon?: string | null
          icongray?: string | null
          hidden?: boolean
          global_percent?: number | null
          updated_at?: string
        }
        Update: {
          appid?: number
          apiname?: string
          display_name?: string | null
          description?: string | null
          icon?: string | null
          icongray?: string | null
          hidden?: boolean
          global_percent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      hubgames_sync_logs: {
        Row: {
          id: number
          user_id: string
          source: string
          status: string
          started_at: string
          finished_at: string | null
          stats: Json | null
          error: string | null
        }
        Insert: {
          id?: number
          user_id: string
          source: string
          status?: string
          started_at?: string
          finished_at?: string | null
          stats?: Json | null
          error?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          source?: string
          status?: string
          started_at?: string
          finished_at?: string | null
          stats?: Json | null
          error?: string | null
        }
        Relationships: []
      }
      hubgames_user_achievements: {
        Row: {
          user_id: string
          appid: number
          apiname: string
          achieved: boolean
          unlocktime: string | null
        }
        Insert: {
          user_id: string
          appid: number
          apiname: string
          achieved?: boolean
          unlocktime?: string | null
        }
        Update: {
          user_id?: string
          appid?: number
          apiname?: string
          achieved?: boolean
          unlocktime?: string | null
        }
        Relationships: []
      }
      hubgames_user_games: {
        Row: {
          user_id: string
          appid: number
          status: string
          status_source: string
          rating: number | null
          started_at: string | null
          completed_at: string | null
          review: string | null
          backlog_position: number | null
          goal: string
          created_at: string
          updated_at: string
          status_changed_at: string
          suggestion: string | null
          suggestion_dismissed_at: string | null
          favorite: boolean
          endless: boolean
        }
        Insert: {
          user_id: string
          appid: number
          status?: string
          status_source?: string
          rating?: number | null
          started_at?: string | null
          completed_at?: string | null
          review?: string | null
          backlog_position?: number | null
          goal?: string
          created_at?: string
          updated_at?: string
          status_changed_at?: string
          suggestion?: string | null
          suggestion_dismissed_at?: string | null
          favorite?: boolean
          endless?: boolean
        }
        Update: {
          user_id?: string
          appid?: number
          status?: string
          status_source?: string
          rating?: number | null
          started_at?: string | null
          completed_at?: string | null
          review?: string | null
          backlog_position?: number | null
          goal?: string
          created_at?: string
          updated_at?: string
          status_changed_at?: string
          suggestion?: string | null
          suggestion_dismissed_at?: string | null
          favorite?: boolean
          endless?: boolean
        }
        Relationships: []
      }
      hubgames_user_steam: {
        Row: {
          user_id: string
          steamid: string
          persona_name: string | null
          avatar: string | null
          visibility: string
          linked_at: string
          last_sync_at: string | null
        }
        Insert: {
          user_id: string
          steamid: string
          persona_name?: string | null
          avatar?: string | null
          visibility?: string
          linked_at?: string
          last_sync_at?: string | null
        }
        Update: {
          user_id?: string
          steamid?: string
          persona_name?: string | null
          avatar?: string | null
          visibility?: string
          linked_at?: string
          last_sync_at?: string | null
        }
        Relationships: []
      }
      hubgames_user_steam_games: {
        Row: {
          user_id: string
          appid: number
          playtime_forever: number
          playtime_2weeks: number
          rtime_last_played: string | null
          first_seen_at: string
          updated_at: string
          achievements_total: number | null
          achievements_unlocked: number | null
          achievements_synced_at: string | null
        }
        Insert: {
          user_id: string
          appid: number
          playtime_forever?: number
          playtime_2weeks?: number
          rtime_last_played?: string | null
          first_seen_at?: string
          updated_at?: string
          achievements_total?: number | null
          achievements_unlocked?: number | null
          achievements_synced_at?: string | null
        }
        Update: {
          user_id?: string
          appid?: number
          playtime_forever?: number
          playtime_2weeks?: number
          rtime_last_played?: string | null
          first_seen_at?: string
          updated_at?: string
          achievements_total?: number | null
          achievements_unlocked?: number | null
          achievements_synced_at?: string | null
        }
        Relationships: []
      }
      hubgames_user_wishlist: {
        Row: {
          user_id: string
          appid: number
          source: string
          priority: number
          date_added: string
        }
        Insert: {
          user_id: string
          appid: number
          source?: string
          priority?: number
          date_added?: string
        }
        Update: {
          user_id?: string
          appid?: number
          source?: string
          priority?: number
          date_added?: string
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
          playing_limit: number
          library_home: Json | null
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
          playing_limit?: number
          library_home?: Json | null
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
          playing_limit?: number
          library_home?: Json | null
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
      hubgames_wishlist: {
        Row: {
          user_id: string | null
          appid: number | null
          source: string | null
          priority: number | null
          date_added: string | null
          name: string | null
          header_image: string | null
          release_date: string | null
          release_date_text: string | null
          coming_soon: boolean | null
          is_free: boolean | null
          genres: Json | null
          steamspy_userscore: number | null
          currency: string | null
          price_initial: number | null
          price_final: number | null
          discount_percent: number | null
          price_synced_at: string | null
          itad_id: string | null
          steam_low: number | null
          steam_low_at: string | null
          all_low: number | null
          all_low_shop: string | null
          all_low_at: string | null
          metacritic_score: number | null
          steamspy_median_forever: number | null
          hltb_main: number | null
          hltb_main_extra: number | null
          hltb_completionist: number | null
        }
        Insert: {
          user_id?: string | null
          appid?: number | null
          source?: string | null
          priority?: number | null
          date_added?: string | null
          name?: string | null
          header_image?: string | null
          release_date?: string | null
          release_date_text?: string | null
          coming_soon?: boolean | null
          is_free?: boolean | null
          genres?: Json | null
          steamspy_userscore?: number | null
          currency?: string | null
          price_initial?: number | null
          price_final?: number | null
          discount_percent?: number | null
          price_synced_at?: string | null
          itad_id?: string | null
          steam_low?: number | null
          steam_low_at?: string | null
          all_low?: number | null
          all_low_shop?: string | null
          all_low_at?: string | null
          metacritic_score?: number | null
          steamspy_median_forever?: number | null
          hltb_main?: number | null
          hltb_main_extra?: number | null
          hltb_completionist?: number | null
        }
        Update: {
          user_id?: string | null
          appid?: number | null
          source?: string | null
          priority?: number | null
          date_added?: string | null
          name?: string | null
          header_image?: string | null
          release_date?: string | null
          release_date_text?: string | null
          coming_soon?: boolean | null
          is_free?: boolean | null
          genres?: Json | null
          steamspy_userscore?: number | null
          currency?: string | null
          price_initial?: number | null
          price_final?: number | null
          discount_percent?: number | null
          price_synced_at?: string | null
          itad_id?: string | null
          steam_low?: number | null
          steam_low_at?: string | null
          all_low?: number | null
          all_low_shop?: string | null
          all_low_at?: string | null
          metacritic_score?: number | null
          steamspy_median_forever?: number | null
          hltb_main?: number | null
          hltb_main_extra?: number | null
          hltb_completionist?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hubgames_username_available: {
        Args: { p_username: string }
        Returns: boolean
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
          /** Con 20261029180000_hubgames_judi_ranking_dia (sin aplicar aún, puede faltar). */
          id_lista_judi?: number
          dia?: string | null
        }[]
      }
      hubgames_judi_list: {
        Args: never
        Returns: {
          completado: boolean
          fase1: boolean
          fase2: boolean
          fase3: boolean
          fase4: boolean
          fase5: boolean
          fase6: boolean
          fecha: string
          header_image: string | null
          id: number
          nombre: string | null
          /** Migración hubgames_judi_list_intentos (texto = fallo, null = salto). Sin ella, no llega. */
          attempts?: Json
        }[]
      }
      hubgames_judi_today: {
        Args: never
        Returns: {
          completado: boolean
          fase1: boolean
          fase2: boolean
          fase3: boolean
          fase4: boolean
          fase5: boolean
          fase6: boolean
          fecha: string
          header_image: string | null
          id: number
          nombre: string | null
        }[]
      }
      hubgames_judi_get_day: {
        Args: { p_id: number; p_phase?: number }
        Returns: Json
      }
      hubgames_judi_guess: {
        Args: { p_guess: string; p_id: number }
        Returns: Json
      }
      hubgames_judi_guess_anon: {
        Args: { p_guess: string; p_id: number; p_phase: number }
        Returns: Json
      }
      hubgames_judi_capture_url: {
        Args: { p_id: number; p_phase: number }
        Returns: string | null
      }
      hubgames_judi_search_pool: {
        Args: { p_query: string }
        Returns: { game_name: string; steam_appid: number }[]
      }
      hubgames_judi_pick_daily: {
        Args: { p_fecha: string }
        Returns: Json
      }
      hubgames_reorder_backlog: {
        Args: { p_appids: number[] }
        Returns: undefined
      }
      hubgames_split_playtime: {
        Args: { p_from: string; p_last_played: string; p_minutes: number; p_to: string }
        Returns: {
          day: string
          minutes: number
        }[]
      }
      hubgames_take_playtime_snapshot: {
        Args: { p_user_id: string }
        Returns: number
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
