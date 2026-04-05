'use client'

import './admin.css'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { supabase, safeGetUser } from '@/lib/supabase/client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Loader2, CheckCircle2, XCircle, Search,
    Shield, Database, CalendarDays, FileText, RefreshCw,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const ADMIN_EMAIL = 'diego.lopez.mardomingo@gmail.com'

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
    return <Loader2 size={size} className="animate-spin" style={{ color: 'var(--muted)' }} />
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
            <DialogContent
                className={cn(
                    'gap-0 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-6',
                    'max-h-[min(88vh,88dvh)] sm:max-h-[85vh]',
                    'w-[min(100vw-1.25rem,42rem)] max-w-[min(100vw-1.25rem,42rem)] sm:max-w-2xl',
                )}
            >
                {log ? (
                    <>
                        <DialogHeader className="pr-8">
                            <DialogTitle className="text-base font-semibold">
                                Log #{log.id}
                            </DialogTitle>
                            <p className="text-sm font-normal text-[var(--muted)]">
                                {fuente2Label(log.fuente)}
                                {' · '}
                                {log.exito ? (
                                    <span style={{ color: 'var(--success)' }}>Correcto</span>
                                ) : (
                                    <span style={{ color: 'var(--danger)' }}>Fallido</span>
                                )}
                            </p>
                        </DialogHeader>

                        <dl className="admin-log-detail">
                            <div className="admin-log-detail__row">
                                <dt>Fecha ejecución (Madrid)</dt>
                                <dd className="admin-cell-mono">{formatLogMadrid(log.fecha_ejecucion)}</dd>
                            </div>
                            <div className="admin-log-detail__row">
                                <dt>Fuente (raw)</dt>
                                <dd className="admin-cell-mono">{log.fuente || '—'}</dd>
                            </div>
                            <div className="admin-log-detail__row">
                                <dt>Fecha JUDI</dt>
                                <dd className="admin-cell-mono">{log.fecha_judi || '—'}</dd>
                            </div>
                            <div className="admin-log-detail__row">
                                <dt>Descripción / juego</dt>
                                <dd>{log.nombre_juego || '—'}</dd>
                            </div>
                            <div className="admin-log-detail__row">
                                <dt>Steam app ID</dt>
                                <dd className="admin-cell-mono">{log.id_juego_steam ?? '—'}</dd>
                            </div>
                            <div className="admin-log-detail__row">
                                <dt>RAWG id</dt>
                                <dd className="admin-cell-mono">{log.id_juego_rawg ?? '—'}</dd>
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
                onClick={onRefresh}
                disabled={loading}
                className="admin-refresh-btn"
                title="Actualizar"
            >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
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
                icon={<FileText size={14} />}
                title="Logs de generación"
                count={filtered.length}
                onRefresh={fetchLogs}
                loading={loading}
            />

            <div className="admin-filters">
                {([
                    { key: 'all', label: 'Todos' },
                    { key: 'daily', label: 'Juego del día' },
                    { key: 'pool', label: 'Ingesta pool' },
                ] as const).map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`admin-filter-pill ${filter === key ? 'active' : ''}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {fetchError && (
                <div className="admin-empty" style={{ color: 'var(--danger)', marginBottom: 12 }}>
                    Error al cargar logs: {fetchError}
                </div>
            )}

            {loading ? (
                <div className="admin-center"><Spinner /></div>
            ) : !fetchError && filtered.length === 0 ? (
                <div className="admin-empty">Sin registros para este filtro</div>
            ) : fetchError ? null : (
                <div className="admin-table-wrap admin-table-wrap--logs">
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
                                            ? <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                                            : <XCircle size={15} style={{ color: 'var(--danger)' }} />}
                                    </td>
                                    <td data-label="Tipo">
                                        <Badge variant={log.fuente === 'steam_weekly_pool' ? 'muted' : 'default'}>
                                            {fuente2Label(log.fuente)}
                                        </Badge>
                                    </td>
                                    <td className="admin-cell-name" data-label="Juego / Descripción" title={log.nombre_juego || undefined}>
                                        {log.nombre_juego || '—'}
                                    </td>
                                    <td className="admin-cell-mono admin-cell-muted" data-label="Fecha JUDI">{log.fecha_judi || '—'}</td>
                                    <td className="admin-cell-mono admin-cell-muted" data-label="Registrado (Madrid)">
                                        {formatLogMadrid(log.fecha_ejecucion)}
                                    </td>
                                    <td className="admin-cell-error" data-label="Error" title={log.error_mensaje || undefined}>
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
                icon={<Database size={14} />}
                title="Pool de juegos"
                count={filtered.length}
                onRefresh={() => fetchPool(search)}
                loading={loading}
            />

            <div className="admin-search-area">
                <div className="admin-search-wrap">
                    <Search size={13} className="admin-search-icon" />
                    <Input
                        placeholder="Buscar juego en el pool..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="admin-search-input"
                    />
                </div>
            </div>

            <div className="admin-filters">
                {([
                    { key: 'all', label: 'Todos' },
                    { key: 'eligible', label: 'Elegibles' },
                    { key: 'ineligible', label: 'No elegibles' },
                    { key: 'discarded', label: 'Descartados' },
                ] as const).map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilterElig(key)}
                        className={`admin-filter-pill ${filterElig === key ? 'active' : ''}`}
                    >
                        {label}
                    </button>
                ))}
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
                                                <div className="admin-cell-muted admin-cell-mono" style={{ fontSize: 11 }}>
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
                                    <td className="admin-cell-mono admin-cell-muted">
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
                                                <span className="admin-cell-muted" style={{ fontSize: 12 }}>—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="admin-cell-mono admin-cell-muted">{item.week_start_date}</td>
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
                                <div className="admin-cell-mono">{row.fecha}</div>
                                <div className="admin-cell-muted" style={{ fontSize: 11 }}>
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
                            <td className="admin-cell-mono admin-cell-muted">{row.calificacion || '—'}</td>
                            <td className="admin-cell-mono admin-cell-muted">{row.id}</td>
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

        const appIds = dailyData.map((r) => r.steam_appid).filter(Boolean)
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
            return { ...r, header_image: imageMap.get(r.steam_appid) ?? null, isFuture }
        }))
        setLoading(false)
    }, [])

    useEffect(() => { void fetchDaily() }, [fetchDaily])

    const future = items.filter((i) => i.isFuture)
    const past = items.filter((i) => !i.isFuture)

    return (
        <div className="admin-panel">
            <PanelHead
                icon={<CalendarDays size={14} />}
                title="Juegos programados"
                count={items.length}
                onRefresh={fetchDaily}
                loading={loading}
            />

            {loading ? (
                <div className="admin-center"><Spinner /></div>
            ) : (
                <div style={{ padding: future.length > 0 ? '1rem' : 0 }}>
                    {future.length > 0 && (
                        <div className="admin-group">
                            <div className="admin-group-label admin-group-label--future">
                                Próximos — no visibles al público ({future.length})
                            </div>
                            <div className="admin-panel" style={{ marginBottom: 0 }}>
                                <DailyTable rows={future} />
                            </div>
                        </div>
                    )}

                    <div className="admin-group" style={{ marginBottom: 0 }}>
                        <div className="admin-group-label">
                            Publicados ({past.length})
                        </div>
                        <div className={future.length > 0 ? 'admin-panel' : ''} style={{ marginBottom: 0 }}>
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

    useEffect(() => {
        safeGetUser()
            .then(({ data: { user } }) => {
                if (user?.email === ADMIN_EMAIL) {
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
        <div className="admin-page animate-fade-in-up">
            {/* Topbar — igual que perfil */}
            <header className="admin-topbar admin-topbar--responsive">
                <div className="admin-topbar__left">
                    <div className="admin-topbar__icon">
                        <Shield size={16} />
                    </div>
                    <div>
                        <h1 className="admin-topbar__title">Panel de Administración</h1>
                        <p className="admin-topbar__sub">{ADMIN_EMAIL}</p>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <Tabs defaultValue="logs">
                <div className="admin-tabs-scroll">
                <TabsList className="admin-tabs-list">
                    <TabsTrigger value="logs" className="admin-tab-trigger">
                        <FileText size={13} />
                        Logs
                    </TabsTrigger>
                    <TabsTrigger value="pool" className="admin-tab-trigger">
                        <Database size={13} />
                        Pool
                    </TabsTrigger>
                    <TabsTrigger value="calendar" className="admin-tab-trigger">
                        <CalendarDays size={13} />
                        Calendario
                    </TabsTrigger>
                </TabsList>
                </div>

                <TabsContent value="logs">
                    <LogsTab />
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
