// ¿Tiene el usuario su cuenta de Steam vinculada? Una fila de hubgames_user_steam (RLS: cada uno ve la suya).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/database.types'

/**
 * true si hay fila, false si no; null si no se pudo leer. Lo usan los vacíos de las páginas que dependen de Steam
 * (biblioteca, logros, historial, wishlist, estadísticas) para elegir entre «Conectar con Steam» y «Sincronizar».
 * Vale con el cliente del navegador y con el del servidor.
 */
export async function loadSteamLinked(supabase: SupabaseClient<Database>): Promise<boolean | null> {
    const { data, error } = await supabase.from('hubgames_user_steam').select('user_id').maybeSingle()
    if (error) return null
    return data !== null
}
