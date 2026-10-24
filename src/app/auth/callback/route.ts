import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (!code) {
        return NextResponse.redirect(new URL('/login?error=oauth', requestUrl.origin))
    }

    const supabase = await createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
        console.error('auth/callback: exchangeCodeForSession falló', error.message)
        return NextResponse.redirect(new URL('/login?error=oauth', requestUrl.origin))
    }

    // El perfil en hubgames_usuarios lo crea el trigger sobre auth.users.
    return NextResponse.redirect(new URL('/', requestUrl.origin))
}
