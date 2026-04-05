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
    Shield, Database, CalendarDays, FileText, RefreshCw,
} from 'lucide-react'

const ADMIN_EMAIL = 'diego.lopez.mardomingo@gmail.com'

// ─── Types ───────────────────────────────────────────────────────────────────

type LogRow = {
    id: number
    created_at: string
    exito: boolean
    fuente: string
    nombre_juego: string
    fecha_judi: string
    error_mensaje: string | null
    id_juego_steam: number | null
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

function fuente2Label(fuente: string): string {
    if (fuente === 'steam_pool_daily_pick') return 'Juego del día'
    if (fuente === 'steam_weekly_pool') return 'Ingesta pool'
    if (fuente === 'steam_pool_edge_function') return 'Edge function'
    return fuente
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
    return <Loader2 size={size} className="animate-spin" style={{ color: 'var(--muted)' }} />
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
    const [filter, setFilter] = useState<'all' | 'daily' | 'pool'>('all')

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('hubgames_judi_generacion_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)
        setLogs(data ?? [])
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

            {loading ? (
                <div className="admin-center"><Spinner /></div>
            ) : filtered.length === 0 ? (
                <div className="admin-empty">Sin registros para este filtro</div>
            ) : (
                <div className="admin-table-wrap">
                    <table className="admin-table">
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
                                <tr key={log.id} className={log.exito ? '' : 'admin-row-error'}>
                                    <td>
                                        {log.exito
                                            ? <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                                            : <XCircle size={15} style={{ color: 'var(--danger)' }} />}
                                    </td>
                                    <td>
                                        <Badge variant={log.fuente === 'steam_weekly_pool' ? 'muted' : 'default'}>
                                            {fuente2Label(log.fuente)}
                                        </Badge>
                                    </td>
                                    <td className="admin-cell-name" title={log.nombre_juego || undefined}>
                                        {log.nombre_juego || '—'}
                                    </td>
                                    <td className="admin-cell-mono admin-cell-muted">{log.fecha_judi || '—'}</td>
                                    <td className="admin-cell-mono admin-cell-muted">
                                        {log.created_at
                                            ? new Date(log.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
                                            : '—'}
                                    </td>
                                    <td className="admin-cell-error" title={log.error_mensaje || undefined}>
                                        {log.error_mensaje || '—'}
                                    </td>
                                </tr>
                            ))}
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
        let query = supabase
            .from('hubgames_judi_pool')
            .select('id, steam_appid, game_name, relevance_score, is_eligible, selected_for_daily, discarded, discarded_reason, eligibility_reasons, week_start_date')
            .order('relevance_score', { ascending: false })
            .limit(200)

        if (q.trim().length >= 2) {
            query = query.ilike('game_name', `%${q.trim()}%`)
        }

        const { data: poolData } = await query

        if (!poolData || poolData.length === 0) {
            setItems([])
            setLoading(false)
            return
        }

        const appIds = poolData.map((r) => r.steam_appid).filter(Boolean)
        const { data: steamData } = await supabase
            .from('hubgames_juegos_steam')
            .select('steam_appid, header_image')
            .in('steam_appid', appIds)

        const imageMap = new Map((steamData ?? []).map((s) => [s.steam_appid, s.header_image]))

        setItems(poolData.map((r) => ({
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
            <header className="admin-topbar">
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
