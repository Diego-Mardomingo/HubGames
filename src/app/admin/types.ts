import type { Tables } from '@/lib/supabase/database.types'

export type GenRow = Tables<'hubgames_judi_generacion_logs'>
export type SyncRow = Tables<'hubgames_sync_logs'>
export type DailyRow = Pick<Tables<'hubgames_lista_videojuegos_judi'>, 'id' | 'steam_appid' | 'nombre' | 'fecha' | 'calificacion'>

/** Un conjunto de datos de la página: filas (o `null` mientras carga la primera vez), error y si está recargando. */
export type Loadable<T> = { rows: T[] | null; error: string | null; busy: boolean }

export type AdminTab = 'logs' | 'steam' | 'pool' | 'cal'
