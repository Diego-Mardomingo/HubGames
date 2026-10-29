'use client'

import { useEffect, useState } from 'react'
import { Award, Clock, Hand, Heart, Library, Play, RefreshCw } from 'lucide-react'
import { adminWhen } from '@/lib/profile'
import { agoLabel, durationLabel, fullMadrid, RUN_STATE_META, syncFacts, syncState, syncStats, type SyncStats } from '@/lib/admin'
import AdminRow, { CopyButton } from './AdminRow'
import AdminStatus from './AdminStatus'
import { PanelEmpty, PanelError, PanelFoot, PanelHead, PanelLoading, fmt } from './parts'
import type { Loadable, SyncRow } from './types'

const PAGE = 25

function User({ id, me }: { id: string; me: string | null }) {
    return (
        <span className="ad-user" title={id}>
            {id === me && <span className="ad-you">Tú</span>}
            <span className="ad-uid">{id.slice(0, 8)}</span>
        </span>
    )
}

function rowHead(s: SyncRow, now: Date, me: string | null) {
    const state = syncState(s, now)
    const stats = syncStats(s.stats)
    const slow = s.finished_at && Date.parse(s.finished_at) - Date.parse(s.started_at) > 60_000
    let main: React.ReactNode
    if (state === 'ko') main = <span className="ad-name__s ad-ink dash-ko ad-clamp">{s.error}</span>
    else if (state === 'run') main = <span className="ad-facts">Empezó {agoLabel(s.started_at, now)}</span>
    else if (state === 'stale')
        main = <span className="ad-facts ad-ink dash-warn">Lleva {agoLabel(s.started_at, now).replace('hace ', '')} «en curso»: se cortó sin cerrar el log</span>
    else
        main = (
            <span className="ad-facts">
                {syncFacts(stats).map((f) => (
                    <span key={f.text} className={f.tone ? `ad-ink ${f.tone}` : undefined}>
                        {f.text}
                    </span>
                ))}
            </span>
        )
    const when = adminWhen(s.started_at, now)
    return (
        <>
            <span className="ad-x-top">
                <AdminStatus state={state} />
                <span className="ad-type">
                    {s.source === 'cron' ? <Clock aria-hidden /> : <Hand aria-hidden />}
                    {s.source === 'cron' ? 'Diaria' : 'Manual'}
                </span>
                <span className="ad-x-narrow">
                    <User id={s.user_id} me={me} />
                </span>
            </span>
            <span className="ad-x-wide ad-x-user">
                <User id={s.user_id} me={me} />
            </span>
            <span className="ad-x-wide ad-muted">{when}</span>
            <span className={`ad-x-wide ad-x-dur ad-muted${slow ? ' ad-slow' : ''}`}>{durationLabel(s.started_at, s.finished_at)}</span>
            <span className="ad-x-main ad-min0">{main}</span>
            <span className="ad-x-end ad-muted">{when}</span>
        </>
    )
}

function Group({ icon, title, rows }: { icon: React.ReactNode; title: string; rows: [string, React.ReactNode, string?][] }) {
    return (
        <div className="ad-group">
            <h4>
                {icon} {title}
            </h4>
            {rows.map(([label, value, tone]) => (
                <p key={label}>
                    {label} <b className={tone ? `ad-ink ${tone}` : undefined}>{value}</b>
                </p>
            ))}
        </div>
    )
}

function statGroups(x: SyncStats) {
    return (
        <div className="ad-groups">
            <Group
                icon={<Library aria-hidden />}
                title="Biblioteca"
                rows={[
                    ['Juegos', fmt(x.library.ownedGames)],
                    ['Nuevos a la bandeja', x.library.newToTray],
                    ['Fichas descargadas', x.library.catalogFetched],
                    ['Fotos de horas', x.snapshotRows],
                ]}
            />
            <Group
                icon={<Heart aria-hidden />}
                title="Wishlist y precios"
                rows={
                    x.wishlist
                        ? [
                              ['Juegos', x.wishlist.steamItems],
                              ['Precios', x.wishlist.pricesUpdated],
                              ['Mínimos', x.wishlist.lowsUpdated],
                              ['IsThereAnyDeal', x.wishlist.itadMatched],
                          ]
                        : x.wishlistError
                          ? [['Estado', 'Falló', 'dash-warn']]
                          : [['Estado', x.wishlistMissing ? 'No existía aún' : '—']]
                }
            />
            <Group
                icon={<Award aria-hidden />}
                title="Logros"
                rows={[
                    ['Revisados', `${x.achievements.gamesSynced} de ${x.achievements.gamesDue}`],
                    ['Fallidos', x.achievements.gamesFailed, x.achievements.gamesFailed ? 'dash-warn' : undefined],
                    ['Llamadas a Steam', x.achievements.apiCalls],
                ]}
            />
            <Group
                icon={<Play aria-hidden />}
                title="Estados automáticos"
                rows={
                    x.tracker
                        ? [
                              ['A Jugando', x.tracker.toPlaying],
                              ['Sugerencias', x.tracker.suggestions],
                          ]
                        : [['Estado', 'No existía aún']]
                }
            />
        </div>
    )
}

function SyncDetail({ s, now }: { s: SyncRow; now: Date }) {
    const state = syncState(s, now)
    const x = syncStats(s.stats)
    const text = [
        `Sincronización #${s.id} · ${s.source} · ${s.status}`,
        `Usuario: ${s.user_id}`,
        `Inicio: ${fullMadrid(s.started_at)}`,
        `Fin: ${s.finished_at ? `${fullMadrid(s.finished_at)} (${durationLabel(s.started_at, s.finished_at)})` : '—'}`,
        s.error ? `Error: ${s.error}` : null,
        x?.wishlistError ? `Wishlist: ${x.wishlistError}` : null,
        s.stats ? `Stats: ${JSON.stringify(s.stats)}` : null,
    ]
        .filter(Boolean)
        .join('\n')
    return (
        <>
            {x && statGroups(x)}
            <dl className="ad-dl">
                <dt>Log</dt>
                <dd>#{s.id}</dd>
                <dt>Usuario</dt>
                <dd className="ad-muted">{s.user_id}</dd>
                <dt>Inicio</dt>
                <dd>{fullMadrid(s.started_at)}</dd>
                <dt>Fin</dt>
                <dd>
                    {s.finished_at ? (
                        `${fullMadrid(s.finished_at)} · ${durationLabel(s.started_at, s.finished_at)}`
                    ) : state === 'run' ? (
                        'Todavía en curso'
                    ) : (
                        <span className="ad-ink dash-warn">Nunca llegó</span>
                    )}
                </dd>
                {s.error ? (
                    <>
                        <dt>Error</dt>
                        <dd>
                            <div className="ad-err">{s.error}</div>
                        </dd>
                    </>
                ) : null}
                {x?.wishlistError ? (
                    <>
                        <dt>Wishlist</dt>
                        <dd>
                            <div className="ad-err is-warn">{x.wishlistError}</div>
                        </dd>
                    </>
                ) : null}
                {x?.wishlist?.pricesError ? (
                    <>
                        <dt>Precios</dt>
                        <dd>
                            <div className="ad-err is-warn">{x.wishlist.pricesError}</div>
                        </dd>
                    </>
                ) : null}
            </dl>
            <div className="ad-detail__acts">
                <CopyButton text={text} />
            </div>
        </>
    )
}

/** Sincronizaciones con Steam (las 100 últimas): estado, origen, usuario («Tú» y el id corto), inicio, duración y resumen. */
export default function SyncPanel({
    data,
    now,
    me,
    open,
    onToggle,
    onRefresh,
    focus,
}: {
    data: Loadable<SyncRow>
    now: Date
    me: string | null
    open: Set<string>
    onToggle: (key: string) => void
    onRefresh: () => void
    focus: number | null
}) {
    const [shown, setShown] = useState(PAGE)
    useEffect(() => {
        if (focus === null) return
        const idx = (data.rows ?? []).findIndex((s) => s.id === focus)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- enseñar la sincronización pedida desde el aviso
        if (idx >= 0) setShown((s) => Math.max(s, Math.ceil((idx + 1) / PAGE) * PAGE))
    }, [focus, data.rows])

    const rows = data.rows ?? []
    const head = (
        <PanelHead
            icon={<RefreshCw />}
            title="Sincronizaciones con Steam"
            count={rows.length ? `las ${fmt(rows.length)} últimas` : undefined}
            busy={data.busy}
            onRefresh={onRefresh}
        />
    )
    if (data.error) return <section className="ad-panel">{head}<PanelError what="las sincronizaciones" message={data.error} busy={data.busy} onRetry={onRefresh} /></section>
    if (!data.rows) return <section className="ad-panel">{head}<PanelLoading /></section>
    if (!rows.length)
        return (
            <section className="ad-panel">
                {head}
                <PanelEmpty icon={<RefreshCw />} title="Todavía no hay sincronizaciones">
                    La diaria corre a la 1:00 (GitHub) y cada usuario puede lanzar la suya desde el Inicio.
                </PanelEmpty>
            </section>
        )
    return (
        <section className="ad-panel">
            {head}
            <div className="ad-th ad-g-sync" aria-hidden>
                <span>Estado</span>
                <span>Origen</span>
                <span className="ad-x-wide ad-x-user">Usuario</span>
                <span className="ad-x-wide">Inicio</span>
                <span className="ad-x-wide ad-x-dur">Duración</span>
                <span>Resumen o error</span>
                <span />
            </div>
            <ul className="ad-list">
                {rows.slice(0, shown).map((s) => (
                    <AdminRow
                        key={s.id}
                        rowKey={`s${s.id}`}
                        grid="ad-g-sync"
                        tone={RUN_STATE_META[syncState(s, now)].tone}
                        open={open.has(`s${s.id}`)}
                        onToggle={onToggle}
                        head={rowHead(s, now, me)}
                        detail={<SyncDetail s={s} now={now} />}
                    />
                ))}
            </ul>
            {rows.length > PAGE && (
                <PanelFoot
                    shown={Math.min(shown, rows.length)}
                    total={fmt(rows.length)}
                    more={shown < rows.length ? `Ver ${Math.min(PAGE, rows.length - shown)} más` : null}
                    onMore={() => setShown((s) => s + PAGE)}
                />
            )}
        </section>
    )
}
