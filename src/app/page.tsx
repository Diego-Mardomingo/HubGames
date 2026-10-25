import type { Metadata } from 'next'
import Link from 'next/link'
import { Gamepad2, LogIn, Trophy } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { loadDashboard } from '@/lib/dashboard-db'
import { buildHeatmap, heatmapStart, madridDate } from '@/lib/activity-heatmap'
import { Button } from '@/components/ui/button'
import Dashboard from '@/components/dashboard/Dashboard'
import ActivityHeatmap from '@/components/dashboard/ActivityHeatmap'
import '@/components/dashboard/dashboard.css'

export const metadata: Metadata = {
    title: 'HubGames — Tu centro de control gamer',
    description: 'Tu biblioteca, tus logros y el juego del día en un solo sitio.',
}

// Depende de la sesión: nunca se genera estática.
export const dynamic = 'force-dynamic'

/** Año de ejemplo para la portada: siempre el mismo dibujo (generador con semilla fija), más jugado los fines de semana. */
function sampleHeatmap(today: string) {
    let seed = 11
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
    const start = Date.parse(`${heatmapStart(today)}T00:00:00Z`)
    const playtime = Array.from({ length: 53 * 7 }, (_, i) => {
        const weekend = i % 7 >= 5
        const minutes = rnd() < (weekend ? 0.3 : 0.5) ? 0 : Math.round(rnd() * (weekend ? 330 : 190))
        return { date: new Date(start + i * 86400_000).toISOString().slice(0, 10), minutes }
    })
    return buildHeatmap({ today, playtime, unlocks: [] })
}

function Landing() {
    return (
        <div className="dash-landing">
            <div className="dash-landing__intro">
                <h1 className="page-title">Tu biblioteca de Steam, tus logros y a qué jugar hoy</h1>
                <p className="page-subtitle">
                    Conecta Steam y HubGames ordena solo lo que tienes en curso, lo que tienes pendiente y los logros que te faltan.
                </p>
                <div className="dash-landing__actions">
                    <Button asChild>
                        <Link href="/login">
                            <LogIn aria-hidden /> Entrar
                        </Link>
                    </Button>
                    <Button variant="secondary" asChild>
                        <Link href="/judi">
                            <Gamepad2 aria-hidden /> Jugar a JUDI
                        </Link>
                    </Button>
                    <Button variant="secondary" asChild>
                        <Link href="/ranking">
                            <Trophy aria-hidden /> Ver el ranking
                        </Link>
                    </Button>
                </div>
            </div>
            <figure className="dash-landing__preview">
                <ActivityHeatmap
                    preview
                    map={sampleHeatmap(madridDate(new Date()))}
                    stats={[
                        { value: '312 h', label: 'jugadas este año' },
                        { value: '1284', label: 'logros' },
                        { value: '18', label: 'completados' },
                        { value: '4', label: 'en curso' },
                    ]}
                />
                <figcaption>Tu año de un vistazo: cada casilla es un día, más intensa cuanto más juegas.</figcaption>
            </figure>
        </div>
    )
}

/** Inicio: el dashboard (#29) con sesión; sin ella, la portada. Se pinta en el servidor. */
export default async function HomePage() {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return <Landing />

    const now = new Date()
    const data = await loadDashboard(supabase, user.id, now)
    // La semilla de "Sorpréndeme" (#30) cambia en cada visita.
    return <Dashboard data={data} now={now.getTime()} seed={now.getTime() % 1_000_000} />
}
