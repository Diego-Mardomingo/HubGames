import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadStatsInput } from '@/lib/stats-db'
import { approxMinutesByYear, availableYears, madridYear, yearStats } from '@/lib/stats'
import { Button } from '@/components/ui/button'
import YearView from './YearView'
import '@/styles/lists.css'
import './stats.css'

export const metadata: Metadata = {
    title: 'Estadísticas',
    description: 'Tu año en juegos: completados, horas, notas, géneros y logros por mes.',
}

export const dynamic = 'force-dynamic'

/** Estadísticas por año (#32). Se calculan en el servidor con tus datos sincronizados. */
export default async function EstadisticasPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const input = await loadStatsInput(supabase, user.id)
    const years = availableYears(input)
    const requested = Number((await searchParams).year)
    const year = years.includes(requested) ? requested : madridYear(new Date().toISOString())
    const approx = approxMinutesByYear(input.games, input.unlocks)
    const stats = yearStats(input, year, approx)
    const prev = yearStats(input, year - 1, approx)
    const rarestGame = stats.rarest ? (input.games.find((g) => g.appid === stats.rarest!.appid)?.name ?? null) : null

    return (
        <div className="stats">
            <header className="page-head">
                <div>
                    <h1 className="page-title">Tu {year} en juegos</h1>
                    <p className="page-subtitle">
                        {stats.activeGames > 0
                            ? `${stats.activeGames} ${stats.activeGames === 1 ? 'juego' : 'juegos'} con actividad, comparado con ${year - 1}.`
                            : `Sin actividad registrada en ${year}.`}
                    </p>
                </div>
                <Button asChild>
                    <Link href={`/estadisticas/resumen?year=${year}`}>Ver tu resumen de {year}</Link>
                </Button>
            </header>

            {years.length > 0 && (
                <nav className="hg-seg hg-seg--scroll stats-years" aria-label="Año">
                    {years.map((y) => (
                        <Link key={y} href={`/estadisticas?year=${y}`} className="hg-seg__opt" aria-current={y === year ? 'page' : undefined}>
                            {y}
                        </Link>
                    ))}
                </nav>
            )}

            {input.games.length === 0 ? (
                <p className="hg-empty">
                    <span>
                        Conecta Steam desde tu <Link href="/perfil">perfil</Link> para ver tus estadísticas.
                    </span>
                </p>
            ) : (
                <YearView s={stats} prev={prev} rarestGame={rarestGame} />
            )}
        </div>
    )
}
