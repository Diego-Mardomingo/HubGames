'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Database, Download, ExternalLink, FileText, Search, TriangleAlert, X, Zap } from 'lucide-react'
import Link from 'next/link'
import Segmented from '@/components/Segmented'
import { adminWhen } from '@/lib/profile'
import {
    DAILY_PICK,
    fullMadrid,
    fuenteLabel,
    genLogState,
    isoDayShort,
    judiDayShort,
    parseDailyLog,
    parsePoolLog,
    RUN_STATE_META,
    WEEKLY_POOL,
} from '@/lib/admin'
import AdminRow, { CopyButton } from './AdminRow'
import AdminStatus from './AdminStatus'
import { Cap, PanelEmpty, PanelError, PanelFoot, PanelHead, PanelLoading, fmt } from './parts'
import type { GenRow, Loadable } from './types'

type LogFilter = 'all' | 'daily' | 'pool' | 'fail'
const FILTERS: readonly LogFilter[] = ['all', 'daily', 'pool', 'fail']
const PAGE = 25

const FUENTE_ICON: Record<string, typeof FileText> = { [DAILY_PICK]: CalendarDays, [WEEKLY_POOL]: Download, steam_pool_backfill: Database, steam_pool_edge_function: Zap }

const isDaily = (l: GenRow) => l.fuente === DAILY_PICK || l.fuente === 'steam_pool_edge_function'
const hasProblem = (l: GenRow) => {
    const s = genLogState(l)
    return s === 'ko' || s === 'partial'
}

/** Fecha JUDI de la fila: «jue 29 oct» para el pick, «sem. 25 oct» para la ingesta (va en YYYY-MM-DD). */
function judiCell(l: GenRow): string {
    if (!l.fecha_judi) return '—'
    return /^\d{4}-/.test(l.fecha_judi) ? `sem. ${isoDayShort(l.fecha_judi)}` : judiDayShort(l.fecha_judi)
}

function rowHead(l: GenRow, now: Date, images: Map<number, string | null>) {
    const state = genLogState(l)
    const Icon = (l.fuente && FUENTE_ICON[l.fuente]) || FileText
    const facts = l.fuente === WEEKLY_POOL ? parsePoolLog(l.nombre_juego) : null
    let name: string
    let sub: React.ReactNode
    let cap: React.ReactNode = null
    if (isDaily(l) && l.id_juego_steam) {
        const daily = parseDailyLog(l.nombre_juego)
        name = daily.game ?? l.nombre_juego ?? '—'
        sub = state === 'ko' ? <span className="ad-name__s ad-ink dash-ko">{l.error_mensaje}</span> : <span className="ad-name__s">{daily.same ? 'Ya había juego para ese día' : `Steam ${l.id_juego_steam}`}</span>
        cap = <Cap src={images.get(l.id_juego_steam)} name={name} />
    } else if (facts?.from && facts.to) {
        name = `Semana del ${isoDayShort(facts.from)} al ${isoDayShort(facts.to)}`
        sub = (
            <span className="ad-name__s">
                +{facts.inserted} nuevos · {facts.eligible} elegibles · {facts.ineligible} no elegibles ·{' '}
                <span className={facts.failed ? 'ad-ink dash-warn' : undefined}>
                    {facts.failed} fallos de {facts.attempts}
                </span>{' '}
                · cola {facts.queue}
            </span>
        )
    } else {
        name = l.fuente === WEEKLY_POOL && l.fecha_judi ? `Semana del ${isoDayShort(l.fecha_judi)} · no terminó` : (l.nombre_juego ?? '—')
        sub = l.error_mensaje ? <span className={`ad-name__s ad-ink ${state === 'ko' ? 'dash-ko' : ''}`}>{l.error_mensaje}</span> : null
        if (l.id_juego_steam) cap = <Cap src={images.get(l.id_juego_steam)} name={name} />
    }
    const when = l.fecha_ejecucion ? adminWhen(l.fecha_ejecucion, now) : '—'
    return (
        <>
            <span className="ad-x-top">
                <AdminStatus state={state} />
                <span className="ad-x-type">
                    <span className="ad-type">
                        <Icon aria-hidden />
                        {fuenteLabel(l.fuente)}
                    </span>
                </span>
            </span>
            <span className="ad-x-main ad-name">
                {cap}
                <span className="ad-name__text">
                    <span className="ad-name__t">{name}</span>
                    {sub}
                </span>
            </span>
            <span className="ad-x-wide ad-muted">{judiCell(l)}</span>
            <span className="ad-x-wide ad-x-when ad-muted">{when}</span>
            <span className="ad-x-end ad-muted">{when}</span>
        </>
    )
}

function detailText(l: GenRow): string {
    return [
        `Log #${l.id} · ${fuenteLabel(l.fuente)} (${l.fuente ?? '—'})`,
        `Registrado: ${fullMadrid(l.fecha_ejecucion)}`,
        `Fecha JUDI: ${l.fecha_judi ?? '—'}`,
        l.id_juego_steam ? `Steam app ID: ${l.id_juego_steam}` : null,
        `Descripción: ${l.nombre_juego ?? '—'}`,
        `Error: ${l.error_mensaje ?? '—'}`,
        l.error_stack ? `Stack:\n${l.error_stack}` : null,
    ]
        .filter(Boolean)
        .join('\n')
}

function LogDetail({ l }: { l: GenRow }) {
    const state = genLogState(l)
    const facts = l.fuente === WEEKLY_POOL ? parsePoolLog(l.nombre_juego) : null
    const weekly = l.fuente === WEEKLY_POOL
    return (
        <>
            {facts && (
                <div className="ad-groups">
                    <div className="ad-group">
                        <h4>
                            <Download aria-hidden /> Filas
                        </h4>
                        <p>
                            Nuevas <b>{facts.inserted} de {facts.target}</b>
                        </p>
                        <p>
                            Elegibles <b className="ad-ink dash-ok">{facts.eligible}</b>
                        </p>
                        <p>
                            No elegibles <b>{facts.ineligible}</b>
                        </p>
                    </div>
                    <div className="ad-group">
                        <h4>
                            <Search aria-hidden /> Candidatos
                        </h4>
                        <p>
                            Intentos <b>{facts.attempts}</b>
                        </p>
                        <p>
                            Fallos <b className={facts.failed ? 'ad-ink dash-warn' : undefined}>{facts.failed}</b>
                        </p>
                        <p>
                            Cola restante <b>{facts.queue}</b>
                        </p>
                    </div>
                    {facts.strategy && (
                        <div className="ad-group">
                            <h4>
                                <Database aria-hidden /> Origen
                            </h4>
                            <p>
                                Estrategia <b className="ad-small">{facts.strategy}</b>
                            </p>
                        </div>
                    )}
                </div>
            )}
            <dl className="ad-dl">
                <dt>Log</dt>
                <dd>#{l.id}</dd>
                <dt>Fuente</dt>
                <dd>
                    {fuenteLabel(l.fuente)} <span className="ad-muted">· {l.fuente ?? '—'}</span>
                </dd>
                <dt>Registrado</dt>
                <dd>{fullMadrid(l.fecha_ejecucion)}</dd>
                <dt>{weekly ? 'Semana' : 'Fecha JUDI'}</dt>
                <dd>{weekly && l.fecha_judi ? (facts?.to ? `${isoDayShort(l.fecha_judi)} – ${isoDayShort(facts.to)}` : isoDayShort(l.fecha_judi)) : l.fecha_judi ? `${judiCell(l)} (${l.fecha_judi})` : '—'}</dd>
                {l.id_juego_steam ? (
                    <>
                        <dt>Steam app ID</dt>
                        <dd>
                            {l.id_juego_steam} ·{' '}
                            <Link className="ad-link" href={`/juego/${l.id_juego_steam}`}>
                                Ver ficha <ExternalLink aria-hidden />
                            </Link>
                        </dd>
                    </>
                ) : null}
                {l.id_juego_rawg ? (
                    <>
                        <dt>RAWG id</dt>
                        <dd>{l.id_juego_rawg}</dd>
                    </>
                ) : null}
                <dt>{facts ? 'Texto original' : 'Descripción'}</dt>
                <dd className={facts ? 'ad-muted' : undefined}>{l.nombre_juego || '—'}</dd>
                <dt>Mensaje de error</dt>
                <dd>{l.error_mensaje ? <div className={`ad-err${state === 'partial' ? ' is-warn' : ''}`}>{l.error_mensaje}</div> : '—'}</dd>
                {l.error_stack ? (
                    <>
                        <dt>Stack</dt>
                        <dd>
                            <pre className="ad-pre">{l.error_stack}</pre>
                        </dd>
                    </>
                ) : null}
            </dl>
            <div className="ad-detail__acts">
                <CopyButton text={detailText(l)} />
            </div>
        </>
    )
}

/** Logs de generación (los 100 últimos): filtros con contador, filas con estado, tipo, juego o resumen y detalle que se despliega. */
export default function LogsPanel({
    data,
    now,
    images,
    open,
    onToggle,
    onRefresh,
    focus,
    initialFilter,
}: {
    data: Loadable<GenRow>
    now: Date
    images: Map<number, string | null>
    open: Set<string>
    onToggle: (key: string) => void
    onRefresh: () => void
    /** Log que hay que enseñar (desde el aviso): quita el filtro si no entra y amplía lo que se ve. */
    focus: number | null
    initialFilter?: LogFilter
}) {
    const [filter, setFilter] = useState<LogFilter>(initialFilter ?? 'all')
    const [shown, setShown] = useState(PAGE)
    const rows = useMemo(() => data.rows ?? [], [data.rows])
    const counts = useMemo<Record<LogFilter, number>>(
        () => ({ all: rows.length, daily: rows.filter(isDaily).length, pool: rows.filter((l) => l.fuente === WEEKLY_POOL).length, fail: rows.filter(hasProblem).length }),
        [rows],
    )
    const anyKo = rows.some((l) => genLogState(l) === 'ko')
    const filtered = rows.filter((l) => (filter === 'daily' ? isDaily(l) : filter === 'pool' ? l.fuente === WEEKLY_POOL : filter === 'fail' ? hasProblem(l) : true))

    useEffect(() => {
        if (focus === null) return
        const all = data.rows ?? []
        const idx = all.findIndex((l) => l.id === focus)
        if (idx < 0) return
        // eslint-disable-next-line react-hooks/set-state-in-effect -- enseñar el log pedido desde el aviso
        setFilter('all')
        setShown((s) => Math.max(s, Math.ceil((idx + 1) / PAGE) * PAGE))
    }, [focus, data.rows])

    const head = <PanelHead icon={<FileText />} title="Logs de generación" count={data.rows?.length ? `los ${fmt(data.rows.length)} últimos` : undefined} busy={data.busy} onRefresh={onRefresh} />
    if (data.error) return <section className="ad-panel">{head}<PanelError what="los logs" message={data.error} busy={data.busy} onRetry={onRefresh} /></section>
    if (!data.rows) return <section className="ad-panel">{head}<PanelLoading /></section>
    if (!rows.length)
        return (
            <section className="ad-panel">
                {head}
                <PanelEmpty icon={<FileText />} title="Todavía no hay registros">
                    Aquí aparecerá cada ejecución del pick diario (11:00) y de la ingesta semanal (domingos, 19:00).
                </PanelEmpty>
            </section>
        )

    return (
        <section className="ad-panel">
            {head}
            <div className="ad-tools">
                <Segmented
                    value={filter}
                    options={FILTERS}
                    labels={{ all: 'Todos', daily: 'Juego del día', pool: 'Ingesta del pool', fail: 'Con fallos' }}
                    counts={counts}
                    icons={{
                        daily: <CalendarDays aria-hidden />,
                        pool: <Download aria-hidden />,
                        fail: anyKo ? <X className="ad-ink dash-ko" aria-hidden /> : <TriangleAlert className="ad-ink dash-warn" aria-hidden />,
                    }}
                    countClassName={(o, c) => (o === 'fail' && c ? `ad-cnt hg-tint ${anyKo ? 'dash-ko' : 'dash-warn'}` : `ad-cnt${c ? '' : ' is-zero'}`)}
                    onChange={(v) => {
                        setFilter(v)
                        setShown(PAGE)
                    }}
                    scroll
                    aria-label="Filtrar logs"
                />
            </div>
            {filtered.length ? (
                <>
                    <div className="ad-th ad-g-log" aria-hidden>
                        <span>Estado</span>
                        <span className="ad-x-type">Tipo</span>
                        <span>Juego o resumen</span>
                        <span className="ad-x-wide">Fecha JUDI</span>
                        <span className="ad-x-wide ad-x-when">Registrado</span>
                        <span />
                    </div>
                    <ul className="ad-list" key={filter}>
                        {filtered.slice(0, shown).map((l) => (
                            <AdminRow
                                key={l.id}
                                rowKey={`g${l.id}`}
                                grid="ad-g-log"
                                tone={RUN_STATE_META[genLogState(l)].tone}
                                open={open.has(`g${l.id}`)}
                                onToggle={onToggle}
                                head={rowHead(l, now, images)}
                                detail={<LogDetail l={l} />}
                            />
                        ))}
                    </ul>
                    {filtered.length > PAGE && (
                        <PanelFoot
                            shown={Math.min(shown, filtered.length)}
                            total={fmt(filtered.length)}
                            more={shown < filtered.length ? `Ver ${Math.min(PAGE, filtered.length - shown)} más` : null}
                            onMore={() => setShown((s) => s + PAGE)}
                        />
                    )}
                </>
            ) : (
                <PanelEmpty icon={<FileText />} tone="dash-ok" title="Nada con este filtro">
                    Ningún log de los {fmt(rows.length)} últimos entra aquí.
                </PanelEmpty>
            )}
        </section>
    )
}
