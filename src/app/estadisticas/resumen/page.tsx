import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Calendar } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { loadStatsInput } from '@/lib/stats-db'
import { availableYears, hasWrapped, madridYear } from '@/lib/stats'
import { buildWrappedView, otherYearWithData } from '@/lib/wrapped'
import { Button } from '@/components/ui/button'
import Wrapped from './Wrapped'
import '@/styles/lists.css'
import './resumen.css'

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
    const data = buildWrappedView(input, year)

    if (!hasWrapped(data)) {
        const other = otherYearWithData(input, years, year)
        return (
            <div className="wr">
                <Link href={`/estadisticas?year=${year}`} className="wr-back">
                    <ArrowLeft aria-hidden /> Estadísticas de {year}
                </Link>
                <div className="wr-empty">
                    <span className="wr-empty__icon hg-tint st-bandeja">
                        <Calendar aria-hidden />
                    </span>
                    <h1>Nada que resumir en {year}</h1>
                    <p>Ese año no hay horas, logros ni juegos completados.{other ? ' Prueba con otro año.' : ''}</p>
                    <div className="wr-empty__actions">
                        {other && (
                            <Button asChild>
                                <Link href={`/estadisticas/resumen?year=${other}`}>Ver {other}</Link>
                            </Button>
                        )}
                        <Button asChild variant={other ? 'secondary' : 'default'}>
                            <Link href={`/estadisticas?year=${year}`}>Volver a las estadísticas</Link>
                        </Button>
                    </div>
                </div>
            </div>
        )
    }
    return <Wrapped key={year} data={data} years={years} />
}
