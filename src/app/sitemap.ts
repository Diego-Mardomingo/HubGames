import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { SITE_URL } from '@/lib/seo'

// Se regenera una vez al día: el catálogo crece con el Steam Sync, no a cada momento.
export const revalidate = 86400

const PAGE = 1000

/** Fichas de juego del catálogo (lectura pública), de 1000 en 1000. Si falla, el sitemap sale sin ellas. */
async function catalogGames(): Promise<{ steam_appid: number; updated_at: string | null }[]> {
    const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
    const rows: { steam_appid: number; updated_at: string | null }[] = []
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from('hubgames_juegos_steam')
            .select('steam_appid, updated_at')
            .eq('type', 'game')
            .order('steam_appid')
            .range(from, from + PAGE - 1)
        if (error) {
            console.error('sitemap: catálogo', error.message)
            break
        }
        rows.push(...(data ?? []))
        if (!data || data.length < PAGE) break
    }
    return rows
}

/**
 * sitemap.xml (#107): las páginas públicas y las fichas de juego. Un solo archivo hasta 50 000 URLs; si el catálogo
 * se acerca a eso, pasar a `generateSitemaps`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const games = await catalogGames()
    return [
        { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
        { url: `${SITE_URL}/judi`, changeFrequency: 'daily', priority: 0.9 },
        ...games.map((g) => ({
            url: `${SITE_URL}/juego/${g.steam_appid}`,
            ...(g.updated_at && { lastModified: g.updated_at }),
            changeFrequency: 'monthly' as const,
            priority: 0.6,
        })),
    ]
}
