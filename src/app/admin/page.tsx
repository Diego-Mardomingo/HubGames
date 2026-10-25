'use client'

import './admin.css'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase, safeGetUser } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Loader2, CheckCircle2, XCircle, Search,
    Database, CalendarDays, FileText, RefreshCw,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Json } from '@/lib/supabase/database.types'


/** PostgREST limita filas por petición; pedimos en páginas hasta traer todo el pool. */
const ADMIN_POOL_PAGE_SIZE = 1000
const ADMIN_STEAM_APPID_CHUNK = 200

// ─── Types ───────────────────────────────────────────────────────────────────

type LogRow = {
    id: number
    fecha_ejecucion: string | null
    exito: boolean
    fuente: string | null
    nombre_juego: string | null
    fecha_judi: string | null
    error_mensaje: string | null
    error_stack: string | null
    id_juego_steam: number | null
    id_juego_rawg: number | null
}

type PoolRow = {
    id: number
    steam_appid: number
    game_name: string
    relevance_score: number
    is_eligible: boolean
    selected_for_daily: boolean
    discarded: boolean
    discarded_reason: string | null
    eligibility_reasons: string[]
    week_start_date: string
    header_image?: string | null
}

type DailyRow = {
    id: number
    steam_appid: number | null
    nombre: string
    fecha: string
    calificacion: number
    header_image?: string | null
    isFuture?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseLegacyDate(date: string): Date | null {
    const parts = date.split('-')
    if (parts.length !== 3) return null
    const [dd, mm, yyyy] = parts
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    if (Number.isNaN(d.getTime())) return null
    return d
}

function formatLegacyDateNice(date: string): string {
    const d = parseLegacyDate(date)
    if (!d) return date
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getMadridTodayLegacy(): string {
    const ymd = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
    const [y, m, d] = ymd.split('-')
    return `${d}-${m}-${y}`
}

function fuente2Label(fuente: string | null): string {
    if (!fuente) return '—'
    if (fuente === 'steam_pool_daily_pick') return 'Juego del día'
    if (fuente === 'steam_weekly_pool') return 'Ingesta pool'
    if (fuente === 'steam_pool_edge_function') return 'Edge function'
    return fuente
}

function formatLogMadrid(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
    return <Loader2 size={size} className="hg-spin" style={{ color: 'var(--muted)' }} aria-label="Cargando" />
}

function LogDetailDialog({
    log,
    open,
    onOpenChange,
}: {
    log: LogRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="admin-log-dialog">
                {log ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>
                                Log #{log.id}
                            </DialogTitle>
                            <p className="admin-log-dialog__sub">
                                {fuente2Label(log.fuente)}
                                {' · '}
                                {log.exito ? (
                                    <span className="admin-ok">Correcto</span>
                                ) : (
                                    <span className="admin-ko">Fallido</span>
                                )}
                            </p>
                        </DialogHeader>

                        <dl className="admin-log-detail">
                            <div className="admin-log-detail__row">
                                <dt>Fecha ejecución (Madrid)</dt>
                                <dd className="admin-cell-num">{formatLogMadrid(log.fecha_ejecucion)}</dd>
                            </div>
                            <div className="admin-log-detail__row">
                                <dt>Fuente (raw)</dt>
                                <dd className="admin-cell-num">{log.fuente || '—'}</dd>
                            </div>
                            <div className="admin-log-detail__row">
                                <dt>Fecha JUDI</dt>
                                <dd className="admin-cell-num">{log.fecha_judi || '—'}</dd>
                            </div>
                            <div className="admin-log-detail__row">
                                <dt>Descripción / juego</dt>
                                <dd>{log.nombre_juego || '—'}</dd>
                            </div>
                            <div className="admin-log-detail__row">
                                <dt>Steam app ID</dt>
                                <dd className="admin-cell-num">{log.id_juego_steam ?? '—'}</dd>
                            </div>
                            <div className="admin-log-detail__row">
                                <dt>RAWG id</dt>
                                <dd className="admin-cell-num">{log.id_juego_rawg ?? '—'}</dd>
                            </div>
                            <div className="admin-log-detail__row admin-log-detail__row--block">
                                <dt>Mensaje de error</dt>
                                <dd className="admin-log-detail__pre-wrap">{log.error_mensaje || '—'}</dd>
                            </div>
                            {log.error_stack ? (
                                <div className="admin-log-detail__row admin-log-detail__row--block">
                                    <dt>Stack / detalle</dt>
                                    <dd>
                                        <pre className="admin-log-detail__stack">{log.error_stack}</pre>
                                    </dd>
                                </div>
                            ) : null}
                        </dl>
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

function PanelHead({
    icon, title, count, onRefresh, loading,
}: {
    icon: React.ReactNode
    title: string
    count?: number
    onRefresh: () => void
    loading: boolean
}) {
    return (
        <div className="admin-panel-head">
            <div className="admin-panel-head__title">
                {icon}
                {title}
                {count !== undefined && (
                    <span className="admin-panel-head__count">{count}</span>
                )}
            </div>
            <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="hg-icon-btn admin-refresh-btn"
                title="Actualizar"
                aria-label="Actualizar"
            >
                <RefreshCw size={15} className={loading ? 'hg-spin' : ''} aria-hidden />
            </button>
        </div>
    )
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTab() {
    const [logs, setLogs] = useState<LogRow[]>([])
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'daily' | 'pool'>('all')
    const [detailLog, setDetailLog] = useState<LogRow | null>(null)

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        setFetchError(null)
        const { data, error } = await supabase
            .from('hubgames_judi_generacion_logs')
            .select('*')
            .order('fecha_ejecucion', { ascending: false })
            .limit(100)
        if (error) {
            setFetchError(error.message || 'No se pudieron cargar los logs')
            setLogs([])
        } else {
            setLogs(data ?? [])
        }
        setLoading(false)
    }, [])

    useEffect(() => { void fetchLogs() }, [fetchLogs])

    const filtered = logs.filter((l) => {
        if (filter === 'daily') return l.fuente === 'steam_pool_daily_pick' || l.fuente === 'steam_pool_edge_function'
        if (filter === 'pool') return l.fuente === 'steam_weekly_pool'
        return true
    })

    return (
        <div className="admin-panel">
            <PanelHead
                icon={<FileText size={15} aria-hidden />}
                title="Logs de generación"
                count={filtered.length}
                onRefresh={fetchLogs}
                loading={loading}
            />

            <div className="admin-filters">
                <div className="hg-seg hg-seg--scroll" role="group" aria-label="Filtrar logs">
                {([
                    { key: 'all', label: 'Todos' },
                    { key: 'daily', label: 'Juego del día' },
                    { key: 'pool', label: 'Ingesta pool' },
                ] as const).map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        className="hg-seg__opt"
                        aria-pressed={filter === key}
                    >
                        {label}
                    </button>
                ))}
                </div>
            </div>

            {fetchError && (
                <div className="alert alert--error admin-error">
                    Error al cargar logs: {fetchError}
                </div>
            )}

            {loading ? (
                <div className="admin-center"><Spinner /></div>
            ) : !fetchError && filtered.length === 0 ? (
                <div className="admin-empty">Sin registros para este filtro</div>
            ) : fetchError ? null : (
                <div className="admin-table-wrap">
                    <table className="admin-table admin-table--logs">
                        <thead>
                            <tr>
                                <th>Estado</th>
                                <th>Tipo</th>
                                <th>Juego / Descripción</th>
                                <th>Fecha JUDI</th>
                                <th>Registrado (Madrid)</th>
                                <th>Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((log) => (
                                <tr
                                    key={log.id}
                                    className={`${log.exito ? '' : 'admin-row-error'} admin-log-row--clickable`}
                                    role="button"
                                    tabIndex={0}
                                    title="Ver detalles del log"
                                    onClick={() => setDetailLog(log)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault()
                                            setDetailLog(log)
                                        }
                                    }}
                                >
                                    <td data-label="Estado">
                                        {log.exito
                                            ? <CheckCircle2 size={16} className="admin-ok" aria-label="Correcto" />
                                            : <XCircle size={16} className="admin-ko" aria-label="Fallido" />}
                                    </td>
                                    <td data-label="Tipo">
                                        <Badge variant={log.fuente === 'steam_weekly_pool' ? 'muted' : 'default'}>
                                            {fuente2Label(log.fuente)}
                                        </Badge>
                                    </td>
                                    <td className="admin-cell-name" data-label="Juego / Descripción" title={log.nombre_juego || undefined}>
                                        {log.nombre_juego || '—'}
                                    </td>
                                    <td className="admin-cell-num admin-cell-muted" data-label="Fecha JUDI">{log.fecha_judi || '—'}</td>
                                    <td className="admin-cell-num admin-cell-muted" data-label="Registrado (Madrid)">
                                        {formatLogMadrid(log.fecha_ejecucion)}
                                    </td>
                                    <td className={log.error_mensaje ? 'admin-cell-error' : 'admin-cell-muted'} data-label="Error" title={log.error_mensaje || undefined}>
                                        {log.error_mensaje || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <LogDetailDialog
                log={detailLog}
                open={detailLog !== null}
                onOpenChange={(o) => {
                    if (!o) setDetailLog(null)
                }}
            />
        </div>
    )
}

// ─── Steam Sync Tab ───────────────────────────────────────────────────────────

type SyncLogRow = {
    id: number
    user_id: string
    source: string
    status: string
    started_at: string
    finished_at: string | null
    stats: Json | null
    error: string | null
}

const SYNC_STATUS: Record<string, { label: string; variant: 'default' | 'muted' }> = {
    ok: { label: 'OK', variant: 'default' },
    parcial: { label: 'Parcial', variant: 'muted' },
    error: { label: 'Error', variant: 'muted' },
    en_curso: { label: 'En curso', variant: 'muted' },
}

function syncSummary(stats: Json | null): string {
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return '—'
    const s = stats as {
        library?: { ownedGames?: number; newToTray?: number; catalogFetched?: number }
        snapshotRows?: number
        achievements?: { gamesSynced?: number; apiCalls?: number }
        tracker?: { toPlaying?: number }
    }
    return [
        `${s.library?.ownedGames ?? 0} juegos`,
        `${s.library?.newToTray ?? 0} nuevos`,
        `${s.library?.catalogFetched ?? 0} fichas`,
        `${s.snapshotRows ?? 0} fotos de horas`,
        `${s.achievements?.gamesSynced ?? 0} con logros revisados`,
        `${s.achievements?.apiCalls ?? 0} llamadas`,
        `${s.tracker?.toPlaying ?? 0} a Jugando`,
    ].join(' · ')
}

function durationLabel(start: string, end: string | null): string {
    if (!end) return '—'
    const seconds = Math.round((Date.parse(end) - Date.parse(start)) / 1000)
    return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

function SyncLogsTab() {
    const [logs, setLogs] = useState<SyncLogRow[]>([])
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState<string | null>(null)

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        setFetchError(null)
        const { data, error } = await supabase
            .from('hubgames_sync_logs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(100)
        if (error) {
            setFetchError(error.message || 'No se pudieron cargar los logs')
            setLogs([])
        } else {
            setLogs(data ?? [])
        }
        setLoading(false)
    }, [])

    useEffect(() => { void fetchLogs() }, [fetchLogs])

    return (
        <div className="admin-panel">
            <PanelHead
                icon={<RefreshCw size={15} aria-hidden />}
                title="Sincronizaciones con Steam"
                count={logs.length}
                onRefresh={fetchLogs}
                loading={loading}
            />

            {fetchError && (
                <div className="alert alert--error admin-error">
                    Error al cargar logs: {fetchError}
                </div>
            )}

            {loading ? (
                <div className="admin-center"><Spinner /></div>
            ) : !fetchError && logs.length === 0 ? (
                <div className="admin-empty">Todavía no hay sincronizaciones</div>
            ) : fetchError ? null : (
                <div className="admin-table-wrap">
                    <table className="admin-table admin-table--logs">
                        <thead>
                            <tr>
                                <th>Estado</th>
                                <th>Origen</th>
                                <th>Usuario</th>
                                <th>Inicio (Madrid)</th>
                                <th>Duración</th>
                                <th>Resumen / Error</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => {
                                const status = SYNC_STATUS[log.status] ?? { label: log.status, variant: 'muted' as const }
                                return (
                                    <tr key={log.id} className={log.status === 'error' ? 'admin-row-error' : ''}>
                                        <td data-label="Estado">
                                            {log.status === 'ok'
                                                ? <CheckCircle2 size={16} className="admin-ok" aria-label="Correcto" />
                                                : log.status === 'error'
                                                    ? <XCircle size={16} className="admin-ko" aria-label="Fallido" />
                                                    : <Badge variant={status.variant}>{status.label}</Badge>}
                                        </td>
                                        <td data-label="Origen">
                                            <Badge variant={log.source === 'cron' ? 'muted' : 'default'}>
                                                {log.source === 'cron' ? 'Diaria' : 'Manual'}
                                            </Badge>
                                        </td>
                                        <td className="admin-cell-num admin-cell-muted" data-label="Usuario" title={log.user_id}>
                                            {log.user_id.slice(0, 8)}
                                        </td>
                                        <td className="admin-cell-num admin-cell-muted" data-label="Inicio (Madrid)">
                                            {formatLogMadrid(log.started_at)}
                                        </td>
                                        <td className="admin-cell-num admin-cell-muted" data-label="Duración">
                                            {durationLabel(log.started_at, log.finished_at)}
                                        </td>
                                        {log.error ? (
                                            <td className="admin-cell-error" data-label="Error" title={log.error}>{log.error}</td>
                                        ) : (
                                            <td className="admin-cell-name" data-label="Resumen" title={syncSummary(log.stats)}>
                                                {syncSummary(log.stats)}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ─── Pool Tab ─────────────────────────────────────────────────────────────────

function PoolTab() {
    const [items, setItems] = useState<PoolRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterElig, setFilterElig] = useState<'all' | 'eligible' | 'ineligible' | 'discarded'>('all')
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const fetchPool = useCallback(async (q: string) => {
        setLoading(true)
        const search = q.trim()
        const poolRows: Omit<PoolRow, 'header_image'>[] = []
        let from = 0
        for (;;) {
            let query = supabase
                .from('hubgames_judi_pool')
                .select('id, steam_appid, game_name, relevance_score, is_eligible, selected_for_daily, discarded, discarded_reason, eligibility_reasons, week_start_date')
                .order('relevance_score', { ascending: false })
                .range(from, from + ADMIN_POOL_PAGE_SIZE - 1)

            if (search.length >= 2) {
                query = query.ilike('game_name', `%${search}%`)
            }

            const { data: page, error } = await query
            if (error) {
                console.error('[admin pool]', error.message)
                setItems([])
                setLoading(false)
                return
            }
            if (!page?.length) break
            poolRows.push(...(page as Omit<PoolRow, 'header_image'>[]))
            if (page.length < ADMIN_POOL_PAGE_SIZE) break
            from += ADMIN_POOL_PAGE_SIZE
        }

        if (poolRows.length === 0) {
            setItems([])
            setLoading(false)
            return
        }

        const appIds = poolRows.map((r) => r.steam_appid).filter(Boolean)
        const imageMap = new Map<number, string | null>()
        for (let i = 0; i < appIds.length; i += ADMIN_STEAM_APPID_CHUNK) {
            const chunk = appIds.slice(i, i + ADMIN_STEAM_APPID_CHUNK)
            const { data: steamData } = await supabase
                .from('hubgames_juegos_steam')
                .select('steam_appid, header_image')
                .in('steam_appid', chunk)
            for (const s of steamData ?? []) {
                imageMap.set(s.steam_appid, s.header_image)
            }
        }

        setItems(poolRows.map((r) => ({
            ...r,
            header_image: imageMap.get(r.steam_appid) ?? null,
        })))
        setLoading(false)
    }, [])

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => { void fetchPool(search) }, 300)
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    }, [search, fetchPool])

    const filtered = items.filter((item) => {
        if (filterElig === 'eligible') return item.is_eligible && !item.discarded
        if (filterElig === 'ineligible') return !item.is_eligible && !item.discarded
        if (filterElig === 'discarded') return item.discarded
        return true
    })

    return (
        <div className="admin-panel">
            <PanelHead
                icon={<Database size={15} aria-hidden />}
                title="Pool de juegos"
                count={filtered.length}
                onRefresh={() => fetchPool(search)}
                loading={loading}
            />

            <div className="admin-search-area">
                <div className="admin-search-wrap">
                    <Search size={15} className="admin-search-icon" aria-hidden />
                    <Input
                        aria-label="Buscar juego en el pool"
                        placeholder="Buscar juego en el pool…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="admin-search-input"
                    />
                </div>
            </div>

            <div className="admin-filters">
                <div className="hg-seg hg-seg--scroll" role="group" aria-label="Filtrar el pool">
                {([
                    { key: 'all', label: 'Todos' },
                    { key: 'eligible', label: 'Elegibles' },
                    { key: 'ineligible', label: 'No elegibles' },
                    { key: 'discarded', label: 'Descartados' },
                ] as const).map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setFilterElig(key)}
                        className="hg-seg__opt"
                        aria-pressed={filterElig === key}
                    >
                        {label}
                    </button>
                ))}
                </div>
            </div>

            {loading ? (
                <div className="admin-center"><Spinner /></div>
            ) : filtered.length === 0 ? (
                <div className="admin-empty">Sin resultados</div>
            ) : (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Juego</th>
                                <th>Estado</th>
                                <th>Score</th>
                                <th>Razones</th>
                                <th>Semana</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <div className="admin-game-cell">
                                            {item.header_image && (
                                                <Image
                                                    src={item.header_image}
                                                    alt={item.game_name}
                                                    width={60}
                                                    height={28}
                                                    className="admin-game-thumb"
                                                    unoptimized
                                                />
                                            )}
                                            <div>
                                                <div className="admin-cell-name">{item.game_name}</div>
                                                <div className="admin-cell-sub">
                                                    {item.steam_appid}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="admin-status-stack">
                                            {item.discarded
                                                ? <Badge variant="danger">Descartado</Badge>
                                                : item.is_eligible
                                                    ? <Badge variant="success">Elegible</Badge>
                                                    : <Badge variant="muted">No elegible</Badge>}
                                            {item.selected_for_daily && (
                                                <Badge variant="default">Usado</Badge>
                                            )}
                                        </div>
                                    </td>
                                    <td className="admin-cell-num admin-cell-muted">
                                        {item.relevance_score?.toFixed(1) ?? '—'}
                                    </td>
                                    <td>
                                        <div className="admin-reasons">
                                            {item.discarded_reason && (
                                                <span className="admin-reason-tag admin-reason-tag--discard">
                                                    {item.discarded_reason}
                                                </span>
                                            )}
                                            {(item.eligibility_reasons ?? []).map((r) => (
                                                <span key={r} className="admin-reason-tag">{r}</span>
                                            ))}
                                            {!item.discarded_reason && (item.eligibility_reasons ?? []).length === 0 && (
                                                <span className="admin-cell-muted">—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="admin-cell-num admin-cell-muted">{item.week_start_date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function DailyTable({ rows }: { rows: DailyRow[] }) {
    if (rows.length === 0) return <div className="admin-empty">Sin registros</div>
    return (
        <div className="admin-table-wrap">
            <table className="admin-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Juego</th>
                        <th>Metacritic</th>
                        <th>#</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id} className={row.isFuture ? 'admin-row-future' : ''}>
                            <td>
                                <div className="admin-cell-num">{row.fecha}</div>
                                <div className="admin-cell-sub">
                                    {formatLegacyDateNice(row.fecha)}
                                </div>
                            </td>
                            <td>
                                <div className="admin-game-cell">
                                    {row.header_image && (
                                        <Image
                                            src={row.header_image}
                                            alt={row.nombre}
                                            width={60}
                                            height={28}
                                            className="admin-game-thumb"
                                            unoptimized
                                        />
                                    )}
                                    <span className="admin-cell-name">{row.nombre}</span>
                                </div>
                            </td>
                            <td className="admin-cell-num admin-cell-muted">{row.calificacion || '—'}</td>
                            <td className="admin-cell-num admin-cell-muted">{row.id}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function CalendarTab() {
    const [items, setItems] = useState<DailyRow[]>([])
    const [loading, setLoading] = useState(true)

    const fetchDaily = useCallback(async () => {
        setLoading(true)
        const { data: dailyData } = await supabase
            .from('hubgames_lista_videojuegos_judi')
            .select('id, steam_appid, nombre, fecha, calificacion')
            .order('id', { ascending: false })
            .limit(180)

        if (!dailyData || dailyData.length === 0) {
            setItems([])
            setLoading(false)
            return
        }

        const appIds = dailyData.map((r) => r.steam_appid).filter((id): id is number => id != null)
        const { data: steamData } = await supabase
            .from('hubgames_juegos_steam')
            .select('steam_appid, header_image')
            .in('steam_appid', appIds)

        const imageMap = new Map((steamData ?? []).map((s) => [s.steam_appid, s.header_image]))

        const todayLegacy = getMadridTodayLegacy()
        const todayDate = parseLegacyDate(todayLegacy)

        setItems(dailyData.map((r) => {
            const gameDate = parseLegacyDate(r.fecha)
            const isFuture = gameDate && todayDate ? gameDate > todayDate : false
            return { ...r, header_image: (r.steam_appid != null ? imageMap.get(r.steam_appid) : null) ?? null, isFuture }
        }))
        setLoading(false)
    }, [])

    useEffect(() => { void fetchDaily() }, [fetchDaily])

    const future = items.filter((i) => i.isFuture)
    const past = items.filter((i) => !i.isFuture)

    return (
        <div className="admin-panel">
            <PanelHead
                icon={<CalendarDays size={15} aria-hidden />}
                title="Juegos programados"
                count={items.length}
                onRefresh={fetchDaily}
                loading={loading}
            />

            {loading ? (
                <div className="admin-center"><Spinner /></div>
            ) : (
                <div className={future.length > 0 ? 'admin-groups' : undefined}>
                    {future.length > 0 && (
                        <div className="admin-group">
                            <div className="admin-group-label admin-group-label--future">
                                Próximos, todavía no visibles ({future.length})
                            </div>
                            <div className="admin-panel">
                                <DailyTable rows={future} />
                            </div>
                        </div>
                    )}

                    <div className="admin-group">
                        <div className="admin-group-label">
                            Publicados ({past.length})
                        </div>
                        <div className={future.length > 0 ? 'admin-panel' : undefined}>
                            <DailyTable rows={past} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
    const router = useRouter()
    const [authChecked, setAuthChecked] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const [adminEmail, setAdminEmail] = useState('')

    // El proxy ya protege /admin en el servidor; esto es solo una segunda comprobación en cliente.
    useEffect(() => {
        Promise.all([safeGetUser(), supabase.rpc('is_admin')])
            .then(([{ data: { user } }, { data: admin }]) => {
                if (user && admin === true) {
                    setAdminEmail(user.email ?? '')
                    setIsAdmin(true)
                } else {
                    router.replace('/')
                }
                setAuthChecked(true)
            })
            .catch(() => {
                router.replace('/')
                setAuthChecked(true)
            })
    }, [router])

    if (!authChecked) {
        return (
            <div className="admin-loading">
                <div className="loader" />
            </div>
        )
    }

    if (!isAdmin) return null

    return (
        <div className="admin-page">
            <header className="page-head admin-head">
                <div>
                    <h1 className="page-title">Administración</h1>
                    <p className="page-subtitle">{adminEmail}</p>
                </div>
            </header>

            {/* Tabs */}
            <Tabs defaultValue="logs">
                <TabsList className="hg-seg--scroll admin-tabs-list">
                    <TabsTrigger value="logs">
                        <FileText aria-hidden />
                        Logs
                    </TabsTrigger>
                    <TabsTrigger value="steam">
                        <RefreshCw aria-hidden />
                        Steam
                    </TabsTrigger>
                    <TabsTrigger value="pool">
                        <Database aria-hidden />
                        Pool
                    </TabsTrigger>
                    <TabsTrigger value="calendar">
                        <CalendarDays aria-hidden />
                        Calendario
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="logs">
                    <LogsTab />
                </TabsContent>
                <TabsContent value="steam">
                    <SyncLogsTab />
                </TabsContent>
                <TabsContent value="pool">
                    <PoolTab />
                </TabsContent>
                <TabsContent value="calendar">
                    <CalendarTab />
                </TabsContent>
            </Tabs>
        </div>
    )
}
