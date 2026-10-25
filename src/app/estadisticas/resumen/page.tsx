import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { loadStatsInput } from '@/lib/stats-db'
import { availableYears, buildWrapped, hasWrapped, madridYear, yearStats } from '@/lib/stats'
import Wrapped from './Wrapped'
import '../stats.css'

export const metadata: Metadata = {
    title: 'Tu resumen del año',
    description: 'Tu año en juegos: horas, juego del año, top 5, logro más raro y mejor racha.',
}

export const dynamic = 'force-dynamic'

/** Resumen anual estilo Wrapped (#33). */
export default async function ResumenPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const input = await loadStatsInput(supabase, user.id)
    const years = availableYears(input)
    const requested = Number((await searchParams).year)
    const year = years.includes(requested) ? requested : madridYear(new Date().toISOString())
    const data = buildWrapped(yearStats(input, year), input.games)

    if (!hasWrapped(data)) {
        return (
            <div className="wrapped">
                <p className="stats-empty glass stats-empty--box">
                    Sin horas, logros ni juegos completados en {year}: no hay nada que resumir.{' '}
                    <Link href={`/estadisticas?year=${year}`}>Volver a las estadísticas</Link>
                </p>
            </div>
        )
    }
    return <Wrapped data={data} />
}
