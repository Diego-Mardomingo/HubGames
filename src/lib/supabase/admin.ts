import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/** Cliente con service_role: solo para route handlers del servidor. Nunca importarlo desde el cliente. */
export function createAdminClient() {
    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
    )
}
