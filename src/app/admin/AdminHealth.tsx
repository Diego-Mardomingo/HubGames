'use client'

import type { CSSProperties, ReactNode } from 'react'
import { CalendarDays, CircleCheck, Database, Download, ExternalLink, RefreshCw, TriangleAlert, X } from 'lucide-react'
import Tile from '@/components/Tile'
import { Button } from '@/components/ui/button'
import { adminWhen, judiDateLong } from '@/lib/profile'
import {
    agoLabel,
    daysBetween,
    genLogState,
    ingestTone,
    isoDayShort,
    judiDayShort,
    parsePoolLog,
    reserveTone,
    RUN_STATE_META,
    TOMORROW_META,
    WEEKLY_POOL,
    WORKFLOW_URL,
    type AdminTone,
    type Failure,
    type PoolCounts,
    type SteamHealth,
    type Tomorrow,
} from '@/lib/admin'
import type { AdminTab, GenRow } from './types'

const n = (v: number) => v.toLocaleString('es-ES', { useGrouping: 'always' } as Intl.NumberFormatOptions)
const enter = (i: number) => ({ '--i': i }) as CSSProperties

function HealthTile({
    i,
    tone,
    icon,
    label,
    value,
    note,
    go,
    goLabel,
    onGo,
}: {
    i: number
    tone: AdminTone
    icon: ReactNode
    label: string
    value: ReactNode
    note: ReactNode
    go: AdminTab
    goLabel: string
    onGo: (tab: AdminTab) => void
}) {
    return (
        <Tile icon={icon} tone={tone} label={label} className={`ad-tile hg-enter${tone === 'dash-ko' ? ' is-bad' : ''}`} style={enter(i)}>
            <dd className="hg-tile__value hg-tile__value--tinted">{value}</dd>
            <dd className="hg-tile__note">
                {note}
                <button type="button" className="ad-tile__go" onClick={() => onGo(go)}>
                    <span className="sr-only">{goLabel}</span>
                </button>
            </dd>
        </Tile>
    )
}

/**
 * Salud arriba de /admin: cuatro tiles (JUDI de mañana, reserva del pool, ingesta semanal y Steam) con las reglas del
 * health check, y debajo el aviso del último fallo o una línea tranquila si no hay ninguno en 7 días.
 */
export default function AdminHealth({
    now,
    tomorrow,
    counts,
    gen,
    steam,
    hasSync,
    failures,
    onGo,
    onSee,
}: {
    now: Date
    tomorrow: Tomorrow | null
    counts: PoolCounts | null
    gen: GenRow[] | null
    steam: SteamHealth | null
    hasSync: boolean
    failures: Failure[]
    onGo: (tab: AdminTab, filter?: 'fail') => void
    onSee: (f: Failure) => void
}) {
    const lastWeekly = gen?.find((l) => l.fuente === WEEKLY_POOL) ?? null
    const weeklyState = lastWeekly ? genLogState(lastWeekly) : null
    const weeklyFacts = lastWeekly ? parsePoolLog(lastWeekly.nombre_juego) : null
    const weeklyDays = lastWeekly?.fecha_ejecucion ? daysBetween(lastWeekly.fecha_ejecucion, now) : null

    const tiles: ReactNode[] = []
    // 1. JUDI de mañana
    if (tomorrow) {
        const meta = TOMORROW_META[tomorrow.state]
        const day = judiDayShort(tomorrow.fecha)
        tiles.push(
            <HealthTile
                key="tomorrow"
                i={1}
                tone={meta.tone}
                icon={<CalendarDays aria-hidden />}
                label="JUDI de mañana"
                value={meta.label}
                note={
                    tomorrow.state === 'ready' ? (
                        <>
                            <b>{tomorrow.game}</b> · {day}
                        </>
                    ) : tomorrow.state === 'pending' ? (
                        `${day} · el pick sale a las 11:00 y suele llegar entre las 15:00 y las 18:00`
                    ) : tomorrow.state === 'failed' ? (
                        `${day} · ${tomorrow.error ?? 'el pick falló'}`
                    ) : (
                        `${day} · el pick de hoy no ha dejado ningún log`
                    )
                }
                go={tomorrow.state === 'failed' ? 'logs' : 'cal'}
                goLabel={tomorrow.state === 'failed' ? 'Ver el log del pick' : 'Abrir el calendario'}
                onGo={(t) => onGo(t, tomorrow.state === 'failed' ? 'fail' : undefined)}
            />,
        )
    }
    // 2. Reserva del pool
    if (counts) {
        const tone = reserveTone(counts.unused)
        tiles.push(
            <HealthTile
                key="reserve"
                i={2}
                tone={tone}
                icon={<Database aria-hidden />}
                label="Reserva del pool"
                value={
                    counts.unused ? (
                        <>
                            {n(counts.unused)} <small>juegos</small>
                        </>
                    ) : (
                        'Vacía'
                    )
                }
                note={
                    counts.unused ? (
                        <>
                            elegibles sin usar · <b>≈ {n(counts.unused)} días</b> de JUDI
                        </>
                    ) : (
                        'Sin elegibles no se puede elegir el JUDI de mañana'
                    )
                }
                go="pool"
                goLabel="Abrir el pool"
                onGo={onGo}
            />,
        )
    }
    // 3. Ingesta semanal
    if (gen) {
        const tone = ingestTone(weeklyDays, weeklyState)
        tiles.push(
            <HealthTile
                key="ingest"
                i={3}
                tone={tone}
                icon={<Download aria-hidden />}
                label="Ingesta semanal"
                value={lastWeekly?.fecha_ejecucion ? agoLabel(lastWeekly.fecha_ejecucion, now) : 'Nunca'}
                note={
                    weeklyState ? (
                        <>
                            <span className={`ad-ink ${RUN_STATE_META[weeklyState].tone}`}>{RUN_STATE_META[weeklyState].label}</span>
                            {weeklyFacts
                                ? ` · +${weeklyFacts.inserted} · ${weeklyFacts.eligible} elegibles${weeklyFacts.failed ? ` · ${weeklyFacts.failed} fallos` : ''}`
                                : lastWeekly?.error_mensaje
                                  ? ` · ${lastWeekly.error_mensaje}`
                                  : ''}
                        </>
                    ) : (
                        'Corre los domingos a las 19:00'
                    )
                }
                go="logs"
                goLabel="Ver los logs"
                onGo={onGo}
            />,
        )
    }
    // 4. Steam
    if (steam) {
        tiles.push(
            <HealthTile
                key="steam"
                i={4}
                tone={steam.tone}
                icon={<RefreshCw aria-hidden />}
                label="Steam"
                value={!hasSync ? 'Sin datos' : steam.lastOk?.finished_at ? agoLabel(steam.lastOk.finished_at, now) : 'Nunca'}
                note={
                    !hasSync ? (
                        'Todavía no hay sincronizaciones'
                    ) : (
                        <>
                            última correcta ·{' '}
                            {steam.problemsInDay ? (
                                <>
                                    <span className="ad-ink dash-warn">{steam.problemsInDay} con problemas en 24 h</span> · {steam.errorsInDay} con error
                                </>
                            ) : (
                                `${steam.lastOk?.source === 'cron' ? 'diaria' : 'manual'} · ${steam.inDay} en 24 h, ninguna con error`
                            )}
                        </>
                    )
                }
                go="steam"
                goLabel="Ver las sincronizaciones"
                onGo={onGo}
            />,
        )
    }

    const alerts: ReactNode[] = []
    if (counts && counts.unused === 0) {
        alerts.push(
            <div key="pool" className="alert alert--error ad-alert hg-enter" style={enter(5)} role="alert">
                <TriangleAlert aria-hidden />
                <div className="ad-alert__text">
                    <b>El pool está vacío</b>
                    <span>Sin juegos elegibles, el pick de mañana fallará. La ingesta semanal corre los domingos a las 19:00; si no puede esperar, lánzala a mano desde GitHub.</span>
                </div>
                <div className="ad-alert__acts">
                    <Button asChild variant="secondary" size="sm">
                        <a href={WORKFLOW_URL.pool} target="_blank" rel="noreferrer">
                            <ExternalLink aria-hidden /> Abrir el workflow
                        </a>
                    </Button>
                </div>
            </div>,
        )
    }
    if (tomorrow?.state === 'missing') {
        alerts.push(
            <div key="missing" className="alert alert--error ad-alert hg-enter" style={enter(5)} role="alert">
                <TriangleAlert aria-hidden />
                <div className="ad-alert__text">
                    <b>Falta el JUDI de mañana ({judiDateLong(tomorrow.fecha)})</b>
                    <span>No hay ningún log del pick de hoy: el workflow no ha llegado a ejecutarse. El health check de las 20:00 abrirá un issue.</span>
                </div>
                <div className="ad-alert__acts">
                    <Button asChild variant="secondary" size="sm">
                        <a href={WORKFLOW_URL.pick} target="_blank" rel="noreferrer">
                            <ExternalLink aria-hidden /> Abrir el workflow
                        </a>
                    </Button>
                </div>
            </div>,
        )
    }
    if (failures.length) {
        const last = failures[0]
        const workflow = last.kind === 'sync' ? WORKFLOW_URL.sync : last.title === 'Ingesta del pool' ? WORKFLOW_URL.pool : WORKFLOW_URL.pick
        alerts.push(
            <div key="fail" className="alert alert--error ad-alert hg-enter" style={enter(5)} role="alert">
                <X aria-hidden />
                <div className="ad-alert__text">
                    <b>
                        {failures.length === 1 ? 'Un fallo' : `${failures.length} fallos`} en los últimos 7 días · el último: {last.title}, {adminWhen(last.at, now)}
                    </b>
                    <span>{last.message.length > 180 ? `${last.message.slice(0, 177)}…` : last.message}</span>
                </div>
                <div className="ad-alert__acts">
                    <Button type="button" variant="secondary" size="sm" onClick={() => onSee(last)}>
                        Ver log
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                        <a href={workflow} target="_blank" rel="noreferrer">
                            <ExternalLink aria-hidden /> Workflow
                        </a>
                    </Button>
                    {failures.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => onGo('logs', 'fail')}>
                            Ver los {failures.length}
                        </Button>
                    )}
                </div>
            </div>,
        )
    }
    if (!alerts.length && gen && gen.length) {
        const partial = gen.find((l) => l.fecha_ejecucion && now.getTime() - Date.parse(l.fecha_ejecucion) < 7 * 86_400_000 && genLogState(l) === 'partial')
        const facts = partial ? parsePoolLog(partial.nombre_juego) : null
        alerts.push(
            <p key="calm" className="ad-calm hg-enter" style={enter(5)}>
                <CircleCheck aria-hidden />
                <span>
                    <b>Sin fallos en los últimos 7 días</b>
                    {partial && facts && partial.fecha_judi
                        ? ` · 1 parcial: la ingesta del ${isoDayShort(partial.fecha_judi)}, con ${facts.failed} de ${facts.attempts} candidatos fallidos`
                        : ''}
                </span>
            </p>,
        )
    }

    return (
        <>
            {tiles.length > 0 && <dl className="hg-tiles ad-tiles">{tiles}</dl>}
            {alerts}
        </>
    )
}
