import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
    borrowedApps,
    FAMILY_QR_COOKIE,
    fetchFamilyLibrary,
    openSession,
    pollQrSession,
    revokeRefreshToken,
    sealSession,
    SteamFamilyError,
    tokenSteamId,
} from '@/lib/steam-family'
import { syncFamilyLibrary } from '@/lib/steam-sync'

export const dynamic = 'force-dynamic'
// Vercel Hobby corta a los 60 s: las fichas que no dé tiempo a traer las completa la sincronización diaria.
export const maxDuration = 60
const BUDGET_MS = 35_000

const COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/steam/family' }

const MESSAGES: Record<SteamFamilyError['code'], { status: number; text: string }> = {
    denied: { status: 409, text: 'Lo has rechazado en el móvil. No se ha cambiado nada.' },
    expired: { status: 410, text: 'El código ha caducado.' },
    no_family: { status: 404, text: 'No estás en ningún grupo familiar de Steam.' },
    wrong_account: { status: 409, text: 'Has aprobado con otra cuenta de Steam distinta de la vinculada. No se ha cambiado nada.' },
    steam: { status: 502, text: 'Steam no ha respondido. No se ha cambiado nada.' },
}

/** Nombres de Steam de quienes prestan (con la clave de la Web API, sin el permiso del usuario). */
async function personaNames(steamids: string[]): Promise<Record<string, string>> {
    const key = process.env.STEAM_WEB_API_KEY
    if (!key || steamids.length === 0) return {}
    const res = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamids.slice(0, 100).join(',')}`, {
        cache: 'no-store',
    }).catch(() => null)
    if (!res?.ok) return {}
    const players = ((await res.json())?.response?.players ?? []) as { steamid: string; personaname?: string }[]
    return Object.fromEntries(players.flatMap((p) => (p.personaname ? [[p.steamid, p.personaname]] : [])))
}

/**
 * Pregunta a Steam si ya se aprobó el QR. Si sí: comprueba que es tu cuenta, trae la lista del grupo, anula la sesión
 * en Steam y guarda solo la lista. Los permisos viven en esta función y no se guardan ni se escriben en ningún sitio.
 */
export async function POST(request: NextRequest) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const session = openSession(request.cookies.get(FAMILY_QR_COOKIE)?.value, user.id)
    if (!session) return NextResponse.json({ state: 'error', code: 'expired', error: MESSAGES.expired.text }, { status: 410 })

    const fail = (e: unknown) => {
        const code = e instanceof SteamFamilyError ? e.code : 'steam'
        if (!(e instanceof SteamFamilyError)) console.error('steam/family', e instanceof Error ? e.message : 'error')
        const res = NextResponse.json({ state: 'error', code, error: MESSAGES[code].text }, { status: MESSAGES[code].status })
        res.cookies.set(FAMILY_QR_COOKIE, '', { ...COOKIE, maxAge: 0 })
        return res
    }

    let poll
    try {
        poll = await pollQrSession(session)
    } catch (e) {
        return fail(e)
    }
    if (poll.state !== 'approved') {
        const res = NextResponse.json({ state: poll.state, challengeUrl: poll.challengeUrl ?? null })
        res.cookies.set(FAMILY_QR_COOKIE, sealSession(poll.session), { ...COOKIE, maxAge: Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000)) })
        return res
    }

    const admin = createAdminClient()
    let accessToken: string | null = poll.accessToken
    let refreshToken: string | null = poll.refreshToken
    let sessionClosed = false
    try {
        const { data: link } = await admin.from('hubgames_user_steam').select('steamid').eq('user_id', user.id).maybeSingle()
        const steamid = tokenSteamId(accessToken)
        if (!link || steamid !== link.steamid) throw new SteamFamilyError('Cuenta distinta', 'wrong_account')

        const family = await fetchFamilyLibrary(accessToken, steamid)
        // Lo antes posible: la sesión se cierra en Steam en cuanto tenemos la lista.
        sessionClosed = await revokeRefreshToken(refreshToken, accessToken).catch(() => false)
        accessToken = refreshToken = null

        const borrowed = borrowedApps(family.apps, steamid)
        const owners = [...new Set([...family.memberSteamIds, ...borrowed.flatMap((a) => a.owner_steamids ?? [])])].filter((id) => id !== steamid)
        const result = await syncFamilyLibrary(
            admin,
            user.id,
            borrowed.map((a) => ({ appid: a.appid, owners: a.owner_steamids ?? [], playtimeMinutes: a.rt_playtime ?? 0, lastPlayed: a.rt_last_played ?? null })),
            await personaNames(owners),
            { deadline: Date.now() + BUDGET_MS },
        )
        const res = NextResponse.json({ state: 'done', sessionClosed, ...result })
        res.cookies.set(FAMILY_QR_COOKIE, '', { ...COOKIE, maxAge: 0 })
        return res
    } catch (e) {
        return fail(e)
    } finally {
        if (refreshToken) await revokeRefreshToken(refreshToken, accessToken ?? undefined).catch(() => false)
    }
}
