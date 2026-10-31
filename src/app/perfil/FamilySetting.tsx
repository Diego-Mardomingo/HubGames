'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Check, CircleCheck, Clock, ExternalLink, Minus, Plus, RefreshCw, ShieldCheck, Smartphone, TriangleAlert, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { timeAgo } from '@/lib/profile'
import type { SteamLink } from './SteamSetting'

/** Pasados estos días sin actualizar, la fila lo recuerda. */
const REMIND_AFTER_DAYS = 30
/** El resumen se queda a la vista este tiempo y el panel se cierra solo. */
const DONE_VISIBLE_MS = 6000

type Result = { total: number; added: number; gone: number; back: number; sessionClosed: boolean }
type Phase =
    | { kind: 'idle' }
    | { kind: 'starting' }
    | { kind: 'qr'; url: string; svg: string; expiresAt: number; interval: number; scanned: boolean; expired: boolean }
    | { kind: 'loading' }
    | { kind: 'done'; result: Result }
    | { kind: 'error'; code: string; text: string }

const fmt = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

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

const qrSvg = (url: string) => QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })

/**
 * Grupo familiar de Steam (#86), dentro de la sección Steam. A demanda: QR → aprobar en la app de Steam → HubGames trae
 * la lista y cierra la sesión en Steam. Aquí solo se ve el QR; el permiso de Steam no llega nunca al navegador.
 */
export default function FamilySetting({ link, onLink }: { link: SteamLink; onLink: (link: SteamLink | null) => void }) {
    const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
    const [open, setOpen] = useState(false)
    const [count, setCount] = useState<number | null>(null)
    const [now, setNow] = useState(clock)
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
    }, [])

    useEffect(() => {
        if (link.family_synced_at) void loadCount()
    }, [link.family_synced_at, loadCount])

    useEffect(() => () => clearTimers(), [])

    // Cuenta atrás del QR.
    useEffect(() => {
        if (phase.kind !== 'qr' || phase.expired) return
        const expiresAt = phase.expiresAt
        const id = setInterval(() => {
            const t = clock()
            setNow(t)
            // Caducado por tiempo aunque Steam aún no lo diga: se deja de preguntar.
            if (t >= expiresAt) {
                run.current++
                clearTimers()
                setPhase((p) => (p.kind === 'qr' ? { ...p, expired: true } : p))
            }
        }, 1000)
        return () => clearInterval(id)
    }, [phase])

    async function poll(me: number, interval: number) {
        if (me !== run.current) return
        // Si Steam ya lo ha aprobado, esta petición tarda (trae la lista y la guarda): se enseña «Trayendo…».
        const slow = setTimeout(() => {
            if (me === run.current) setPhase((p) => (p.kind === 'qr' && p.scanned ? { kind: 'loading' } : p))
        }, 1500)
        const res = await fetch('/api/steam/family/poll', { method: 'POST' }).catch(() => null)
        clearTimeout(slow)
        if (me !== run.current) return
        const body = res ? await res.json().catch(() => ({})) : {}
        if (!res || body.state === 'error' || !res.ok) {
            if (body.code === 'expired') {
                setPhase((p) => (p.kind === 'qr' ? { ...p, expired: true } : { kind: 'error', code: 'expired', text: body.error }))
            } else {
                setPhase({ kind: 'error', code: body.code ?? 'steam', text: body.error ?? 'Steam no ha respondido. No se ha cambiado nada.' })
            }
            return
        }
        if (body.state === 'done') {
            setPhase({ kind: 'done', result: body })
            setFresh(true)
            const { data } = await supabase.from('hubgames_user_steam').select('*').maybeSingle()
            if (data) onLink(data)
            await loadCount()
            later(() => {
                if (me === run.current) close()
            }, DONE_VISIBLE_MS)
            return
        }
        if (body.state === 'scanned' || body.state === 'waiting') {
            const url: string | null = body.challengeUrl
            const svg = url ? await qrSvg(url) : null
            setPhase((p) => (p.kind === 'qr' ? { ...p, scanned: body.state === 'scanned', ...(url && svg ? { url, svg } : {}) } : p))
            if (me !== run.current) return
            // Tras el escaneo la aprobación suele ser inmediata: se pregunta algo más a menudo.
            later(() => void poll(me, interval), body.state === 'scanned' ? Math.min(interval, 2) * 1000 : interval * 1000)
        }
    }

    async function start() {
        const me = ++run.current
        clearTimers()
        setFresh(false)
        setOpen(true)
        setPhase({ kind: 'starting' })
        const res = await fetch('/api/steam/family', { method: 'POST' }).catch(() => null)
        const body = res ? await res.json().catch(() => ({})) : {}
        if (me !== run.current) return
        if (!res?.ok) {
            setPhase({ kind: 'error', code: 'steam', text: body.error ?? 'Steam no ha dado el código QR. Inténtalo en un rato.' })
            return
        }
        const interval = Math.min(Math.max(Number(body.interval) || 5, 2), 10)
        setNow(clock())
        setPhase({ kind: 'qr', url: body.challengeUrl, svg: await qrSvg(body.challengeUrl), expiresAt: body.expiresAt, interval, scanned: false, expired: false })
        later(() => void poll(me, interval), interval * 1000)
    }

    function close() {
        run.current++
        clearTimers()
        setOpen(false)
        later(() => setPhase({ kind: 'idle' }), 300)
    }

    function cancel() {
        void fetch('/api/steam/family', { method: 'DELETE' }).catch(() => {})
        close()
    }

    const expired = phase.kind === 'qr' && (phase.expired || now >= phase.expiresAt)

    const synced = link.family_synced_at
    const owners = ownersLabel(link.family_members, link.steamid)
    const stale = synced ? (now - Date.parse(synced)) / 86_400_000 > REMIND_AFTER_DAYS : false
    const busy = phase.kind !== 'idle' && phase.kind !== 'done' && phase.kind !== 'error'

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
                                Actualizado{' '}
                                <time key={synced} className="pf-time" dateTime={synced} title={new Date(synced).toLocaleString('es-ES')}>
                                    {timeAgo(synced)}
                                </time>
                                {stale && <span className="pf-fg__stale"> · conviene actualizar</span>}
                            </p>
                        </>
                    ) : (
                        <p className="pf-row__desc">Trae los juegos que te prestan en tu grupo familiar de Steam y tus horas en ellos.</p>
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
                            {phase.kind === 'starting' && (
                                <p className="pf-fg__load">
                                    <RefreshCw className="hg-spin" aria-hidden /> Pidiendo el código a Steam…
                                </p>
                            )}
                            {phase.kind === 'qr' && (
                                <>
                                    <div className="pf-fg__qr">
                                        <div className={`pf-qr${phase.scanned ? ' is-scanned' : ''}${expired ? ' is-expired' : ''}`}>
                                            <span className="pf-qr__code" role="img" aria-label="Código QR para aprobar en la app de Steam" dangerouslySetInnerHTML={{ __html: phase.svg }} />
                                            <span className="pf-qr__ok" aria-hidden>
                                                <Check />
                                            </span>
                                            {expired && (
                                                <span className="pf-qr__exp">
                                                    <Button type="button" size="sm" onClick={start}>
                                                        <RefreshCw data-icon="inline-start" aria-hidden /> Otro código
                                                    </Button>
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <ol className="pf-fg__steps">
                                                <li className={phase.scanned ? 'is-done' : 'is-now'}>
                                                    <span className="pf-fg__on-desk">
                                                        Abre la <b>app de Steam</b> en el móvil y toca el <b>escáner de QR</b> (pestaña Steam Guard).
                                                    </span>
                                                    <span className="pf-fg__on-mob">
                                                        Pulsa <b>«Abrir en la app de Steam»</b>.
                                                    </span>
                                                </li>
                                                <li className={phase.scanned ? 'is-now' : undefined}>
                                                    <span>
                                                        <span className="pf-fg__on-desk">Escanea el código y pulsa </span>
                                                        <span className="pf-fg__on-mob">En la app, pulsa </span>
                                                        <b>«Aprobar»</b>. Verás «HubGames» como dispositivo.
                                                    </span>
                                                </li>
                                                <li>
                                                    <span>
                                                        HubGames trae tu lista y <b>cierra la sesión</b> enseguida.
                                                    </span>
                                                </li>
                                            </ol>
                                            {!expired && (
                                                <Button asChild className="pf-fg__open">
                                                    <a href={phase.url}>
                                                        <ExternalLink data-icon="inline-start" aria-hidden /> Abrir en la app de Steam
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="pf-fg__foot">
                                        {expired ? (
                                            <span className="pf-fg__timer is-low">
                                                <Clock aria-hidden /> El código ha caducado
                                            </span>
                                        ) : phase.scanned ? (
                                            <span className="pf-fg__timer is-ok">
                                                <Smartphone aria-hidden /> Escaneado: confirma en el móvil
                                            </span>
                                        ) : (
                                            <span className={`pf-fg__timer${phase.expiresAt - now < 30_000 ? ' is-low' : ''}`}>
                                                <Clock aria-hidden /> Caduca en {fmt(phase.expiresAt - now)}
                                            </span>
                                        )}
                                        <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                                            Cancelar
                                        </Button>
                                    </div>
                                    <p className="pf-fg__safe">
                                        <ShieldCheck aria-hidden />
                                        <span>HubGames no guarda ningún permiso de tu cuenta: lo usa unos segundos y lo anula en Steam.</span>
                                    </p>
                                </>
                            )}
                            {phase.kind === 'loading' && (
                                <p className="pf-fg__load">
                                    <RefreshCw className="hg-spin" aria-hidden /> Trayendo los juegos de tu grupo…
                                </p>
                            )}
                            {phase.kind === 'done' && <Done result={phase.result} />}
                            {phase.kind === 'error' && (
                                <div className="pf-fg__done">
                                    <p className={`alert ${phase.code === 'steam' ? 'alert--error' : 'alert--warn'}`} role="status">
                                        {phase.code === 'denied' ? <X aria-hidden /> : phase.code === 'no_family' ? <Users aria-hidden /> : <TriangleAlert aria-hidden />}
                                        <span>
                                            {phase.text}
                                            {phase.code === 'no_family' && ' Si te unes a uno, vuelve a actualizar.'}
                                        </span>
                                    </p>
                                    <div className="pf-fg__acts">
                                        {phase.code !== 'no_family' && (
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

function Done({ result }: { result: Result }) {
    const changed = result.added + result.gone + result.back > 0
    return (
        <div className="pf-fg__done">
            <p className="alert alert--ok" role="status">
                <CircleCheck className="hg-draw" aria-hidden />
                <span>
                    {changed ? (
                        <>
                            <b>Grupo familiar actualizado.</b>
                        </>
                    ) : (
                        <>
                            <b>Todo al día:</b> {result.total} {result.total === 1 ? 'juego' : 'juegos'}, sin cambios desde la última vez.
                        </>
                    )}
                    {result.sessionClosed && ' Sesión de Steam cerrada.'}
                </span>
            </p>
            {!result.sessionClosed && (
                <p className="alert alert--warn" role="status">
                    <TriangleAlert aria-hidden />
                    <span>
                        No se pudo cerrar la sesión en Steam. Quita «HubGames» en la app de Steam → <b>Dispositivos autorizados</b>.
                    </span>
                </p>
            )}
            {changed && (
                <ul className="pf-fg__chips">
                    <li className="hg-tint st-todos">
                        <Users aria-hidden />
                        {result.total} en total
                    </li>
                    {result.added + result.back > 0 && (
                        <li className="hg-tint dash-ok">
                            <Plus aria-hidden />
                            {result.added + result.back} {result.added + result.back === 1 ? 'nuevo' : 'nuevos'}
                        </li>
                    )}
                    {result.gone > 0 && (
                        <li className="hg-tint neutral">
                            <Minus aria-hidden />
                            {result.gone} ya no {result.gone === 1 ? 'está' : 'están'}
                        </li>
                    )}
                </ul>
            )}
        </div>
    )
}
