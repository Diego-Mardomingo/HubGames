'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Check, ChevronRight, RefreshCw, Shield, TriangleAlert, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { adminLines, type AdminLine } from '@/lib/profile'
import { DAILY_PICK, tomorrowJudiDay, tomorrowStatus } from '@/lib/admin'
import { enter } from './Section'

function lineIcon(line: AdminLine) {
    if (line.key === 'gen') return line.tone === 'dash-ok' ? Check : line.tone === 'dash-ko' ? X : TriangleAlert
    if (line.key === 'tomorrow') return line.tone === 'dash-ok' ? CalendarDays : line.tone === 'dash-ko' ? X : TriangleAlert
    return line.tone === 'dash-ok' ? RefreshCw : TriangleAlert
}

/**
 * Administración (solo admins, `is_admin`): tres líneas de estado de lo que mira /admin y el acceso. Ámbar: zona con permisos
 * sobre todos los usuarios. Cuatro consultas de una fila o un recuento; RLS solo deja leerlas a los admins. «JUDI de mañana» usa la misma regla que /admin
 * y el health check (`tomorrowStatus`).
 */
export default function AdminCard({ index }: { index: number }) {
    const [lines, setLines] = useState<AdminLine[] | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let alive = true
        const now = new Date()
        const since = new Date(now.getTime() - 86_400_000).toISOString()
        Promise.all([
            supabase
                .from('hubgames_judi_generacion_logs')
                .select('exito, fuente, fecha_ejecucion, nombre_juego, error_mensaje')
                .order('fecha_ejecucion', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase.from('hubgames_lista_videojuegos_judi').select('nombre').eq('fecha', tomorrowJudiDay(now)).limit(1).maybeSingle(),
            supabase
                .from('hubgames_judi_generacion_logs')
                .select('exito, fecha_judi, error_mensaje')
                .eq('fuente', DAILY_PICK)
                .order('fecha_ejecucion', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase.from('hubgames_sync_logs').select('id', { count: 'exact', head: true }).eq('status', 'error').gte('started_at', since),
        ]).then(([gen, tomorrow, pick, sync]) => {
            if (!alive) return
            if (gen.error || tomorrow.error || pick.error || sync.error) {
                setFailed(true)
                return
            }
            setLines(
                adminLines({
                    lastGen: gen.data,
                    tomorrow: tomorrowStatus({ game: tomorrow.data?.nombre ?? null, pickLog: pick.data }, now),
                    syncErrors: sync.count ?? 0,
                }),
            )
        })
        return () => {
            alive = false
        }
    }, [])

    return (
        <section className="pf-panel pf-admin hg-enter" style={enter(index)} aria-labelledby="pf-admin">
            <header className="dash-sec__head">
                <span className="dash-sec__icon hg-tint dash-warn" aria-hidden>
                    <Shield />
                </span>
                <h2 id="pf-admin" className="dash-sec__title">
                    Administración
                </h2>
            </header>
            {failed ? (
                <p className="pf-empty">No se pudo cargar el estado. Ábrelo para verlo.</p>
            ) : (
                <ul className="pf-admin__list" aria-busy={!lines}>
                    {(lines ?? []).map((line) => {
                        const Icon = lineIcon(line)
                        return (
                            <li key={line.key} className="pf-admin__item">
                                <span className={`pf-admin__dot hg-tint ${line.tone}`} aria-hidden>
                                    <Icon />
                                </span>
                                <span className="pf-admin__text">
                                    <b>{line.title}</b>
                                    <span>
                                        <span className={`pf-ink ${line.tone}`}>{line.value}</span>
                                        {line.detail && ` · ${line.detail}`}
                                    </span>
                                </span>
                            </li>
                        )
                    })}
                    {!lines &&
                        [0, 1, 2].map((i) => (
                            <li key={i} className="pf-admin__item">
                                <Skeleton className="pf-admin__dot" />
                                <span className="pf-admin__text">
                                    <b>
                                        <Skeleton shape="text" w="16ch" />
                                    </b>
                                    <span>
                                        <Skeleton shape="text" w="60%" />
                                    </span>
                                </span>
                            </li>
                        ))}
                </ul>
            )}
            <Button asChild variant="secondary" className="pf-admin__open">
                <Link href="/admin">
                    <Shield data-icon="inline-start" aria-hidden /> Abrir administración
                    <ChevronRight data-icon="inline-end" aria-hidden />
                </Link>
            </Button>
        </section>
    )
}
