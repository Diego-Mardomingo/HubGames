'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CalendarDays, Database, FileText, RefreshCw, TriangleAlert } from 'lucide-react'
import Segmented from '@/components/Segmented'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { adminWhen } from '@/lib/profile'
import {
    DAILY_PICK,
    genLogState,
    parsePoolLog,
    recentFailures,
    steamHealth,
    syncState,
    tomorrowJudiDay,
    tomorrowStatus,
    WEEKLY_POOL,
    type Failure,
    type PoolCounts,
} from '@/lib/admin'
import AdminHealth from './AdminHealth'
import LogsPanel from './LogsPanel'
import SyncPanel from './SyncPanel'
import PoolPanel from './PoolPanel'
import CalendarPanel from './CalendarPanel'
import type { AdminTab, DailyRow, GenRow, Loadable, SyncRow } from './types'

const LOG_LIMIT = 100
const DAILY_LIMIT = 180
const STEAM_APPID_CHUNK = 200
const enter = (i: number) => ({ '--i': i }) as CSSProperties
const empty = <T,>(): Loadable<T> => ({ rows: null, error: null, busy: true })

type Counts = { value: PoolCounts | null; error: string | null; busy: boolean }

async function loadCounts(): Promise<{ value: PoolCounts | null; error: string | null }> {
    const head = () => supabase.from('hubgames_judi_pool').select('id', { count: 'exact', head: true })
    const [all, unused, used, inel, disc] = await Promise.all([
        head(),
        head().eq('is_eligible', true).eq('discarded', false).eq('selected_for_daily', false),
        head().eq('selected_for_daily', true),
        head().eq('is_eligible', false).eq('discarded', false),
        head().eq('discarded', true),
    ])
    const err = [all, unused, used, inel, disc].find((r) => r.error)?.error
    if (err) return { value: null, error: err.message || 'No se pudieron contar los juegos del pool' }
    return { value: { all: all.count ?? 0, unused: unused.count ?? 0, used: used.count ?? 0, inel: inel.count ?? 0, disc: disc.count ?? 0 }, error: null }
}

/**
 * /admin: salud arriba (tiles y último fallo) y cuatro pestañas (logs, Steam, pool y calendario). Los logs, las
 * sincronizaciones y el calendario se cargan una vez y sirven a la vez a los tiles y a sus pestañas; el pool, por páginas.
 */
export default function AdminView({ userId }: { userId: string | null }) {
    const [now, setNow] = useState(() => new Date())
    const [gen, setGen] = useState<Loadable<GenRow>>(empty)
    const [sync, setSync] = useState<Loadable<SyncRow>>(empty)
    const [daily, setDaily] = useState<Loadable<DailyRow>>(empty)
    const [counts, setCounts] = useState<Counts>({ value: null, error: null, busy: true })
    const [images, setImages] = useState<Map<number, string | null>>(() => new Map())
    const [tab, setTab] = useState<AdminTab>('logs')
    const [open, setOpen] = useState<Set<string>>(() => new Set())
    const [focus, setFocus] = useState<{ key: string; n: number } | null>(null)
    const [logFilter, setLogFilter] = useState<'fail' | undefined>(undefined)
    const [stamp, setStamp] = useState<string | null>(null)
    const loadedImages = useRef(new Set<number>())

    const fetchImages = useCallback(async (appids: (number | null)[]) => {
        const ids = [...new Set(appids.filter((a): a is number => typeof a === 'number' && !loadedImages.current.has(a)))]
        if (!ids.length) return
        ids.forEach((a) => loadedImages.current.add(a))
        const found = new Map<number, string | null>()
        for (let i = 0; i < ids.length; i += STEAM_APPID_CHUNK) {
            const { data } = await supabase.from('hubgames_juegos_steam').select('steam_appid, header_image').in('steam_appid', ids.slice(i, i + STEAM_APPID_CHUNK))
            for (const s of data ?? []) found.set(s.steam_appid, s.header_image)
        }
        setImages((prev) => new Map([...prev, ...found]))
    }, [])

    const loadGen = useCallback(async () => {
        setGen((s) => ({ ...s, busy: true }))
        const { data, error } = await supabase.from('hubgames_judi_generacion_logs').select('*').order('fecha_ejecucion', { ascending: false }).limit(LOG_LIMIT)
        setGen({ rows: error ? null : (data ?? []), error: error ? error.message || 'No se pudieron cargar los logs' : null, busy: false })
        if (data) void fetchImages(data.map((l) => l.id_juego_steam))
    }, [fetchImages])

    const loadSync = useCallback(async () => {
        setSync((s) => ({ ...s, busy: true }))
        const { data, error } = await supabase.from('hubgames_sync_logs').select('*').order('started_at', { ascending: false }).limit(LOG_LIMIT)
        setSync({ rows: error ? null : (data ?? []), error: error ? error.message || 'No se pudieron cargar las sincronizaciones' : null, busy: false })
    }, [])

    const loadDaily = useCallback(async () => {
        setDaily((s) => ({ ...s, busy: true }))
        const { data, error } = await supabase
            .from('hubgames_lista_videojuegos_judi')
            .select('id, steam_appid, nombre, fecha, calificacion')
            .order('id', { ascending: false })
            .limit(DAILY_LIMIT)
        setDaily({ rows: error ? null : (data ?? []), error: error ? error.message || 'No se pudo cargar el calendario' : null, busy: false })
        if (data) void fetchImages(data.map((r) => r.steam_appid))
    }, [fetchImages])

    const refreshCounts = useCallback(async () => {
        setCounts((s) => ({ ...s, busy: true }))
        const res = await loadCounts()
        setCounts({ ...res, busy: false })
    }, [])

    const loadAll = useCallback(async () => {
        await Promise.all([loadGen(), loadSync(), loadDaily(), refreshCounts()])
        const t = new Date()
        setNow(t)
        setStamp(t.toISOString())
    }, [loadGen, loadSync, loadDaily, refreshCounts])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de la página
        void loadAll()
    }, [loadAll])

    const busyAll = gen.busy || sync.busy || daily.busy || counts.busy

    const tomorrow = useMemo(() => {
        if (!daily.rows || !gen.rows) return null
        const fecha = tomorrowJudiDay(now)
        const game = daily.rows.find((r) => r.fecha === fecha)?.nombre ?? null
        const pickLog = gen.rows.find((l) => l.fuente === DAILY_PICK) ?? null
        return tomorrowStatus({ game, pickLog }, now)
    }, [daily.rows, gen.rows, now])
    const steam = useMemo(() => (sync.rows ? steamHealth(sync.rows, now) : null), [sync.rows, now])
    const failures = useMemo(() => recentFailures(gen.rows ?? [], sync.rows ?? [], now), [gen.rows, sync.rows, now])
    const lastIngest = useMemo(() => {
        const l = gen.rows?.find((x) => x.fuente === WEEKLY_POOL)
        return l ? (parsePoolLog(l.nombre_juego)?.eligible ?? null) : null
    }, [gen.rows])

    const toggle = useCallback((key: string) => {
        setOpen((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const see = (kind: 'gen' | 'sync', id: number) => {
        const key = `${kind === 'gen' ? 'g' : 's'}${id}`
        setTab(kind === 'gen' ? 'logs' : 'steam')
        setLogFilter(undefined)
        setOpen((prev) => new Set(prev).add(key))
        setFocus((f) => ({ key, n: (f?.n ?? 0) + 1 }))
    }

    useEffect(() => {
        if (!focus) return
        const t = setTimeout(() => {
            const el = document.getElementById(`ad-row-${focus.key}`)
            if (!el) return
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
            el.querySelector<HTMLButtonElement>('.ad-row')?.focus({ preventScroll: true })
        }, 80)
        return () => clearTimeout(t)
    }, [focus, tab])

    const genBad = failures.some((f) => f.kind === 'gen')
    const syncBad = failures.some((f) => f.kind === 'sync')
    const syncWarn = !syncBad && (sync.rows ?? []).some((s) => now.getTime() - Date.parse(s.started_at) < 86_400_000 && syncState(s, now) === 'partial')
    const genPartialOnly = !genBad && (gen.rows ?? []).some((l) => l.fecha_ejecucion && now.getTime() - Date.parse(l.fecha_ejecucion) < 7 * 86_400_000 && genLogState(l) === 'partial')
    const calBad = tomorrow?.state === 'missing' || tomorrow?.state === 'failed'
    const poolBad = counts.value !== null && counts.value.unused < 7
    const alertIcon = (tone: 'dash-ko' | 'dash-warn') => <TriangleAlert className={`ad-ink ${tone}`} aria-hidden />

    const gotoTab = (t: AdminTab, filter?: 'fail') => {
        setLogFilter(filter)
        setTab(t)
        setFocus(null)
        requestAnimationFrame(() => document.getElementById('ad-tabs')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    }

    return (
        <div className="ad">
            <header className="ad-head hg-enter" style={enter(0)}>
                <div>
                    <h1 className="page-title">Administración</h1>
                    <p className="page-subtitle">Estado de JUDI y de las sincronizaciones con Steam. Solo lo ven los admins.</p>
                </div>
                <div className="ad-head__end">
                    <span className={`ad-stamp${busyAll ? ' is-busy' : ''}`} aria-live="polite">
                        {busyAll ? 'Actualizando…' : stamp ? `Actualizado ${adminWhen(stamp, now)}` : ''}
                    </span>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void loadAll()} disabled={busyAll}>
                        <RefreshCw className={busyAll ? 'hg-spin' : undefined} aria-hidden />
                        Actualizar
                    </Button>
                </div>
            </header>

            <AdminHealth
                now={now}
                tomorrow={tomorrow}
                counts={counts.value}
                gen={gen.rows}
                steam={steam}
                hasSync={(sync.rows ?? []).length > 0}
                failures={failures}
                onGo={gotoTab}
                onSee={(f: Failure) => see(f.kind, f.id)}
            />

            <div id="ad-tabs" className="hg-enter" style={enter(6)}>
                <Segmented
                    value={tab}
                    options={['logs', 'steam', 'pool', 'cal'] as const}
                    labels={{ logs: 'Logs', steam: 'Steam', pool: 'Pool', cal: 'Calendario' }}
                    counts={{ logs: gen.rows?.length ?? 0, steam: sync.rows?.length ?? 0, pool: counts.value?.all ?? 0, cal: daily.rows?.length ?? 0 }}
                    icons={{
                        logs: genBad ? alertIcon('dash-ko') : genPartialOnly ? alertIcon('dash-warn') : <FileText aria-hidden />,
                        steam: syncBad ? alertIcon('dash-ko') : syncWarn ? alertIcon('dash-warn') : <RefreshCw aria-hidden />,
                        pool: poolBad ? alertIcon('dash-ko') : <Database aria-hidden />,
                        cal: calBad ? alertIcon('dash-ko') : <CalendarDays aria-hidden />,
                    }}
                    countClassName={() => 'ad-cnt'}
                    onChange={(t) => gotoTab(t)}
                    scroll
                    className="ad-tabs"
                    aria-label="Secciones de administración"
                />
            </div>

            <div key={`${tab}-${logFilter ?? ''}`} className="ad-swap">
                {tab === 'logs' && (
                    <LogsPanel
                        data={gen}
                        now={now}
                        images={images}
                        open={open}
                        onToggle={toggle}
                        onRefresh={() => void loadGen().then(() => setNow(new Date()))}
                        focus={focus?.key.startsWith('g') ? Number(focus.key.slice(1)) : null}
                        initialFilter={logFilter}
                    />
                )}
                {tab === 'steam' && (
                    <SyncPanel
                        data={sync}
                        now={now}
                        me={userId}
                        open={open}
                        onToggle={toggle}
                        onRefresh={() => void loadSync().then(() => setNow(new Date()))}
                        focus={focus?.key.startsWith('s') ? Number(focus.key.slice(1)) : null}
                    />
                )}
                {tab === 'pool' && (
                    <PoolPanel
                        counts={counts.value}
                        countsError={counts.error}
                        countsBusy={counts.busy}
                        lastIngest={lastIngest}
                        onRefreshCounts={() => void refreshCounts()}
                    />
                )}
                {tab === 'cal' && (
                    <CalendarPanel
                        data={daily}
                        now={now}
                        tomorrow={tomorrow}
                        images={images}
                        onRefresh={() => void loadDaily().then(() => setNow(new Date()))}
                        onSeePick={() => {
                            const log = gen.rows?.find((l) => l.fuente === DAILY_PICK && !l.exito)
                            if (log) see('gen', log.id)
                        }}
                    />
                )}
            </div>
        </div>
    )
}
