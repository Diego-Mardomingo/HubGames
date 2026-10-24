import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchSteamProfile, siteUrl, STEAM_NONCE_COOKIE, verifySteamOpenId } from '@/lib/steam'

function back(status: string) {
    const res = NextResponse.redirect(`${siteUrl()}/perfil?steam=${status}`)
    res.cookies.delete({ name: STEAM_NONCE_COOKIE, path: '/api/steam' })
    return res
}

export async function GET(request: NextRequest) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${siteUrl()}/login`)

    const nonce = request.cookies.get(STEAM_NONCE_COOKIE)?.value
    if (!nonce || request.nextUrl.searchParams.get('nonce') !== nonce) return back('error')

    try {
        const steamid = await verifySteamOpenId(request.nextUrl.searchParams, nonce)
        if (!steamid) return back('error')

        const profile = await fetchSteamProfile(steamid)
        const { error } = await createAdminClient()
            .from('hubgames_user_steam')
            .upsert({ user_id: user.id, steamid, ...profile, linked_at: new Date().toISOString(), last_sync_at: null })
        if (error) {
            // 23505: ese SteamID ya está vinculado a otra cuenta.
            console.error('steam/callback: upsert falló', error.message)
            return back(error.code === '23505' ? 'en_uso' : 'error')
        }
        return back(profile.visibility === 'publico' ? 'ok' : profile.visibility)
    } catch (e) {
        console.error('steam/callback', e)
        return back('error')
    }
}
