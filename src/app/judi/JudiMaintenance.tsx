'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, ClockAlert, Home, LogIn, Trophy, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatHmsCountdown, maintenanceReturn, maintenanceText } from '@/lib/judi-maintenance'
import './judi.css'

/**
 * JUDI en mantenimiento (`NEXT_PUBLIC_JUDI_MAINTENANCE=true`): tarjeta centrada con la forma del error de carga
 * (`.jd-error`) en tono de aviso. Con `until` (`NEXT_PUBLIC_JUDI_MAINTENANCE_UNTIL`), cuándo vuelve: cuenta atrás si
 * falta menos de un día, la fecha si es otro día y «Está tardando más de lo previsto» si ya ha pasado.
 * `now` llega del servidor para que el primer pintado coincida; luego avanza cada segundo en el navegador.
 */
export default function JudiMaintenance({ signedIn, until, now: serverNow }: { signedIn: boolean; until: number | null; now: number }) {
    const [now, setNow] = useState(serverNow)
    const ret = maintenanceReturn(until, now)
    const ticking = ret.kind === 'soon'

    useEffect(() => {
        if (!ticking) return
        const id = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(id)
    }, [ticking])

    return (
        <div className="jd-maint">
            <section className="jd-error jd-error--maint hg-enter" aria-labelledby="jd-maint-title">
                <span className="jd-error__icon hg-tint warn" aria-hidden>
                    <Wrench className="jd-maint__wrench" />
                </span>
                <h1 id="jd-maint-title" className="jd-maint__title">
                    JUDI está en mantenimiento
                </h1>
                {/* La key hace que el texto entre con un fundido al cambiar (p. ej., al pasar la hora prevista). */}
                <p key={ret.kind} className="jd-maint__swap">
                    {maintenanceText(ret.kind, signedIn)}
                </p>
                {ret.kind === 'soon' && (
                    <p className="jd-maint__when">
                        <Clock aria-hidden />
                        <span>
                            Vuelve hacia las <b>{ret.time}</b> · <b className="jd-maint__count">{formatHmsCountdown(ret.msLeft)}</b>
                        </span>
                    </p>
                )}
                {ret.kind === 'later' && (
                    <p className="jd-maint__when">
                        <Clock aria-hidden />
                        <span>
                            Vuelve el <b>{ret.when}</b>
                        </span>
                    </p>
                )}
                {ret.kind === 'overdue' && (
                    <p className="jd-maint__when jd-maint__when--late jd-maint__swap">
                        <ClockAlert aria-hidden />
                        <span>Estaba previsto hacia las {ret.time}</span>
                    </p>
                )}
                <div className="jd-error__acts">
                    <Button asChild>
                        <Link href="/" scroll={false}>
                            <Home aria-hidden /> Ir a Inicio
                        </Link>
                    </Button>
                    {signedIn ? (
                        <Button variant="secondary" asChild>
                            <Link href="/ranking">
                                <Trophy aria-hidden /> Ver el ranking
                            </Link>
                        </Button>
                    ) : (
                        <Button variant="secondary" asChild>
                            <Link href="/login">
                                <LogIn aria-hidden /> Iniciar sesión
                            </Link>
                        </Button>
                    )}
                </div>
            </section>
        </div>
    )
}
