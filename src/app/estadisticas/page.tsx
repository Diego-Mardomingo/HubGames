import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadStatsInput } from '@/lib/stats-db'
import { approxMinutesByYear, availableYears, madridYear, yearStats } from '@/lib/stats'
import { yearView } from '@/lib/stats-year'
import YearView from './YearView'
import '@/styles/lists.css'
import '@/components/dashboard/dashboard.css'
import '@/components/achievements/achievements.css'
import './stats.css'

export const metadata: Metadata = {
    title: 'Estadísticas',
    description: 'Tu año en juegos: completados, horas, notas, géneros y logros por mes.',
}

export const dynamic = 'force-dynamic'

/**
 * Estadísticas por año (#32). Se calculan en el servidor con tus datos sincronizados; se mandan todos los años a la vez
 * para que cambiar de año sea inmediato (un fundido cruzado en el cliente, sin esperar a la red).
 */
export default async function EstadisticasPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const input = await loadStatsInput(supabase, user.id)
    const now = new Date()
    const years = availableYears(input, now)
    const requested = Number((await searchParams).year)
    const year = years.includes(requested) ? requested : madridYear(now.toISOString())

    if (input.games.length === 0) {
        return (
            <div className="stats">
                <header className="page-head">
                    <div>
                        <h1 className="page-title">Tu {year} en juegos</h1>
                    </div>
                </header>
                <p className="hg-empty">
                    <span>
                        Conecta Steam desde tu <Link href="/perfil">perfil</Link> para ver tus estadísticas.
                    </span>
                </p>
            </div>
        )
    }

    const approx = approxMinutesByYear(input.games, input.unlocks)
    const views = years.map((y) => yearView(input, yearStats(input, y, approx), now))
    return <YearView views={views} initialYear={year} />
}
