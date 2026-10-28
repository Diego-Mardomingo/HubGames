'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Check, ChevronRight, RefreshCw, Shield, TriangleAlert, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { adminLines, type AdminLine } from '@/lib/profile'
import { enter } from './Section'

function lineIcon(line: AdminLine) {
    if (line.key === 'gen') return line.tone === 'dash-ok' ? Check : line.tone === 'dash-ko' ? X : TriangleAlert
    if (line.key === 'scheduled') return line.tone === 'dash-ok' ? CalendarDays : TriangleAlert
    return line.tone === 'dash-ok' ? RefreshCw : TriangleAlert
}

/**
 * Administración (solo admins, `is_admin`): tres líneas de estado de lo que mira /admin y el acceso. Ámbar: zona con permisos
 * sobre todos los usuarios. Tres consultas de una fila o un recuento; RLS solo deja leerlas a los admins.
 */
export default function AdminCard({ index }: { index: number }) {
    const [lines, setLines] = useState<AdminLine[] | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        let alive = true
        const since = new Date(Date.now() - 86_400_000).toISOString()
        Promise.all([
            supabase
                .from('hubgames_judi_generacion_logs')
                .select('exito, fecha_ejecucion, nombre_juego, error_mensaje')
                .order('fecha_ejecucion', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase.from('hubgames_lista_videojuegos_judi').select('fecha').order('id', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('hubgames_sync_logs').select('id', { count: 'exact', head: true }).eq('status', 'error').gte('started_at', since),
        ]).then(([gen, scheduled, sync]) => {
            if (!alive) return
            if (gen.error || scheduled.error || sync.error) {
                setFailed(true)
                return
            }
            setLines(adminLines({ lastGen: gen.data, lastScheduled: scheduled.data?.fecha ?? null, syncErrors: sync.count ?? 0 }))
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
                                <span className="pf-admin__dot pf-skel" aria-hidden />
                                <span className="pf-admin__text">
                                    <span className="pf-skel pf-skel--line" />
                                    <span className="pf-skel pf-skel--line pf-skel--short" />
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
