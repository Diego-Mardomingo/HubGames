// Ficha /juego (#22): lee el juego del catálogo y, si aún no está, lo trae de la tienda de Steam y lo guarda.
// Solo servidor: usa el cliente con service_role para guardar. Nunca importarlo desde el cliente.
import { cache } from 'react'
import { createServerClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'
import { fetchStoreCatalogRow } from './steam-sync'
import type { Json } from './supabase/database.types'

const COLUMNS =
    'steam_appid, name, type, short_description, about_the_game, developers, publishers, website, header_image, ' +
    'background_raw, release_date, release_date_text, coming_soon, metacritic_score, metacritic_url, genres, ' +
    'screenshots, movies, is_free, steamspy_userscore, steamspy_median_forever, achievements_total'

export interface CatalogGame {
    steam_appid: number
    name: string
    type: string | null
    short_description: string | null
    about_the_game: string | null
    developers: string[] | null
    publishers: string[] | null
    website: string | null
    header_image: string | null
    background_raw: string | null
    release_date: string | null
    release_date_text: string | null
    coming_soon: boolean | null
    metacritic_score: number | null
    metacritic_url: string | null
    genres: Json | null
    screenshots: Json | null
    movies: Json | null
    is_free: boolean | null
    steamspy_userscore: number | null
    steamspy_median_forever: number | null
    achievements_total: number | null
}

/** appid válido de Steam (entero positivo de 32 bits), o null. */
export function parseAppid(raw: string): number | null {
    if (!/^\d{1,10}$/.test(raw)) return null
    const n = Number(raw)
    return n > 0 && n <= 2_147_483_647 ? n : null
}

/**
 * Juego del catálogo. Si no está y hay sesión, se pide a la tienda de Steam y se guarda para la próxima vez
 * (sin sesión no: así nadie puede llenar el catálogo recorriendo appids). `cache`: metadata y página comparten consulta.
 */
export const getCatalogGame = cache(async (appid: number): Promise<CatalogGame | null> => {
    const supabase = await createServerClient()
    const { data } = await supabase.from('hubgames_juegos_steam').select(COLUMNS).eq('steam_appid', appid).maybeSingle()
    if (data) return data as unknown as CatalogGame

    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const row = await fetchStoreCatalogRow(appid, false).catch((e) => {
        console.error('catalog: Steam', appid, e)
        return null
    })
    if (!row) return null
    const { data: saved, error } = await createAdminClient()
        .from('hubgames_juegos_steam')
        .upsert(row, { onConflict: 'steam_appid' })
        .select(COLUMNS)
        .single()
    if (error) {
        console.error('catalog: guardar', appid, error.message)
        return null
    }
    return saved as unknown as CatalogGame
})
