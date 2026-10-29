'use client'

import { Gamepad2, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/EmptyState'
import SyncButton from '@/components/dashboard/SyncButton'
import { openGameSearch } from '@/components/tracker/GameSearch'

/**
 * Vacío de las páginas que dependen de Steam (biblioteca, logros, historial, wishlist, estadísticas). Sin cuenta
 * vinculada, «Conectar con Steam» lleva directo a `/api/steam/link` (no al perfil); con ella (o si no se sabe), aún no se
 * ha leído nada y la acción es «Sincronizar». `search`: «Buscar un juego» como segunda acción (biblioteca, wishlist).
 */
export default function SteamEmpty({
    linked,
    what = 'tus juegos, horas y logros',
    search = false,
    onSynced,
}: {
    linked: boolean | null
    /** Lo que se leerá de Steam, para la frase («tus logros», «tu wishlist»…). */
    what?: string
    search?: boolean
    onSynced?: () => void
}) {
    const searchButton = search && (
        <Button variant="secondary" onClick={openGameSearch}>
            <Search aria-hidden /> Buscar un juego
        </Button>
    )
    if (linked === false) {
        return (
            <EmptyState
                size="page"
                tone="st-todos"
                icon={<Gamepad2 />}
                title="Conecta tu cuenta de Steam"
                action={
                    <>
                        <Button asChild>
                            <a href="/api/steam/link">
                                <Gamepad2 aria-hidden /> Conectar con Steam
                            </a>
                        </Button>
                        {searchButton}
                    </>
                }
            >
                HubGames lee {what} de Steam. Solo lectura: no publica nada en tu nombre.
            </EmptyState>
        )
    }
    return (
        <EmptyState
            size="page"
            tone="st-todos"
            icon={<RefreshCw />}
            title="Aún no hay nada de Steam"
            action={
                <>
                    <SyncButton label="Sincronizar con Steam" onSynced={onSynced} />
                    {searchButton}
                </>
            }
        >
            Tu cuenta está vinculada, pero todavía no se han leído {what}. Se sincroniza sola cada día.
        </EmptyState>
    )
}
