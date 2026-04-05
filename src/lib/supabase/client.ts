import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function isRefreshTokenAuthJson(body: unknown): boolean {
    if (!body || typeof body !== 'object') return false
    const o = body as Record<string, unknown>
    const desc = String(o.error_description ?? '')
    const err = String(o.error ?? '')
    return (
        err === 'invalid_grant' ||
        desc.includes('Invalid Refresh Token') ||
        desc.includes('Refresh Token Not Found')
    )
}

/**
 * El refresco automático del SDK llama a /auth/v1/token sin pasar por safeGetSession.
 * Si el refresh token caducó o borróse en servidor, la API devuelve 400: limpiamos sesión local.
 */
function createFetchWithAuthRecovery(getClient: () => SupabaseClient | undefined): typeof fetch {
    return async (input, init) => {
        const res = await fetch(input, init)
        const url =
            typeof input === 'string' ? input : input instanceof Request ? input.url : ''
        if (!res.ok && url.includes('/auth/v1/')) {
            try {
                const body = await res.clone().json()
                if (isRefreshTokenAuthJson(body)) {
                    queueMicrotask(() => {
                        void getClient()?.auth.signOut({ scope: 'local' })
                    })
                }
            } catch {
                /* cuerpo no JSON */
            }
        }
        return res
    }
}

let supabaseRef: SupabaseClient | undefined

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Evita reutilizar tokens viejos de otras versiones del cliente.
        storageKey: 'hubgames-auth-v2',
    },
    global: {
        fetch: createFetchWithAuthRecovery(() => supabaseRef),
    },
})

supabaseRef = supabase

function isRefreshTokenError(error: unknown): boolean {
    if (error && typeof error === 'object') {
        const o = error as { message?: string; code?: string; status?: number }
        if (o.code === 'refresh_token_not_found') return true
        const message = String(o.message ?? '')
        if (message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found')) {
            return true
        }
    }
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
