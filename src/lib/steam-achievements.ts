// Logros de un juego que no tienes (#104): esquema y % global pedidos a Steam en el momento, sin guardarlos.
// La ruta /api/juego/[appid]/logros llama a Steam (la clave no puede ir al navegador); aquí, el cruce (puro, con tests
// en steam-achievements.test.ts) y la llamada del cliente a esa ruta.
import type { Achievement } from './achievements'
import { achievementIconUrl } from './steam-icon'

export interface SteamSchemaAchievement {
    name: string
    displayName?: string
    description?: string
    icon?: string
    icongray?: string
    hidden?: number
}

export interface SteamSchemaResponse {
    game?: { availableGameStats?: { achievements?: SteamSchemaAchievement[] } }
}

export interface SteamPercentsResponse {
    achievementpercentages?: {
        achievements?: { name: string; percent: string | number }[]
    }
}

/** Logros del esquema con su % global, todos bloqueados (en modo consulta no hay progreso). */
export function mergeSteamAchievements(appid: number, schema: SteamSchemaResponse | null, percents: SteamPercentsResponse | null): Achievement[] {
    const pct = new Map<string, number>()
    for (const p of percents?.achievementpercentages?.achievements ?? []) {
        const n = Number(p.percent)
        if (Number.isFinite(n)) pct.set(p.name, n)
    }
    return (schema?.game?.availableGameStats?.achievements ?? []).map((a) => ({
        appid,
        apiname: a.name,
        achieved: false,
        unlocktime: null,
        display_name: a.displayName ?? null,
        description: a.description ?? null,
        icon: achievementIconUrl(a.icon),
        icongray: achievementIconUrl(a.icongray),
        hidden: a.hidden === 1,
        global_percent: pct.get(a.name) ?? null,
    }))
}

/** El % del logro más raro, o null si ninguno tiene dato. */
export function rarestPercent(list: Pick<Achievement, 'global_percent'>[]): number | null {
    let min: number | null = null
    for (const a of list) if (a.global_percent !== null && (min === null || a.global_percent < min)) min = a.global_percent
    return min
}

/** Cliente: los logros de Steam de un juego (modo consulta). Lanza si Steam o la ruta fallan. */
export async function fetchSteamAchievements(appid: number): Promise<Achievement[]> {
    const res = await fetch(`/api/juego/${appid}/logros`)
    const body = (await res.json().catch(() => null)) as {
        achievements?: Achievement[]
        error?: string
    } | null
    if (!res.ok) throw new Error(body?.error ?? 'Steam no responde')
    return body?.achievements ?? []
}
