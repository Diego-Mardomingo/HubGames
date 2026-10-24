const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'
const STEAM_API = 'https://api.steampowered.com'
const CLAIMED_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/

export const STEAM_NONCE_COOKIE = 'hubgames_steam_nonce'

export type SteamVisibility = 'publico' | 'privado' | 'detalles_privados' | 'desconocida'

export function siteUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export function buildSteamLoginUrl(nonce: string): string {
    const base = siteUrl()
    const params = new URLSearchParams({
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.mode': 'checkid_setup',
        'openid.return_to': `${base}/api/steam/callback?nonce=${nonce}`,
        'openid.realm': base,
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    })
    return `${STEAM_OPENID_URL}?${params}`
}

/** Valida la respuesta de Steam en el servidor y devuelve el SteamID64, o null si no es auténtica. */
export async function verifySteamOpenId(query: URLSearchParams, expectedNonce: string): Promise<string | null> {
    if (query.get('openid.mode') !== 'id_res') return null
    if (query.get('openid.op_endpoint') !== STEAM_OPENID_URL) return null
    if (query.get('openid.return_to') !== `${siteUrl()}/api/steam/callback?nonce=${expectedNonce}`) return null

    const steamid = CLAIMED_ID_RE.exec(query.get('openid.claimed_id') ?? '')?.[1]
    if (!steamid) return null

    const body = new URLSearchParams()
    query.forEach((value, key) => {
        if (key.startsWith('openid.')) body.set(key, value)
    })
    body.set('openid.mode', 'check_authentication')

    const res = await fetch(STEAM_OPENID_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    })
    if (!res.ok) return null
    const text = await res.text()
    return /^is_valid\s*:\s*true\s*$/m.test(text) ? steamid : null
}

export interface SteamProfile {
    persona_name: string | null
    avatar: string | null
    visibility: SteamVisibility
}

/** Nombre, avatar y visibilidad. Si GetOwnedGames viene vacío con perfil público, los detalles de juego son privados. */
export async function fetchSteamProfile(steamid: string): Promise<SteamProfile> {
    const key = process.env.STEAM_WEB_API_KEY
    if (!key) throw new Error('Falta STEAM_WEB_API_KEY')

    const summaryRes = await fetch(
        `${STEAM_API}/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamid}`,
        { cache: 'no-store' },
    )
    if (!summaryRes.ok) throw new Error(`GetPlayerSummaries: ${summaryRes.status}`)
    const player = (await summaryRes.json())?.response?.players?.[0]
    if (!player) return { persona_name: null, avatar: null, visibility: 'desconocida' }

    let visibility: SteamVisibility = 'privado'
    if (player.communityvisibilitystate === 3) {
        const gamesRes = await fetch(
            `${STEAM_API}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamid}&include_appinfo=0`,
            { cache: 'no-store' },
        )
        const gamesCount = gamesRes.ok ? (await gamesRes.json())?.response?.game_count : undefined
        visibility = gamesCount ? 'publico' : 'detalles_privados'
    }
    return {
        persona_name: player.personaname ?? null,
        avatar: player.avatarfull ?? player.avatar ?? null,
        visibility,
    }
}
