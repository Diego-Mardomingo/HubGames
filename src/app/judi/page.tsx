import JudiClient from '@/app/judi/JudiClient'
import JudiMaintenance from '@/app/judi/JudiMaintenance'
import { isJudiMaintenance, maintenanceUntilRaw, parseMaintenanceUntil } from '@/lib/judi-maintenance'
import { createServerClient } from '@/lib/supabase/server'

export default async function JUDIPage() {
    if (isJudiMaintenance()) {
        // Las acciones dependen de la sesión («Ver el ranking» o «Iniciar sesión»): se decide en el servidor.
        const supabase = await createServerClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()
        const now = new Date()
        return <JudiMaintenance signedIn={Boolean(user)} until={parseMaintenanceUntil(maintenanceUntilRaw())} now={now.getTime()} />
    }
    return <JudiClient />
}
