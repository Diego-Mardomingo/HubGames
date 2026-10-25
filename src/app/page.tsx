import type { Metadata } from 'next'
import Link from 'next/link'
import { Gamepad2, LogIn, Trophy } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { loadDashboard } from '@/lib/dashboard-db'
import { Button } from '@/components/ui/button'
import Dashboard from '@/components/dashboard/Dashboard'
import '@/components/dashboard/dashboard.css'

export const metadata: Metadata = {
    title: 'HubGames — Tu centro de control gamer',
    description: 'Tu biblioteca, tus logros y el juego del día en un solo sitio.',
}

// Depende de la sesión: nunca se genera estática.
export const dynamic = 'force-dynamic'

function Landing() {
    return (
        <div className="dash-landing animate-fade-in-up">
            <span className="eyebrow" style={{ justifySelf: 'center' }}>
                <span className="eyebrow__dot" /> Centro de control gamer
            </span>
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
                        <Trophy aria-hidden /> Ranking
                    </Link>
                </Button>
            </div>
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
