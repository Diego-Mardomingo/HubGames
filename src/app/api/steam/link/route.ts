import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createServerClient } from '@/lib/supabase/server'
import { buildSteamLoginUrl, STEAM_NONCE_COOKIE } from '@/lib/steam'

export async function GET(request: NextRequest) {
    const origin = request.nextUrl.origin
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${origin}/login`)

    // El nonce va en una cookie y en return_to: evita que alguien vincule su Steam a la sesión de otra persona.
    const nonce = randomBytes(16).toString('hex')
    const res = NextResponse.redirect(buildSteamLoginUrl(nonce, origin))
    res.cookies.set(STEAM_NONCE_COOKIE, nonce, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600,
        path: '/api/steam',
    })
    return res
}
