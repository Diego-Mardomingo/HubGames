import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { parseAppid } from '@/lib/catalog'
import { mergeSteamAchievements, type SteamPercentsResponse, type SteamSchemaResponse } from '@/lib/steam-achievements'

const STEAM_API = 'https://api.steampowered.com'
/** Seis horas: los logros y su rareza cambian poco, y así no se gasta el límite diario de la Web API. */
const REVALIDATE = 6 * 3600

/**
 * Logros de un juego pedidos a Steam en el momento (#104), para verlos sin tenerlo. No se guardan: la caché de Next
 * (y la de Vercel, con Cache-Control) caduca sola. Solo juegos del catálogo, para no ser un proxy de cualquier appid.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ appid: string }> }) {
    const appid = parseAppid((await params).appid)
    if (!appid) return NextResponse.json({ error: 'appid no válido' }, { status: 400 })

    const key = process.env.STEAM_WEB_API_KEY
    if (!key) return NextResponse.json({ error: 'Falta STEAM_WEB_API_KEY' }, { status: 500 })

    const supabase = await createServerClient()
    const { data: game } = await supabase.from('hubgames_juegos_steam').select('steam_appid').eq('steam_appid', appid).maybeSingle()
    if (!game) return NextResponse.json({ error: 'Juego no encontrado' }, { status: 404 })

    const get = async <T>(path: string): Promise<T | null> => {
        const res = await fetch(`${STEAM_API}${path}&key=${key}`, {
            next: { revalidate: REVALIDATE },
        })
        // 400/403: juego sin logros o con estadísticas privadas. Se trata como «sin logros».
        if (res.status === 400 || res.status === 403) return null
        if (!res.ok) throw new Error(`${path.split('?')[0]}: ${res.status}`)
        return (await res.json().catch(() => null)) as T | null
    }

    try {
        const [schema, percents] = await Promise.all([
            get<SteamSchemaResponse>(`/ISteamUserStats/GetSchemaForGame/v2/?appid=${appid}&l=spanish`),
            get<SteamPercentsResponse>(`/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appid}`),
        ])
        return NextResponse.json(
            { achievements: mergeSteamAchievements(appid, schema, percents) },
            {
                headers: {
                    'Cache-Control': `public, s-maxage=${REVALIDATE}, stale-while-revalidate=86400`,
                },
            },
        )
    } catch (e) {
        console.error('juego/logros', appid, e)
        return NextResponse.json({ error: 'Steam no responde' }, { status: 502 })
    }
}
