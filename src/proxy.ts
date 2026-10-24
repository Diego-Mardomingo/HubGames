import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/supabase/database.types'
import { NextResponse, type NextRequest } from 'next/server'

/** Refresca la sesión y protege /admin en el servidor (comprobación con is_admin() de la base de datos). */
export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request })

    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
                },
            },
        },
    )

    const { data: { user } } = await supabase.auth.getUser()
    const { data: isAdmin } = user ? await supabase.rpc('is_admin') : { data: false }

    if (!user || isAdmin !== true) {
        return NextResponse.redirect(new URL('/', request.url))
    }
    return response
}

export const config = {
    matcher: ['/admin/:path*'],
}
