import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { beginQrSession, FAMILY_QR_COOKIE, QR_TTL_MS, sealSession, SteamFamilyError } from '@/lib/steam-family'

export const dynamic = 'force-dynamic'

const COOKIE = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/api/steam/family' }

/** «Actualizar grupo familiar» (#86): pide a Steam un QR. Lo necesario para seguir va cifrado en una cookie httpOnly. */
export async function POST() {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const { data: link } = await supabase.from('hubgames_user_steam').select('steamid').maybeSingle()
    if (!link) return NextResponse.json({ error: 'Primero vincula tu cuenta de Steam' }, { status: 409 })

    try {
        const { session, challengeUrl, interval } = await beginQrSession(user.id)
        const res = NextResponse.json({ challengeUrl, interval, expiresAt: session.expiresAt })
        res.cookies.set(FAMILY_QR_COOKIE, sealSession(session), { ...COOKIE, maxAge: Math.ceil(QR_TTL_MS / 1000) })
        return res
    } catch (e) {
        console.error('steam/family: inicio', e instanceof SteamFamilyError ? e.message : e)
        return NextResponse.json({ error: 'Steam no ha dado el código QR. Inténtalo en un rato.' }, { status: 502 })
    }
}

/** Cancelar: se olvida la sesión del QR (Steam la caduca sola). */
export async function DELETE() {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(FAMILY_QR_COOKIE, '', { ...COOKIE, maxAge: 0 })
    return res
}
