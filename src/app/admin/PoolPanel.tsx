'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Ban, Check, CircleCheck, Database, EyeOff, Search } from 'lucide-react'
import Segmented from '@/components/Segmented'
import { supabase } from '@/lib/supabase/client'
import {
    isoDayShort,
    POOL_FILTER_LABELS,
    POOL_FILTERS,
    POOL_PAGE_SIZE,
    POOL_STATE_META,
    poolReasonLabel,
    poolState,
    relevanceShare,
    sharePercent,
    type PoolCounts,
    type PoolFilter,
    type PoolStateKey,
} from '@/lib/admin'
import { Cap, PanelEmpty, PanelError, PanelFoot, PanelHead, PanelLoading, fmt } from './parts'

const STEAM_APPID_CHUNK = 200

type PoolRow = {
    id: number
    steam_appid: number
    game_name: string
    relevance_score: number
    is_eligible: boolean
    selected_for_daily: boolean
    selected_daily_date: string | null
    discarded: boolean
    discarded_reason: string | null
    eligibility_reasons: string[] | null
    week_start_date: string
    header_image: string | null
}

const STATE_ICON: Record<PoolStateKey, typeof Check> = { unused: CircleCheck, used: Check, inel: Ban, disc: EyeOff }
const SPLIT: PoolStateKey[] = ['unused', 'used', 'inel', 'disc']
const SPLIT_LABELS: Record<PoolStateKey, string> = { unused: 'Elegibles sin usar', used: 'Usados', inel: 'No elegibles', disc: 'Descartados' }

async function fetchPage(filter: PoolFilter, search: string, from: number): Promise<{ rows: PoolRow[]; error: string | null }> {
    let q = supabase
        .from('hubgames_judi_pool')
        .select('id, steam_appid, game_name, relevance_score, is_eligible, selected_for_daily, selected_daily_date, discarded, discarded_reason, eligibility_reasons, week_start_date')
        .order('relevance_score', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + POOL_PAGE_SIZE - 1)
    if (filter === 'unused') q = q.eq('is_eligible', true).eq('discarded', false).eq('selected_for_daily', false)
    if (filter === 'used') q = q.eq('selected_for_daily', true)
    if (filter === 'inel') q = q.eq('is_eligible', false).eq('discarded', false)
    if (filter === 'disc') q = q.eq('discarded', true)
    if (search.length >= 2) q = q.ilike('game_name', `%${search.replace(/[%_]/g, (c) => `\\${c}`)}%`)
    const { data, error } = await q
    if (error) return { rows: [], error: error.message || 'No se pudo cargar el pool' }
    const page = data ?? []
    const images = new Map<number, string | null>()
    const ids = page.map((r) => r.steam_appid)
    for (let i = 0; i < ids.length; i += STEAM_APPID_CHUNK) {
        const { data: steam } = await supabase.from('hubgames_juegos_steam').select('steam_appid, header_image').in('steam_appid', ids.slice(i, i + STEAM_APPID_CHUNK))
        for (const s of steam ?? []) images.set(s.steam_appid, s.header_image)
    }
    return { rows: page.map((r) => ({ ...r, header_image: images.get(r.steam_appid) ?? null })), error: null }
}

/**
 * Pool de juegos: reparto en una barra (recuentos de la página, sin traer filas), búsqueda y filtro en el servidor y
 * 50 filas por página con «Ver más». Estado con su color, razones en español y la relevancia en escala logarítmica.
 */
export default function PoolPanel({
    counts,
    countsError,
    countsBusy,
    lastIngest,
    onRefreshCounts,
    initialFilter,
}: {
    counts: PoolCounts | null
    countsError: string | null
    countsBusy: boolean
    /** Elegibles de la última ingesta («esta semana +5 elegibles»), si se sabe. */
    lastIngest: number | null
    onRefreshCounts: () => void
    initialFilter?: PoolFilter
}) {
    const [filter, setFilter] = useState<PoolFilter>(initialFilter ?? 'all')
    const [search, setSearch] = useState('')
    const [rows, setRows] = useState<PoolRow[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [more, setMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const seq = useRef(0)

    const load = useCallback(async (f: PoolFilter, q: string) => {
        const my = ++seq.current
        setBusy(true)
        const res = await fetchPage(f, q.trim(), 0)
        if (my !== seq.current) return
        setRows(res.rows)
        setError(res.error)
        setHasMore(res.rows.length === POOL_PAGE_SIZE)
        setBusy(false)
    }, [])

    useEffect(() => {
        const t = setTimeout(() => void load(filter, search), search ? 300 : 0)
        return () => clearTimeout(t)
    }, [filter, search, load])

    const loadMore = async () => {
        if (!rows) return
        const my = seq.current
        setMore(true)
        const res = await fetchPage(filter, search.trim(), rows.length)
        if (my !== seq.current) return
        setMore(false)
        if (res.error) {
            setError(res.error)
            return
        }
        setRows([...rows, ...res.rows])
        setHasMore(res.rows.length === POOL_PAGE_SIZE)
    }

    const refresh = () => {
        onRefreshCounts()
        void load(filter, search)
    }

    const total = counts ? counts[filter] : null
    const searching = search.trim().length >= 2
    const maxScore = rows?.[0]?.relevance_score ?? 0

    const head = <PanelHead icon={<Database />} title="Pool de juegos" count={counts ? `${fmt(counts.all)} juegos` : undefined} busy={busy || countsBusy} onRefresh={refresh} />

    if (counts && counts.all === 0)
        return (
            <section className="ad-panel">
                {head}
                <PanelEmpty icon={<Database />} tone="dash-ko" title="El pool está vacío">
                    La ingesta semanal corre los domingos a las 19:00 y añade 40 candidatos (unos 5–9 elegibles). Sin elegibles, el pick diario falla.
                </PanelEmpty>
            </section>
        )

    return (
        <section className="ad-panel">
            {head}
            {countsError && <PanelError what="los recuentos del pool" message={countsError} busy={countsBusy} onRetry={onRefreshCounts} />}
            {counts && (
                <div className="ad-split">
                    <div className="ad-stack" role="img" aria-label={SPLIT.map((k) => `${SPLIT_LABELS[k]}: ${fmt(counts[k])}`).join(', ')}>
                        {SPLIT.map((k) => (counts[k] ? <span key={k} className={POOL_STATE_META[k].tone} style={{ flexGrow: counts[k] }} /> : null))}
                    </div>
                    <ul className="ad-legend">
                        {SPLIT.map((k) => (
                            <li key={k}>
                                <span className={`ad-sw ${POOL_STATE_META[k].tone}`} aria-hidden />
                                {SPLIT_LABELS[k]} <b>{fmt(counts[k])}</b> <em>{sharePercent(counts[k], counts.all)} %</em>
                            </li>
                        ))}
                        {lastIngest !== null && (
                            <li className="ad-legend__note">
                                · la última ingesta, <b>+{lastIngest}</b> elegibles; se gastan 7 a la semana
                            </li>
                        )}
                    </ul>
                </div>
            )}
            <div className="ad-tools">
                <label className="ad-search">
                    <Search aria-hidden />
                    <input
                        type="search"
                        className="hg-input"
                        placeholder="Buscar en el pool…"
                        aria-label="Buscar juego en el pool"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
                <Segmented
                    value={filter}
                    options={POOL_FILTERS}
                    labels={POOL_FILTER_LABELS}
                    counts={counts ?? undefined}
                    icons={{
                        unused: <CircleCheck className="ad-ink dash-ok" aria-hidden />,
                        used: <Check className="ad-ink st-todos" aria-hidden />,
                        inel: <Ban className="ad-ink dash-warn" aria-hidden />,
                        disc: <EyeOff className="ad-ink dash-ko" aria-hidden />,
                    }}
                    countClassName={(o, c) => (o === 'all' ? `ad-cnt${c ? '' : ' is-zero'}` : `ad-cnt hg-tint ${POOL_STATE_META[o].tone}${c ? '' : ' is-zero'}`)}
                    onChange={setFilter}
                    scroll
                    aria-label="Filtrar el pool"
                />
            </div>
            {error && !rows?.length ? (
                <PanelError what="el pool" message={error} busy={busy} onRetry={() => void load(filter, search)} />
            ) : !rows ? (
                <PanelLoading />
            ) : !rows.length ? (
                searching ? (
                    <PanelEmpty icon={<Search />} title={`Ningún juego del pool coincide con «${search.trim()}»`}>
                        La búsqueda mira el nombre en todo el pool{filter !== 'all' ? `, dentro de «${POOL_FILTER_LABELS[filter]}»` : ''}.
                    </PanelEmpty>
                ) : (
                    <PanelEmpty icon={<Database />} title="Nada con este filtro" />
                )
            ) : (
                <>
                    <div className="ad-th ad-g-pool" aria-hidden>
                        <span>Juego</span>
                        <span>Estado</span>
                        <span>Razones</span>
                        <span className="ad-x-wide ad-right">Relevancia</span>
                        <span className="ad-x-wide">Semana</span>
                    </div>
                    <ul className={`ad-list${busy ? ' is-busy' : ''}`} aria-busy={busy}>
                        {rows.map((r) => {
                            const st = poolState(r)
                            const meta = POOL_STATE_META[st]
                            const Icon = STATE_ICON[st]
                            const score = r.relevance_score.toLocaleString('es-ES', { maximumFractionDigits: 1 })
                            const reasons = r.discarded
                                ? [r.discarded_reason ?? 'discarded']
                                : (r.eligibility_reasons ?? [])
                            return (
                                <li key={r.id} className="ad-item">
                                    <div className="ad-row ad-g-pool">
                                        <span className="ad-x-main ad-name">
                                            <Cap src={r.header_image} name={r.game_name} />
                                            <span className="ad-name__text">
                                                <span className="ad-name__t">{r.game_name}</span>
                                                <span className="ad-name__s">{r.steam_appid}</span>
                                            </span>
                                        </span>
                                        <span className="ad-x-top">
                                            <span className={`hg-chip hg-tint ad-status ${meta.tone}`}>
                                                <Icon aria-hidden />
                                                {meta.label}
                                                {st === 'used' && r.selected_daily_date ? ` · ${isoDayShort(r.selected_daily_date)}` : ''}
                                            </span>
                                        </span>
                                        <span className="ad-x-main ad-reasons">
                                            {reasons.length ? (
                                                reasons.map((x) => (
                                                    <span key={x} className={`ad-reason${r.discarded ? ' is-ko' : ''}`}>
                                                        {poolReasonLabel(x)}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="ad-muted">—</span>
                                            )}
                                        </span>
                                        <span className="ad-x-wide ad-score">
                                            {score}
                                            <i aria-hidden>
                                                <span style={{ width: `${Math.round(relevanceShare(r.relevance_score, maxScore) * 100)}%` }} />
                                            </i>
                                        </span>
                                        <span className="ad-x-wide ad-muted">{isoDayShort(r.week_start_date)}</span>
                                        <span className="ad-x-end ad-muted">{score}</span>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                    <PanelFoot
                        shown={rows.length}
                        total={total !== null && !searching ? fmt(total) : hasMore ? 'más' : fmt(rows.length)}
                        more={hasMore ? `Ver ${POOL_PAGE_SIZE} más` : null}
                        onMore={() => void loadMore()}
                        loading={more}
                    />
                </>
            )}
        </section>
    )
}
