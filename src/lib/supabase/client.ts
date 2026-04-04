import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Evita reutilizar tokens viejos de otras versiones del cliente.
        storageKey: 'hubgames-auth-v2',
    },
})

function isRefreshTokenError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error || '')
    return message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found')
}

export async function safeGetSession() {
    try {
        const result = await supabase.auth.getSession()
        if (result.error && isRefreshTokenError(result.error)) {
            await supabase.auth.signOut({ scope: 'local' })
            return { data: { session: null }, error: null }
        }
        return result
    } catch (error) {
        if (isRefreshTokenError(error)) {
            await supabase.auth.signOut({ scope: 'local' })
            return { data: { session: null }, error: null }
        }
        throw error
    }
}

export async function safeGetUser() {
    try {
        const result = await supabase.auth.getUser()
        if (result.error && isRefreshTokenError(result.error)) {
            await supabase.auth.signOut({ scope: 'local' })
            return { data: { user: null }, error: null }
        }
        return result
    } catch (error) {
        if (isRefreshTokenError(error)) {
            await supabase.auth.signOut({ scope: 'local' })
            return { data: { user: null }, error: null }
        }
        throw error
    }
}
