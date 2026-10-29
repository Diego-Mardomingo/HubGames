'use client'

import { useState } from 'react'
import { CalendarDays, Check, Clock, ExternalLink, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { metacriticScore } from '@/lib/scores'
import { isFutureJudi, judiDayShort, madridJudiDay, WORKFLOW_URL, type Tomorrow } from '@/lib/admin'
import { Cap, PanelEmpty, PanelError, PanelFoot, PanelHead, PanelLoading, fmt } from './parts'
import type { DailyRow, Loadable } from './types'

const PAGE = 30

function Metacritic({ score }: { score: number }) {
    if (!score) return <span className="ad-muted">Sin nota</span>
    const { tier, label } = metacriticScore(score)
    return (
        <span className={`hg-chip hg-tint ad-status sc-${tier}`}>
            <b>{score}</b>
            {label}
        </span>
    )
}

/** Juegos programados: el hueco de mañana arriba (pendiente, listo o falta), los próximos, hoy y los publicados. */
export default function CalendarPanel({
    data,
    now,
    tomorrow,
    images,
    onRefresh,
    onSeePick,
}: {
    data: Loadable<DailyRow>
    now: Date
    tomorrow: Tomorrow | null
    images: Map<number, string | null>
    onRefresh: () => void
    onSeePick: () => void
}) {
    const [shown, setShown] = useState(PAGE)
    const rows = data.rows ?? []
    const today = madridJudiDay(now)
    const next = rows.filter((r) => isFutureJudi(r.fecha, now))
    const past = rows.filter((r) => !isFutureJudi(r.fecha, now))

    const head = <PanelHead icon={<CalendarDays />} title="Juegos programados" count={rows.length ? `los ${fmt(rows.length)} últimos` : undefined} busy={data.busy} onRefresh={onRefresh} />
    if (data.error) return <section className="ad-panel">{head}<PanelError what="el calendario" message={data.error} busy={data.busy} onRetry={onRefresh} /></section>
    if (!data.rows) return <section className="ad-panel">{head}<PanelLoading /></section>

    let slot: React.ReactNode = null
    if (tomorrow && tomorrow.state !== 'ready') {
        const day = judiDayShort(tomorrow.fecha)
        slot =
            tomorrow.state === 'pending' ? (
                <div className="ad-slot dash-warn">
                    <span className="ad-slot__icon hg-tint dash-warn" aria-hidden>
                        <Clock />
                    </span>
                    <span className="ad-slot__text">
                        <b>Mañana, {day} · pendiente</b>
                        <span>No hay ningún JUDI después de hoy. Es lo normal por la mañana: el pick sale a las 11:00 y GitHub lo suele retrasar hasta las 15:00–18:00.</span>
                    </span>
                </div>
            ) : tomorrow.state === 'failed' ? (
                <div className="ad-slot dash-ko">
                    <span className="ad-slot__icon hg-tint dash-ko" aria-hidden>
                        <X />
                    </span>
                    <span className="ad-slot__text">
                        <b>Mañana, {day} · el pick falló</b>
                        <span>{tomorrow.error}</span>
                    </span>
                    <Button type="button" variant="secondary" size="sm" onClick={onSeePick}>
                        Ver log
                    </Button>
                </div>
            ) : (
                <div className="ad-slot dash-ko">
                    <span className="ad-slot__icon hg-tint dash-ko" aria-hidden>
                        <TriangleAlert />
                    </span>
                    <span className="ad-slot__text">
                        <b>Mañana, {day} · falta</b>
                        <span>Son más de las 20:00 y el pick de hoy no ha llegado.</span>
                    </span>
                    <Button asChild variant="secondary" size="sm">
                        <a href={WORKFLOW_URL.pick} target="_blank" rel="noreferrer">
                            <ExternalLink aria-hidden /> Abrir el workflow
                        </a>
                    </Button>
                </div>
            )
    }

    if (!rows.length)
        return (
            <section className="ad-panel">
                {head}
                {slot}
                <PanelEmpty icon={<CalendarDays />} title="Todavía no hay ningún JUDI">
                    El primero aparecerá cuando el pick elija uno del pool.
                </PanelEmpty>
            </section>
        )

    const row = (r: DailyRow) => {
        const isToday = r.fecha === today
        const isTomorrow = tomorrow?.fecha === r.fecha
        return (
            <li key={r.id} className={`ad-item${isToday ? ' is-today' : ''}${isTomorrow ? ' is-next' : ''}`}>
                <div className="ad-row ad-g-cal">
                    <span className="ad-x-top">
                        <span className="ad-when">
                            <span className="ad-date">
                                <b>{judiDayShort(r.fecha)}</b>
                                <span>{r.fecha}</span>
                            </span>
                            {isToday && <span className="hg-chip hg-tint ad-status st-todos">Hoy</span>}
                            {isTomorrow && (
                                <span className="hg-chip hg-tint ad-status dash-ok">
                                    <Check aria-hidden />
                                    Mañana
                                </span>
                            )}
                        </span>
                    </span>
                    <span className="ad-x-main ad-name">
                        <Cap src={r.steam_appid ? images.get(r.steam_appid) : null} name={r.nombre} />
                        <span className="ad-name__text">
                            <span className="ad-name__t">{r.nombre}</span>
                            <span className="ad-name__s">{r.steam_appid ? `Steam ${r.steam_appid}` : 'Sin Steam'}</span>
                        </span>
                    </span>
                    <span className="ad-x-wide">
                        <Metacritic score={r.calificacion} />
                    </span>
                    <span className="ad-x-wide ad-muted">#{r.id}</span>
                    <span className="ad-x-end">
                        <Metacritic score={r.calificacion} />
                    </span>
                </div>
            </li>
        )
    }

    return (
        <section className="ad-panel">
            {head}
            {slot}
            <div className="ad-th ad-g-cal" aria-hidden>
                <span>Fecha</span>
                <span>Juego</span>
                <span className="ad-x-wide">Metacritic</span>
                <span className="ad-x-wide">#</span>
            </div>
            {next.length > 0 && (
                <>
                    <p className="ad-group-label">Próximos, todavía no visibles ({next.length})</p>
                    <ul className="ad-list">{next.map(row)}</ul>
                </>
            )}
            <p className="ad-group-label">Publicados</p>
            <ul className="ad-list">{past.slice(0, shown).map(row)}</ul>
            {past.length > PAGE && (
                <PanelFoot
                    shown={Math.min(shown, past.length)}
                    total={fmt(past.length)}
                    more={shown < past.length ? `Ver ${Math.min(PAGE, past.length - shown)} más` : null}
                    onMore={() => setShown((s) => s + PAGE)}
                />
            )}
        </section>
    )
}
