'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleCheck, Clock, Minus, Monitor, Plus, RefreshCw, ShieldCheck, TriangleAlert, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { timeAgo } from '@/lib/profile'
import type { SteamLink } from './SteamSetting'

/** Pasados estos días sin actualizar, la fila lo recuerda. */
const REMIND_AFTER_DAYS = 30
/** El resumen se queda a la vista este tiempo y el panel se cierra solo. */
const DONE_VISIBLE_MS = 6000
/** Cada cuánto se mira si el script del PC ya ha guardado la lista, y hasta cuándo (el QR de Steam dura ~2,5 min). */
const WATCH_EVERY_MS = 3000
const WATCH_FOR_MS = 5 * 60_000
/** Enlace registrado en Windows por `npm run steam:familia:instalar`; abre scripts/steam-family-launch.mjs. */
const PROTOCOL_URL = 'hubgames-familia://actualizar'

type Phase =
    | { kind: 'idle' }
    | { kind: 'waiting' }
    | { kind: 'done'; total: number; delta: number }
    | { kind: 'timeout' }
    | { kind: 'unsupported' }

function ownersLabel(members: unknown, own: string): string | null {
    if (!members || typeof members !== 'object') return null
    const names = Object.entries(members as Record<string, string>)
        .filter(([id, name]) => id !== own && typeof name === 'string')
        .map(([, name]) => name)
    if (names.length === 0) return null
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
}

/** Fuera del componente: la regla de pureza de React no deja llamar a Date.now() en él. */
const clock = () => Date.now()

/**
 * Grupo familiar de Steam (#86), dentro de la sección Steam. Steam bloquea el QR si lo pide un servidor (IP distinta de
 * la del móvil), así que el botón abre un script en tu PC (enlace hubgames-familia://) que muestra el QR, trae la lista y
 * cierra la sesión en Steam. Aquí solo se espera a que la lista llegue a Supabase. Las horas y los logros de los
 * prestados que juegas ya los pone al día la sincronización diaria.
 */
export default function FamilySetting({ link, onLink }: { link: SteamLink; onLink: (link: SteamLink | null) => void }) {
    const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
    const [open, setOpen] = useState(false)
    const [count, setCount] = useState<number | null>(null)
    const [fresh, setFresh] = useState(false)
    const run = useRef(0)
    const timers = useRef<ReturnType<typeof setTimeout>[]>([])

    const later = useCallback((fn: () => void, ms: number) => {
        timers.current.push(setTimeout(fn, ms))
    }, [])
    const clearTimers = () => {
        timers.current.forEach(clearTimeout)
        timers.current = []
    }

    const loadCount = useCallback(async () => {
        const { count } = await supabase
            .from('hubgames_user_steam_games')
            .select('appid', { count: 'exact', head: true })
            .eq('source', 'family')
            .is('family_gone_at', null)
        setCount(count ?? 0)
        return count ?? 0
    }, [])

    useEffect(() => {
        if (link.family_synced_at) void loadCount()
    }, [link.family_synced_at, loadCount])

    useEffect(() => () => clearTimers(), [])

    async function watch(me: number, since: string | null, before: number, until: number) {
        if (me !== run.current) return
        const { data } = await supabase.from('hubgames_user_steam').select('*').maybeSingle()
        if (me !== run.current) return
        if (data && data.family_synced_at && data.family_synced_at !== since) {
            const total = await loadCount()
            onLink(data)
            setFresh(true)
            setPhase({ kind: 'done', total, delta: total - before })
            later(() => {
                if (me === run.current) close()
            }, DONE_VISIBLE_MS)
            return
        }
        if (clock() >= until) {
            setPhase({ kind: 'timeout' })
            return
        }
        later(() => void watch(me, since, before, until), WATCH_EVERY_MS)
    }

    function start() {
        const me = ++run.current
        clearTimers()
        setFresh(false)
        setOpen(true)
        // El script solo existe en tu PC con Windows.
        if (!/Windows/i.test(navigator.userAgent)) {
            setPhase({ kind: 'unsupported' })
            return
        }
        setPhase({ kind: 'waiting' })
        window.location.assign(PROTOCOL_URL)
        later(() => void watch(me, link.family_synced_at, count ?? 0, clock() + WATCH_FOR_MS), WATCH_EVERY_MS)
    }

    function close() {
        run.current++
        clearTimers()
        setOpen(false)
        later(() => setPhase({ kind: 'idle' }), 300)
    }

    const synced = link.family_synced_at
    const owners = ownersLabel(link.family_members, link.steamid)
    const stale = synced ? (clock() - Date.parse(synced)) / 86_400_000 > REMIND_AFTER_DAYS : false
    const busy = phase.kind === 'waiting'

    return (
        <div className="pf-fg">
            <div className="pf-fg__row">
                <span className="pf-fg__icon hg-tint st-todos" aria-hidden>
                    <Users />
                </span>
                <div className="pf-row__text">
                    <span className="pf-row__label">Grupo familiar</span>
                    {synced ? (
                        <>
                            <p className="pf-fg__stats">
                                <span>
                                    <Users aria-hidden />
                                    <b key={count ?? -1} className={fresh ? 'pf-pop' : undefined}>
                                        {count ?? '…'}
                                    </b>{' '}
                                    {count === 1 ? 'juego prestado' : 'juegos prestados'}
                                </span>
                                {owners && <span>de {owners}</span>}
                            </p>
                            <p className="pf-row__desc">
                                Lista actualizada{' '}
                                <time key={synced} className="pf-time" dateTime={synced} title={new Date(synced).toLocaleString('es-ES')}>
                                    {timeAgo(synced)}
                                </time>
                                {stale && <span className="pf-fg__stale"> · conviene actualizar</span>}
                                . Las horas y logros de los que juegas se actualizan solos cada día.
                            </p>
                        </>
                    ) : (
                        <p className="pf-row__desc">Trae los juegos que te prestan en tu grupo familiar de Steam. Se hace desde tu PC.</p>
                    )}
                </div>
                <Button type="button" variant={synced ? 'secondary' : 'default'} disabled={busy} onClick={start}>
                    <Users data-icon="inline-start" aria-hidden /> {synced ? 'Actualizar' : 'Actualizar grupo familiar'}
                </Button>
            </div>

            <div className={`pf-fg__drawer${open ? ' is-open' : ''}`}>
                <div>
                    {phase.kind !== 'idle' && (
                        <div className="pf-fg__box" aria-live="polite">
                            {phase.kind === 'waiting' && (
                                <>
                                    <ol className="pf-fg__steps">
                                        <li className="is-now">
                                            <span>
                                                Si el navegador pregunta, pulsa <b>«Abrir»</b> (puedes marcar que lo permita siempre). Se abre una
                                                ventana con el código QR.
                                            </span>
                                        </li>
                                        <li>
                                            <span>
                                                En la <b>app de Steam</b> del móvil: Steam Guard → escáner de QR → <b>«Aprobar»</b>.
                                            </span>
                                        </li>
                                        <li>
                                            <span>
                                                La ventana trae tu lista, <b>cierra la sesión</b> en Steam y se cierra sola. Aquí lo verás al momento.
                                            </span>
                                        </li>
                                    </ol>
                                    <div className="pf-fg__foot">
                                        <span className="pf-fg__timer">
                                            <RefreshCw className="hg-spin" aria-hidden /> Esperando a la ventana de tu PC…
                                        </span>
                                        <Button type="button" variant="ghost" size="sm" onClick={close}>
                                            Cancelar
                                        </Button>
                                    </div>
                                    <p className="pf-fg__safe">
                                        <Monitor aria-hidden />
                                        <span>
                                            ¿No se ha abierto nada? Hay que instalarlo una vez en tu PC: en la carpeta del proyecto,{' '}
                                            <code>npm run steam:familia:instalar</code>.
                                        </span>
                                    </p>
                                    <p className="pf-fg__safe">
                                        <ShieldCheck aria-hidden />
                                        <span>HubGames no guarda ningún permiso de tu cuenta: lo usa unos segundos y lo anula en Steam.</span>
                                    </p>
                                </>
                            )}
                            {phase.kind === 'done' && <Done total={phase.total} delta={phase.delta} />}
                            {(phase.kind === 'timeout' || phase.kind === 'unsupported') && (
                                <div className="pf-fg__done">
                                    <p className="alert alert--warn" role="status">
                                        {phase.kind === 'timeout' ? <Clock aria-hidden /> : <TriangleAlert aria-hidden />}
                                        <span>
                                            {phase.kind === 'timeout'
                                                ? 'No ha llegado la lista. Si la ventana dio un error, léelo allí; si no se abrió, instálalo con npm run steam:familia:instalar.'
                                                : 'Se hace desde tu PC con Windows: Steam bloquea el código si no lo pide tu propia conexión.'}
                                        </span>
                                    </p>
                                    <div className="pf-fg__acts">
                                        {phase.kind === 'timeout' && (
                                            <Button type="button" variant="secondary" size="sm" onClick={start}>
                                                <RefreshCw data-icon="inline-start" aria-hidden /> Reintentar
                                            </Button>
                                        )}
                                        <Button type="button" variant="ghost" size="sm" onClick={close}>
                                            Cerrar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function Done({ total, delta }: { total: number; delta: number }) {
    return (
        <div className="pf-fg__done">
            <p className="alert alert--ok" role="status">
                <CircleCheck className="hg-draw" aria-hidden />
                <span>
                    {delta === 0 ? (
                        <>
                            <b>Todo al día:</b> {total} {total === 1 ? 'juego' : 'juegos'}, sin cambios desde la última vez.
                        </>
                    ) : (
                        <b>Grupo familiar actualizado.</b>
                    )}
                </span>
            </p>
            {delta !== 0 && (
                <ul className="pf-fg__chips">
                    <li className="hg-tint st-todos">
                        <Users aria-hidden />
                        {total} en total
                    </li>
                    <li className={`hg-tint ${delta > 0 ? 'dash-ok' : 'neutral'}`}>
                        {delta > 0 ? <Plus aria-hidden /> : <Minus aria-hidden />}
                        {Math.abs(delta)} {delta > 0 ? (delta === 1 ? 'nuevo' : 'nuevos') : delta === -1 ? 'ya no está' : 'ya no están'}
                    </li>
                </ul>
            )}
        </div>
    )
}
