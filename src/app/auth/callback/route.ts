import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const supabase = await createServerClient()
        await supabase.auth.exchangeCodeForSession(code)

        // Get user data
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
            // Check if user exists in hubgames_usuarios
            const { data: existingUser } = await supabase
                .from('hubgames_usuarios')
                .select('*')
                .eq('id', user.id)
                .single()

            // If user doesn't exist (Google OAuth first time), create them
            if (!existingUser) {
                await supabase.from('hubgames_usuarios').insert({
                    id: user.id,
                    username: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
                    email: user.email!,
                    password_hash: null,
                    email_verificado: true,
                    fecha_creacion: new Date().toISOString(),
                    cuenta_google: true,
                    administrador: false,
                })
            }
        }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL('/', requestUrl.origin))
}
