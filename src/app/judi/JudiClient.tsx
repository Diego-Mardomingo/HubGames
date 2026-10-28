'use client'

import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, safeGetUser } from '@/lib/supabase/client'
import Loader from '@/components/Loader'
import { buildRanking, getFailedAttempts, getPointsForRecord, type JudiProgressRecord } from '@/lib/judi-ranking'
import {
    attemptHistory,
    attemptSlots,
    dayAttempts,
    findJudiLocalKey,
    JUDI_FILTERS,
    judiDayPoints,
    judiDayStatus,
    judiIsoDate,
    JUDI_CHANGED_EVENT,
    judiCaptureUrl,
    parseJudiDay,
    pointsAtStake,
    writeJudiLocal,
    type JudiAttempt,
    type JudiDay,
    type JudiDayState,
    type JudiFilter,
    type JudiHints,
    type JudiSlot,
} from '@/lib/judi'
import { AttemptPips, JudiStrip, type JudiFx } from './JudiAttempts'
import JudiGuess, { normalizeGameName } from './JudiGuess'
import JudiHintList, { hintFor } from './JudiHints'
import JudiResult from './JudiResult'
import JudiHome, { type JudiRank } from './JudiHistory'
import type { JudiHistoryDay } from './JudiDayRow'
import AnimatedCount from '@/components/AnimatedCount'
import {
    JUDI_HOME_SCROLL_Y_KEY,
    getWindowScrollY,
    persistJudiHomeScrollYFromWindow,
    readSavedHomeScrollY,
} from '@/lib/judi-home-scroll'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import confetti from 'canvas-confetti'
import { AlertCircle, ArrowLeft, ArrowRight, CalendarX2, Clock, ImageOff, Maximize2, RefreshCw } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatHmsCountdown } from '@/lib/judi-maintenance'
import './judi.css'

/** Un día de JUDI. El nombre y la portada solo llegan cuando lo has terminado (#39). */
type GameRecord = {
    id: number
    fecha: string
    nombre?: string | null
    appid?: number | null
    completado?: boolean
    fase6?: boolean
    fase1?: boolean
    fase2?: boolean
    fase3?: boolean
    fase4?: boolean
    fase5?: boolean
    header_image?: string | null
    puntos?: number
    /** Intentos de la lista en orden (texto = fallo, null = salto); undefined = el servidor aún no los manda. */
    attempts?: (string | null)[]
}

type GameData = {
    juego: GameRecord
    captureCount: number
    /** Pistas de las fases desbloqueadas; las del servidor se van sumando con cada fallo. */
    hints: JudiHints
}

/** Progreso de un invitado en localStorage. Al terminar se guardan también el nombre y la portada. */
type JudiProgress = JudiProgressRecord & {
    id_lista_judi?: number
    nombre?: string | null
    header_image?: string | null
    appid?: number | null
}

const JUDI_ACCORDION_SESSION_KEY = 'judi_list_accordion'

function getMaxScrollY(): number {
    if (typeof window === 'undefined') return 0
    const se = document.scrollingElement ?? document.documentElement
    const h = Math.max(se.scrollHeight, document.body.scrollHeight, document.documentElement.scrollHeight)
    return Math.max(0, h - window.innerHeight)
}

/** Aplica Y en window + scrollingElement/body (necesario en varios navegadores móviles). */
function applyWindowScrollTop(top: number, behavior: ScrollBehavior) {
    const maxY = getMaxScrollY()
    const y = Math.min(Math.max(0, top), maxY)
    window.scrollTo({ top: y, left: 0, behavior })
    if (behavior === 'auto') {
        const se = document.scrollingElement
        if (se) se.scrollTop = y
        document.documentElement.scrollTop = y
        document.body.scrollTop = y
    }
}

type AccordionSession = {
    openYears: string[]
    openMonths: string[]
    userModified: boolean
}

function readAccordionSession(): AccordionSession | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = sessionStorage.getItem(JUDI_ACCORDION_SESSION_KEY)
        if (!raw) return null
        const data = JSON.parse(raw) as Partial<AccordionSession>
        return {
            openYears: Array.isArray(data.openYears) ? data.openYears : [],
            openMonths: Array.isArray(data.openMonths) ? data.openMonths : [],
            userModified: Boolean(data.userModified),
        }
    } catch {
        return null
    }
}

function writeAccordionSession(state: AccordionSession) {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(JUDI_ACCORDION_SESSION_KEY, JSON.stringify(state))
}

function parseLegacyDate(date: string) {
    const parts = date.split('-')
    if (parts.length !== 3) return null
    const [dd, mm, yyyy] = parts
    const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    if (Number.isNaN(dateObj.getTime())) return null
    return dateObj
}

/** Calendario del juego del día: medianoche en España (península, Canarias incluidas en la misma zona). */
const JUDI_DAILY_TZ = 'Europe/Madrid'

function formatYmdInTimeZone(d: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d)
}

/** `fecha` en lista JUDI: DD-MM-YYYY según el día civil en Madrid (alineado con el cambio de juego a las 00:00 hora española). */
function getLegacyJudiDateMadridString(d: Date): string {
    const ymd = formatYmdInTimeZone(d, JUDI_DAILY_TZ)
    const [y, m, day] = ymd.split('-')
    return `${day}-${m}-${y}`
}

function isJudiGameForCurrentDailyDate(game: { fecha: string }): boolean {
    return game.fecha === getLegacyJudiDateMadridString(new Date())
}

function addOneCivilDayYmd(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number)
    const next = new Date(Date.UTC(y, m - 1, d + 1))
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

/** Primer instante UTC en el que el reloj de Madrid pasa a `ymd` (00:00). */
function madridStartOfDayUtcMs(ymd: string): number {
    let lo = Date.parse(`${ymd}T00:00:00Z`) - 3 * 86400000
    let hi = Date.parse(`${ymd}T00:00:00Z`) + 3 * 86400000
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2)
        const midYmd = formatYmdInTimeZone(new Date(mid), JUDI_DAILY_TZ)
        if (midYmd < ymd) lo = mid
        else hi = mid
    }
    return hi
}

function getMsUntilNextMadridMidnight(): number {
    const now = Date.now()
    const todayMadrid = formatYmdInTimeZone(new Date(now), JUDI_DAILY_TZ)
    const tomorrowMadrid = addOneCivilDayYmd(todayMadrid)
    const nextMidnight = madridStartOfDayUtcMs(tomorrowMadrid)
    return Math.max(0, nextMidnight - now)
}

function useNextDailyCountdown() {
    const [msLeft, setMsLeft] = useState(() => getMsUntilNextMadridMidnight())
    useEffect(() => {
        const tick = () => setMsLeft(getMsUntilNextMadridMidnight())
        tick()
        const id = window.setInterval(tick, 1000)
        return () => window.clearInterval(id)
    }, [])
    return msLeft
}

function getLocalProgressRaw(): Record<string, JudiProgress> {
    try {
        const raw = localStorage.getItem('judi_progress')
        return raw ? (JSON.parse(raw) as Record<string, JudiProgress>) : {}
    } catch {
        return {}
    }
}

/** Intentos de invitados por fecha: texto = fallo, null = salto (los antiguos solo guardaban los nombres). */
function getLocalGuessesRaw(): Record<string, (string | null)[]> {
    try {
        const raw = localStorage.getItem('judi_intentos')
        return raw ? (JSON.parse(raw) as Record<string, (string | null)[]>) : {}
    } catch {
        return {}
    }
}

/** Por fecha: la clave es estable aunque se reinicien los ids de la lista (TRUNCATE). */
function readLocalProgressForGame(game: { fecha: string }, raw: Record<string, JudiProgress>): JudiProgress | undefined {
    const key = findJudiLocalKey(raw, game.fecha)
    return key ? raw[key] : undefined
}

function readLocalGuessesForGame(game: { fecha: string }, raw: Record<string, (string | null)[]>): (string | null)[] {
    const key = findJudiLocalKey(raw, game.fecha)
    return (key ? raw[key] : undefined) ?? []
}

/** Fase desbloqueada según el progreso (igual que hubgames_judi_phase): fase5 → 6, …, fase1 → 2, nada → 1. */
function phaseFromProgress(p?: JudiProgressRecord): number {
    if (p?.fase5) return 6
    if (p?.fase4) return 5
    if (p?.fase3) return 4
    if (p?.fase2) return 3
    if (p?.fase1) return 2
    return 1
}

const SWIPE_MIN_PX = 56
const SWIPE_BLOCK_CLICK_MS = 420

const JUDI_ATTEMPT_SLOTS = 6

const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** Intentos de un día del listado: en orden si la lista los trae; si no, tantos fallos sin orden como fases marcadas. */
function recordSlots(game: GameRecord): JudiSlot[] {
    const failed = getFailedAttempts(game as JudiProgressRecord)
    const state: JudiDayState = game.completado ? 'won' : game.fase6 ? 'lost' : 'playing'
    return attemptSlots(state, dayAttempts(game.attempts, failed).attempts)
}

/** Un día de la lista con lo que necesitan las cifras y la fila del historial. */
function historyDay(game: GameRecord): JudiHistoryDay | null {
    const date = judiIsoDate(game.fecha)
    if (!date) return null
    const failed = getFailedAttempts(game as JudiProgressRecord)
    const status = judiDayStatus(game, failed)
    const h = dayAttempts(game.attempts, failed)
    return {
        id: game.id,
        date,
        status,
        failed,
        nombre: game.nombre ?? null,
        headerImage: game.header_image ?? null,
        points: judiDayPoints({ status, failed }),
        attempts: h.attempts,
        names: h.names,
        exact: h.exact,
    }
}

/** Historial de intentos de la partida abierta. */
type History = { attempts: JudiAttempt[]; names: string[]; exact: boolean }
const EMPTY_HISTORY: History = { attempts: [], names: [], exact: true }

type TileStatus = 'won' | 'lost' | 'progress' | 'new'

function getTileStatus(game: GameRecord): TileStatus {
    if (game.completado) return 'won'
    if (game.fase6) return 'lost'
    return getFailedAttempts(game as JudiProgressRecord) > 0 ? 'progress' : 'new'
}

const STATUS_LABEL: Record<TileStatus, string> = {
    won: 'Acertado',
    lost: 'Fallado',
    progress: 'En curso',
    new: 'Sin jugar',
}

/** Hueco de "juego misterioso" para partidas sin resolver (no revela la portada). */
function MysteryArt({ big = false }: { big?: boolean }) {
    return (
        <div className={`jd-mystery${big ? ' jd-mystery--big' : ''}`} aria-hidden>
            <span>?</span>
        </div>
    )
}

/** Hoy no hay JUDI publicado (no se pudo preparar): se ofrece el último día. */
function NoTodayCard({ last, onPlay }: { last: GameRecord | null; onPlay: (game: GameRecord) => void }) {
    return (
        <section className="jd-today jd-today--none" aria-label="Juego del día">
            <div className="jd-today__art jd-today__art--empty" aria-hidden>
                <CalendarX2 />
            </div>
            <div className="jd-today__body">
                <div className="jd-today__meta">
                    <span className="jd-today__date">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })}</span>
                    <span className="hg-chip jd-chip--plain">Sin JUDI</span>
                </div>
                <p className="jd-today__name">Hoy no hay JUDI</p>
                <p className="jd-today__text">No se ha podido preparar el juego de hoy. Mientras, juega cualquier día del historial.</p>
                {last && (
                    <div className="jd-today__foot">
                        <Button variant="secondary" onClick={() => onPlay(last)}>
                            Jugar el último (#{last.id})
                            <ArrowRight size={18} data-icon="inline-end" aria-hidden />
                        </Button>
                    </div>
                )}
            </div>
        </section>
    )
}

/** No se pudo leer la lista de JUDI. */
function LoadErrorCard({ title, text, onRetry, onBack }: { title: string; text: string; onRetry: () => void; onBack?: () => void }) {
    return (
        <section className="jd-error hg-enter" role="alert">
            <span className="jd-error__icon hg-tint ko" aria-hidden>
                <AlertCircle />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
            <div className="jd-error__acts">
                <Button onClick={onRetry}>
                    <RefreshCw aria-hidden /> Reintentar
                </Button>
                {onBack && (
                    <Button variant="secondary" onClick={onBack}>
                        <ArrowLeft aria-hidden /> Volver al historial
                    </Button>
                )}
            </div>
        </section>
    )
}

/** Portada del juego del día: la primera captura (la que ves al empezar) o, si ya lo has terminado, la cápsula. */
function TodayArt({ src }: { src: string }) {
    const [failed, setFailed] = useState(false)
    if (failed) return <MysteryArt big />
    return <img src={src} alt="" draggable={false} onError={() => setFailed(true)} />
}

function TodayCard({
    game,
    countdown,
    onPlay,
}: {
    game: GameRecord | null
    countdown: string
    onPlay: (game: GameRecord) => void
}) {
    if (!game) return null
    const status = getTileStatus(game)
    const finished = status === 'won' || status === 'lost'
    const failed = getFailedAttempts(game as JudiProgressRecord)
    const parsed = parseLegacyDate(game.fecha)
    const longDate = parsed
        ? parsed.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
        : game.fecha
    const cta = finished ? 'Ver resultado' : status === 'progress' ? 'Continuar partida' : 'Jugar ahora'

    return (
        <section className={`jd-today jd-today--${status}`} aria-label="Juego del día">
            <button type="button" className="jd-today__art" onClick={() => onPlay(game)} aria-label={`${cta}: JUDI #${game.id}`} tabIndex={-1}>
                <TodayArt src={finished && game.header_image ? game.header_image : judiCaptureUrl(game.id, 1)} />
                {!finished && <span className="jd-today__badge">Captura 1 de 6</span>}
            </button>
            <div className="jd-today__body">
                <div className="jd-today__meta">
                    <span>
                        JUDI #{game.id} · <span className="jd-today__date">{longDate}</span>
                    </span>
                    <span
                        className={`hg-chip${status === 'won' ? ' hg-chip--done' : status === 'lost' ? ' jd-chip--lost' : status === 'progress' ? ' hg-chip--playing' : ''}`}
                    >
                        {STATUS_LABEL[status]}
                    </span>
                </div>
                <p className="jd-today__name">{finished ? game.nombre ?? STATUS_LABEL[status] : '¿Lo reconoces?'}</p>
                <div className="jd-today__pips">
                    <AttemptPips slots={recordSlots(game)} />
                    {status === 'won' ? (
                        <span className="jd-today__pips-label">
                            <b className="jd-today__pts">+{game.puntos ?? 0} puntos</b> · en la fase {failed + 1}
                        </span>
                    ) : status === 'lost' ? (
                        <span className="jd-today__pips-label">Sin puntos</span>
                    ) : (
                        <>
                            <span className="jd-today__pips-label">
                                Quedan <b>{JUDI_ATTEMPT_SLOTS - failed}</b>
                            </span>
                            <span className="jd-stake hg-tint st-todos">+{pointsAtStake(failed)} si aciertas</span>
                        </>
                    )}
                </div>
                <div className="jd-today__foot">
                    <Button size="lg" onClick={() => onPlay(game)} data-play>
                        {cta}
                        <ArrowRight size={18} data-icon="inline-end" aria-hidden />
                    </Button>
                    <div className="jd-countdown" role="timer" aria-label={`Nuevo juego en ${countdown}`}>
                        <span className="jd-countdown__time" aria-hidden>
                            {countdown}
                        </span>
                        <span className="jd-countdown__label" aria-hidden>
                            para el siguiente juego
                        </span>
                    </div>
                </div>
            </div>
        </section>
    )
}

const JUDI_FILTER_SESSION_KEY = 'judi_list_filter'

function readFilterSession(): JudiFilter {
    if (typeof window === 'undefined') return 'all'
    const raw = sessionStorage.getItem(JUDI_FILTER_SESSION_KEY)
    return (JUDI_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as JudiFilter) : 'all'
}

/** Hoy en Madrid (AAAA-MM-DD), el día del JUDI. */
function judiTodayIso(): string {
    return formatYmdInTimeZone(new Date(), JUDI_DAILY_TZ)
}

/** Tu puesto en el ranking (las mismas filas y la misma cuenta que /ranking). */
async function loadRank(userId: string): Promise<JudiRank> {
    const rows: JudiProgressRecord[] = []
    for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.rpc('hubgames_judi_ranking_rows').range(from, from + 999)
        if (error) return null
        rows.push(...((data ?? []) as JudiProgressRecord[]))
        if (!data || data.length < 1000) break
    }
    const ranking = buildRanking(rows)
    const i = ranking.findIndex((r) => r.userId === userId)
    return i < 0 ? null : { position: i + 1, total: ranking.length }
}

function formatLongDate(date: string) {
    const parsed = parseLegacyDate(date)
    if (!parsed) return date
    return parsed.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

const phaseImageVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
}

/** Confeti con la paleta del sistema (acento cobalto, dorado de "legendaria" y neutros), leída del tema activo. */
function systemConfettiColors(): string[] {
    const css = getComputedStyle(document.documentElement)
    const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
    return [read('--primary', '#2453ff'), read('--rar-leg', '#c98a0b'), read('--foreground', '#1b1f27'), read('--surface-3', '#d6dae1')]
}

export default function JudiClient() {
    const [user, setUser] = useState<any>(null)
    const [games, setGames] = useState<GameRecord[]>([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const [view, setView] = useState<'start' | 'game'>('start')
    const [selectedGame, setSelectedGame] = useState<GameData | null>(null)
    const [highestUnlockedPhase, setHighestUnlockedPhase] = useState(1)
    const [activeViewedPhase, setActiveViewedPhase] = useState(1)
    /** Intentos de la partida abierta (fallos y saltos en orden, si el servidor lo sabe). */
    const [history, setHistory] = useState<History>(EMPTY_HISTORY)
    const [guessSubmitting, setGuessSubmitting] = useState(false)
    /** Lo que se está comprobando (null = saltar); también para «Reintentar». */
    const [pendingGuess, setPendingGuess] = useState<{ guess: string | null } | null>(null)
    const [guessError, setGuessError] = useState<string | null>(null)
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing')
    /** Lo que acaba de pasar (para animar ese intento, la pista nueva y el resultado); null al volver a entrar. */
    const [fx, setFx] = useState<JudiFx | null>(null)
    /** La partida no se pudo cargar (en vez de quedarse en el listado sin decir nada). */
    const [gameLoadError, setGameLoadError] = useState<GameRecord | null>(null)
    const [listError, setListError] = useState(false)
    /** Captura que no ha cargado (fase). */
    const [brokenCapture, setBrokenCapture] = useState<number | null>(null)
    const [captureRetry, setCaptureRetry] = useState(0)
    const [captureZoomOpen, setCaptureZoomOpen] = useState(false)
    const swipeBlockClickRef = useRef(false)
    const touchStartRef = useRef<{ x: number; y: number } | null>(null)
    const loadUserAndGamesRef = useRef<() => Promise<void>>(async () => {})
    /** Último scroll del listado; el cleanup no puede usar window.scrollY al desmontar (el router ya lo ha puesto en 0). */
    const lastHomeScrollYRef = useRef(0)
    /** Evita repetir restore al cambiar acordeón/imágenes; se resetea al salir del listado o al recargar datos. */
    const homeScrollRestoreDoneRef = useRef(false)
    /** El listener de scroll solo depende de [view]; estos refs evitan pisar la Y al mostrar el Loader de startJuego. */
    const loadingRef = useRef(loading)
    const selectedGameRef = useRef(selectedGame)
    /** Meses abiertos del historial (AAAA-MM). */
    const [openMonths, setOpenMonths] = useState<string[]>([])
    const [listFilter, setListFilter] = useState<JudiFilter>(() => readFilterSession())
    const [rank, setRank] = useState<JudiRank>(undefined)
    /** Contador para el destello rojo de la captura al fallar. */
    const [flashKey, setFlashKey] = useState(0)
    const fxCounter = useRef(0)
    /** Dirección de la transición entre capturas (1 = siguiente, -1 = anterior). */
    const phaseDirRef = useRef(1)
    const lastPhaseRef = useRef(activeViewedPhase)

    const dailyCountdownMs = useNextDailyCountdown()

    const historyDays = useMemo(() => games.map(historyDay).filter((d): d is JudiHistoryDay => d !== null), [games])
    const todayIso = judiTodayIso()

    /** Abre o cierra un mes; lo que abras se recuerda durante la sesión. */
    const toggleMonth = useCallback((key: string, open: boolean) => {
        setOpenMonths((prev) => {
            if (prev.includes(key) === open) return prev
            const next = open ? [...prev, key] : prev.filter((k) => k !== key)
            writeAccordionSession({ openYears: [], openMonths: next, userModified: true })
            return next
        })
    }, [])

    useEffect(() => {
        void loadUserAndGames()
    }, [])

    useEffect(() => {
        loadingRef.current = loading
        selectedGameRef.current = selectedGame
    }, [loading, selectedGame])

    // Auto-refresh al cambiar de día en Madrid (00:00): muestra el nuevo juego sin recargar la página
    useEffect(() => {
        const ms = getMsUntilNextMadridMidnight()
        const timer = setTimeout(() => {
            void loadUserAndGamesRef.current()
        }, ms + 500)
        return () => clearTimeout(timer)
    }, [])

    /** useLayoutEffect: el listado depende de los meses abiertos; si esto corre después del paint, restore scroll usa altura errónea. */
    useLayoutEffect(() => {
        if (games.length === 0) return
        const valid = new Set(games.map((g) => judiIsoDate(g.fecha)?.slice(0, 7)).filter(Boolean))
        const stored = readAccordionSession()
        if (stored?.userModified) {
            setOpenMonths(stored.openMonths.filter((m) => valid.has(m)))
            return
        }
        const current = judiTodayIso().slice(0, 7)
        const latest = [...valid].sort().pop()
        setOpenMonths(valid.has(current) ? [current] : latest ? [latest] : [])
    }, [games])

    const loadUserAndGames = async () => {
        loadUserAndGamesRef.current = loadUserAndGames
        setLoading(true)
        const { data: { user: authUser } } = await safeGetUser()
        setUser(authUser)
        // Solo los días ya publicados (hasta hoy en Madrid), con tu progreso. Nombre y portada, solo de los terminados.
        const { data: rows, error: listErr } = await supabase.rpc('hubgames_judi_list')
        setListError(Boolean(listErr))
        const rawLocal = authUser ? {} : getLocalProgressRaw()
        const rawGuesses = authUser ? {} : getLocalGuessesRaw()

        setGames((rows ?? []).map((row) => {
            // Invitados: el servidor no sabe nada; el progreso, el nombre y la portada salen de localStorage.
            const local = authUser ? undefined : readLocalProgressForGame(row, rawLocal)
            const progress: JudiProgress = authUser ? row : (local ?? {})
            const points = getPointsForRecord(progress)
            return {
                id: row.id,
                fecha: row.fecha,
                nombre: authUser ? row.nombre : local?.nombre ?? null,
                header_image: authUser ? row.header_image : local?.header_image ?? null,
                completado: Boolean(progress.completado),
                fase1: Boolean(progress.fase1),
                fase2: Boolean(progress.fase2),
                fase3: Boolean(progress.fase3),
                fase4: Boolean(progress.fase4),
                fase5: Boolean(progress.fase5),
                fase6: Boolean(progress.fase6),
                puntos: points ?? undefined,
                // Con la migración hubgames_judi_list_intentos la lista trae los intentos; invitados, los de localStorage.
                attempts: authUser
                    ? Array.isArray(row.attempts)
                        ? row.attempts.map((a) => (typeof a === 'string' && a.trim() ? a : null))
                        : undefined
                    : readLocalGuessesForGame(row, rawGuesses),
            }
        }))
        setLoading(false)
        if (authUser) void loadRank(authUser.id).then(setRank)
        else setRank(null)
    }

    const startJuego = async (game: GameRecord) => {
        const scrollBeforeLoader = getWindowScrollY()
        if (view === 'start' && scrollBeforeLoader > 0) {
            lastHomeScrollYRef.current = scrollBeforeLoader
            sessionStorage.setItem(JUDI_HOME_SCROLL_Y_KEY, String(scrollBeforeLoader))
        }
        loadingRef.current = true
        setLoading(true)
        setCaptureZoomOpen(false)
        setHistory(EMPTY_HISTORY)
        setGuessError(null)
        setPendingGuess(null)
        setFx(null)
        setGameLoadError(null)
        setBrokenCapture(null)

        const { data: { user: authUser } } = await safeGetUser()
        let day: JudiDay | null
        let progress: JudiProgress | undefined
        let localAttempts: (string | null)[] = []
        if (authUser) {
            const { data } = await supabase.rpc('hubgames_judi_get_day', { p_id: game.id })
            day = parseJudiDay(data)
        } else {
            progress = readLocalProgressForGame(game, getLocalProgressRaw())
            localAttempts = readLocalGuessesForGame(game, getLocalGuessesRaw())
            const finished = Boolean(progress?.completado || progress?.fase6)
            const phase = finished ? 6 : phaseFromProgress(progress)
            const { data } = await supabase.rpc('hubgames_judi_get_day', { p_id: game.id, p_phase: phase })
            day = parseJudiDay(data)
            // Partidas de invitado terminadas antes de #39: no guardaban el nombre. Se pide como al perder la fase 6.
            if (day && finished && !progress?.nombre) {
                const { data: reveal } = await supabase.rpc('hubgames_judi_guess_anon', { p_id: game.id, p_guess: '', p_phase: 6 })
                const revealed = parseJudiDay(reveal)
                if (revealed) {
                    day = { ...day, nombre: revealed.nombre, headerImage: revealed.headerImage, appid: revealed.appid }
                    saveLocalProgress(game, { nombre: revealed.nombre, header_image: revealed.headerImage, appid: revealed.appid })
                }
            }
        }

        if (!day) {
            // Antes se quedaba en el listado sin decir nada: ahora, la partida con su error y «Reintentar».
            setGameLoadError(game)
            setSelectedGame(null)
            setView('game')
            setLoading(false)
            return
        }

        const juego: GameRecord = {
            ...game,
            nombre: day.nombre ?? progress?.nombre ?? game.nombre ?? null,
            header_image: day.headerImage ?? progress?.header_image ?? game.header_image ?? null,
            appid: day.appid ?? progress?.appid ?? null,
        }
        const state: JudiDay['state'] = authUser
            ? day.state
            : progress?.completado ? 'won' : progress?.fase6 ? 'lost' : 'playing'
        // Intentos gastados: los fallos de fase1..fase6 (el acierto no marca fase).
        const failed = authUser ? (day.failed ?? 0) : getFailedAttempts((progress ?? {}) as JudiProgressRecord)
        setHistory(
            authUser
                ? attemptHistory({ attempts: day.attempts, guesses: day.guesses, failed })
                : attemptHistory({ attempts: localAttempts, failed })
        )

        if (state === 'won' || state === 'lost') {
            setGameState(state)
            setHighestUnlockedPhase(6)
            setActiveViewedPhase(state === 'won' ? Math.min(failed + 1, 6) : 6)
        } else {
            setHighestUnlockedPhase(day.phase)
            setActiveViewedPhase(day.phase)
            setGameState('playing')
        }

        setSelectedGame({ juego, captureCount: day.captureCount, hints: day.hints })
        setView('game')
        setLoading(false)
    }

    /** Invitados: el progreso sigue en localStorage, ahora con la fecha como clave. */
    const saveLocalProgress = (gameRef: { id: number; fecha: string }, patch: Partial<JudiProgress>) => {
        const progressData = getLocalProgressRaw()
        const prev = readLocalProgressForGame(gameRef, progressData) ?? {}
        const next = writeJudiLocal(progressData, gameRef.fecha, gameRef.id, { ...prev, ...patch, id_lista_judi: gameRef.id })
        localStorage.setItem('judi_progress', JSON.stringify(next))
    }

    const saveLocalGuesses = (gameRef: { id: number; fecha: string }, guesses: (string | null)[]) => {
        const guessesData = getLocalGuessesRaw()
        const next = writeJudiLocal(guessesData, gameRef.fecha, gameRef.id, guesses)
        if (guesses.length === 0) delete next[gameRef.fecha]
        localStorage.setItem('judi_intentos', JSON.stringify(next))
    }

    /**
     * Envía un intento al servidor (#39); `guess` null = saltar. Con sesión, el servidor guarda el progreso (y, con la
     * migración de saltos, cada intento en orden); sin sesión, solo lo comprueba y el progreso se guarda en localStorage.
     */
    const sendAttempt = async (guess: string | null) => {
        if (!selectedGame || gameState !== 'playing' || guessSubmitting) return
        const game = selectedGame.juego
        setGuessSubmitting(true)
        setPendingGuess({ guess })
        setGuessError(null)
        try {
            const { data: { user: authUser } } = await safeGetUser()
            const { data, error } = authUser
                ? await supabase.rpc('hubgames_judi_guess', { p_id: game.id, p_guess: guess ?? '' })
                : await supabase.rpc('hubgames_judi_guess_anon', { p_id: game.id, p_guess: guess ?? '', p_phase: highestUnlockedPhase })
            const day = parseJudiDay(data)
            if (error || !day) {
                setGuessError('No se ha podido comprobar el intento. Inténtalo de nuevo.')
                return
            }
            setPendingGuess(null)
            if (day.result === 'duplicate') return

            const reveal = { nombre: day.nombre, header_image: day.headerImage, appid: day.appid }
            setSelectedGame((prev) =>
                prev ? { ...prev, juego: day.nombre ? { ...prev.juego, ...reveal } : prev.juego, hints: day.hints, captureCount: day.captureCount } : prev
            )
            const slot = history.attempts.length
            fxCounter.current += 1

            if (day.state === 'won') {
                setGameState('won')
                setFx({ kind: 'win', slot, n: fxCounter.current })
                if (!authUser) saveLocalProgress(game, { completado: true, ...reveal })
                return
            }

            // Fallo o salto: el intento nuevo. Si el servidor ya los cuenta en orden, manda él; si no, se añade aquí.
            const attempt: JudiAttempt = guess ? { kind: 'miss', name: guess } : { kind: 'skip', name: null }
            const fromServer = authUser ? attemptHistory({ attempts: day.attempts, guesses: day.guesses, failed: day.failed ?? slot + 1 }) : null
            const next: History = fromServer?.exact
                ? fromServer
                : { attempts: [...history.attempts, attempt], names: guess ? [...history.names, guess] : history.names, exact: history.exact }
            setHistory(next)
            if (!authUser) {
                saveLocalGuesses(game, [...readLocalGuessesForGame(game, getLocalGuessesRaw()).slice(0, slot), guess])
            }
            if (guess) setFlashKey((k) => k + 1)

            if (day.state === 'lost') {
                setHighestUnlockedPhase(6)
                setGameState('lost')
                setFx({ kind: 'lost', slot, n: fxCounter.current })
                if (!authUser) saveLocalProgress(game, { fase6: true, ...reveal })
            } else {
                if (!authUser) saveLocalProgress(game, { [`fase${highestUnlockedPhase}`]: true })
                setFx({ kind: guess ? 'miss' : 'skip', slot, n: fxCounter.current })
                setHighestUnlockedPhase(day.phase)
                setActiveViewedPhase(day.phase)
            }
        } finally {
            setGuessSubmitting(false)
            window.dispatchEvent(new Event(JUDI_CHANGED_EVENT))
        }
    }

    const submitGuess = async (rawGuess: string) => {
        const guessText = rawGuess.trim()
        if (!guessText) return
        if (history.names.some((g) => normalizeGameName(g) === normalizeGameName(guessText))) return
        await sendAttempt(guessText)
    }

    /** Consume un intento sin elegir título: abre la siguiente captura y pista, como fallar. */
    const skipAttempt = async () => {
        await sendAttempt(null)
    }

    const goAdjacentPhase = useCallback(
        (delta: number) => {
            setActiveViewedPhase((prev) => {
                const next = prev + delta
                if (next < 1 || next > 6) return prev
                if (gameState === 'playing' && next > highestUnlockedPhase) return prev
                return next
            })
        },
        [gameState, highestUnlockedPhase]
    )

    const onCaptureTouchStart = (e: React.TouchEvent) => {
        const t = e.touches[0]
        if (!t) return
        touchStartRef.current = { x: t.clientX, y: t.clientY }
    }

    const onCaptureTouchEnd = (e: React.TouchEvent) => {
        const start = touchStartRef.current
        touchStartRef.current = null
        if (!start) return
        const t = e.changedTouches[0]
        if (!t) return
        const dx = t.clientX - start.x
        const dy = t.clientY - start.y
        const ax = Math.abs(dx)
        const ay = Math.abs(dy)
        if (ax < SWIPE_MIN_PX || ax < ay * 1.2) return
        if (dx < 0) goAdjacentPhase(1)
        else goAdjacentPhase(-1)
        swipeBlockClickRef.current = true
        window.setTimeout(() => {
            swipeBlockClickRef.current = false
        }, SWIPE_BLOCK_CLICK_MS)
    }

    const onCaptureImageClick = () => {
        if (swipeBlockClickRef.current) return
        setCaptureZoomOpen(true)
    }

    useEffect(() => {
        if (fx?.kind !== 'win') return
        const id = window.setTimeout(() => {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
            const card = document.querySelector('.jd-result')?.getBoundingClientRect()
            const origin =
                card && card.bottom > 0 && card.top < window.innerHeight
                    ? { x: (card.left + card.width / 2) / window.innerWidth, y: Math.min(0.9, (card.top + 60) / window.innerHeight) }
                    : { y: 0.6 }
            void confetti({
                particleCount: 90,
                spread: 70,
                origin,
                colors: systemConfettiColors(),
                ticks: 180,
                scalar: 0.9,
                disableForReducedMotion: true,
            })
        }, 120)
        return () => window.clearTimeout(id)
    }, [fx])

    useEffect(() => {
        if (view !== 'game' || !selectedGame) return
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null
            if (!t) return
            if (t.closest('input, textarea, select')) return
            if (e.key === 'ArrowLeft') {
                e.preventDefault()
                goAdjacentPhase(-1)
            } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                goAdjacentPhase(1)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [view, selectedGame, goAdjacentPhase])

    useEffect(() => {
        if (view !== 'start') return
        const saved = readSavedHomeScrollY()
        lastHomeScrollYRef.current = saved > 0 ? saved : getWindowScrollY()
        let ticking = false
        const onScroll = () => {
            if (ticking) return
            ticking = true
            requestAnimationFrame(() => {
                if (loadingRef.current && !selectedGameRef.current) {
                    ticking = false
                    return
                }
                const y = getWindowScrollY()
                lastHomeScrollYRef.current = y
                sessionStorage.setItem(JUDI_HOME_SCROLL_Y_KEY, String(y))
                ticking = false
            })
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            window.removeEventListener('scroll', onScroll)
            sessionStorage.setItem(JUDI_HOME_SCROLL_Y_KEY, String(lastHomeScrollYRef.current))
        }
    }, [view])

    useEffect(() => {
        if (view === 'game') homeScrollRestoreDoneRef.current = false
    }, [view])

    useEffect(() => {
        if (view === 'start' && loading) homeScrollRestoreDoneRef.current = false
    }, [view, loading])

    // Restaurar scroll una sola vez cuando el listado ya tiene layout (datos + acordeón).
    // useEffect + rAF: al volver de otra ruta Next puede resetear scroll tras el layout; además esperamos a que maxY > 0.
    const accordionLayoutKey = openMonths.join('\u0001')
    useEffect(() => {
        if (view !== 'start' || loading || games.length === 0) return
        if (homeScrollRestoreDoneRef.current) return

        const targetY = readSavedHomeScrollY()
        if (targetY <= 0) {
            homeScrollRestoreDoneRef.current = true
            return
        }

        const maxYInitial = getMaxScrollY()
        if (maxYInitial < 1 && openMonths.length === 0) {
            return
        }

        let cancelled = false
        let frames = 0
        const maxFrames = 48

        const runScroll = () => {
            if (cancelled) return
            applyWindowScrollTop(targetY, 'smooth')
            homeScrollRestoreDoneRef.current = true
        }

        const tick = () => {
            if (cancelled) return
            frames++
            const my = getMaxScrollY()
            if (targetY > 0 && my < 1 && frames < maxFrames) {
                requestAnimationFrame(tick)
                return
            }
            runScroll()
        }

        const outer = requestAnimationFrame(() => {
            requestAnimationFrame(tick)
        })

        return () => {
            cancelled = true
            cancelAnimationFrame(outer)
        }
    }, [view, loading, games.length, accordionLayoutKey])

    if (loading && !selectedGame) {
        return <Loader />
    }

    const playingDailyGame = Boolean(selectedGame && isJudiGameForCurrentDailyDate(selectedGame.juego))

    if (lastPhaseRef.current !== activeViewedPhase) {
        phaseDirRef.current = activeViewedPhase > lastPhaseRef.current ? 1 : -1
        lastPhaseRef.current = activeViewedPhase
    }

    const viewedHint = selectedGame && activeViewedPhase <= highestUnlockedPhase ? hintFor(selectedGame.hints, activeViewedPhase) : null

    const todayGame = games.find((g) => isJudiGameForCurrentDailyDate(g)) ?? null

    const goBack = () => {
        setCaptureZoomOpen(false)
        setView('start')
        setGameLoadError(null)
        setFx(null)
        router.push('/judi', { scroll: false })
        void loadUserAndGames()
    }

    const slots = attemptSlots(gameState, history.attempts)
    const failedNow = Math.min(JUDI_ATTEMPT_SLOTS, history.attempts.length)
    const attemptsLeft = JUDI_ATTEMPT_SLOTS - failedNow
    /** Fase recién abierta por un fallo o un salto (su miniatura y su pista se animan). */
    const freshPhase = fx && (fx.kind === 'miss' || fx.kind === 'skip') ? fx.slot + 2 : null
    const nextPendingGame = selectedGame
        ? games.find((g) => !g.completado && !g.fase6 && g.id !== selectedGame.juego.id) ?? null
        : null
    const captureUrl = (phase: number) =>
        selectedGame && selectedGame.captureCount > 0 ? `${judiCaptureUrl(selectedGame.juego.id, phase)}${captureRetry ? `?r=${captureRetry}` : ''}` : undefined
    const currentCapture = captureUrl(activeViewedPhase)

    const changeFilter = (next: JudiFilter) => {
        setListFilter(next)
        sessionStorage.setItem(JUDI_FILTER_SESSION_KEY, next)
    }

    const playNext = (game: GameRecord) => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
        void startJuego(game)
    }

    return (
        <div className="jd">
            {view === 'start' ? (
                <>
                    <header className="page-head jd-head">
                        <div>
                            <h1 className="page-title">JUDI</h1>
                            <p className="page-subtitle">
                                Adivina el videojuego del día con 6 capturas y 5 pistas. Cuanto antes aciertes, más puntos sumas en el ranking.
                            </p>
                        </div>
                    </header>

                    {listError ? (
                        <LoadErrorCard
                            title="No se ha podido cargar JUDI"
                            text="Comprueba tu conexión y vuelve a probar. Tus partidas no se han perdido."
                            onRetry={() => void loadUserAndGames()}
                        />
                    ) : todayGame ? (
                        <TodayCard game={todayGame} countdown={formatHmsCountdown(dailyCountdownMs)} onPlay={(g) => void startJuego(g)} />
                    ) : games.length > 0 ? (
                        <NoTodayCard last={games[0] ?? null} onPlay={(g) => void startJuego(g)} />
                    ) : null}

                    <JudiHome
                        days={historyDays}
                        today={todayIso}
                        rank={rank}
                        guest={!user}
                        filter={listFilter}
                        onFilter={changeFilter}
                        openMonths={openMonths}
                        onToggleMonth={toggleMonth}
                        onPlay={(id) => {
                            const g = games.find((x) => x.id === id)
                            if (g) void startJuego(g)
                        }}
                        nudge={
                            !user && (
                                <div className="jd-nudge">
                                    <p>
                                        <strong>Guarda tu progreso y compite.</strong> Tus partidas se guardan solo en este dispositivo hasta que inicies sesión.
                                    </p>
                                    <Button asChild size="sm" variant="secondary">
                                        <Link
                                            href="/login"
                                            onPointerDownCapture={() => persistJudiHomeScrollYFromWindow()}
                                            onClick={() => persistJudiHomeScrollYFromWindow()}
                                        >
                                            Iniciar sesión
                                        </Link>
                                    </Button>
                                </div>
                            )
                        }
                    />
                </>
            ) : (
                gameLoadError ? (
                    <section className="jd-game">
                        <div className="jd-game__top">
                            <button type="button" className="hg-icon-btn jd-back" onClick={goBack} aria-label="Volver al historial">
                                <ArrowLeft size={18} aria-hidden />
                            </button>
                            <div className="jd-game__title">
                                <h1 className="jd-game__heading">JUDI #{gameLoadError.id}</h1>
                                <p className="jd-game__date">{formatLongDate(gameLoadError.fecha)}</p>
                            </div>
                        </div>
                        <LoadErrorCard
                            title={`No se ha podido cargar el JUDI #${gameLoadError.id}`}
                            text="Puede que se haya cortado la conexión. Tu progreso está guardado: vuelve a probar en un momento."
                            onRetry={() => void startJuego(gameLoadError)}
                            onBack={goBack}
                        />
                    </section>
                ) : selectedGame && (
                    <>
                        <section className={`jd-game${playingDailyGame ? ' jd-game--today' : ''}`}>
                            <div className="jd-game__top hg-enter" style={{ '--i': 0 } as CSSProperties}>
                                <button type="button" className="hg-icon-btn jd-back" onClick={goBack} aria-label="Volver al historial">
                                    <ArrowLeft size={18} aria-hidden />
                                </button>
                                <div className="jd-game__title">
                                    <h1 className="jd-game__heading">
                                        JUDI #{selectedGame.juego.id}
                                        {playingDailyGame ? (
                                            <span className="hg-chip hg-tint st-todos">
                                                <Clock aria-hidden /> Juego de hoy
                                            </span>
                                        ) : (
                                            <span className="hg-chip jd-chip--plain">Archivo</span>
                                        )}
                                    </h1>
                                    <p className="jd-game__date">{formatLongDate(selectedGame.juego.fecha)}</p>
                                </div>
                                <div className="jd-game__right">
                                    {gameState === 'playing' ? (
                                        <span className="jd-lives">
                                            Quedan{' '}
                                            <AnimatedCount value={attemptsLeft} className={`jd-lives__n${attemptsLeft <= 2 ? ' is-low' : ''}`} />{' '}
                                            {attemptsLeft === 1 ? 'intento' : 'intentos'}
                                        </span>
                                    ) : (
                                        <AttemptPips slots={slots} fx={fx} />
                                    )}
                                </div>
                            </div>

                            <div className={`jd-game__grid${gameState !== 'playing' ? ' is-finished' : ''}`}>
                                <div className="jd-stage-col hg-enter" style={{ '--i': 1 } as CSSProperties}>
                                    <div
                                        className="jd-stage"
                                        role="region"
                                        aria-label="Captura del juego. Desliza horizontalmente para cambiar de fase."
                                        onTouchStart={onCaptureTouchStart}
                                        onTouchEnd={onCaptureTouchEnd}
                                    >
                                        <AnimatePresence initial={false} custom={phaseDirRef.current}>
                                            {currentCapture && brokenCapture !== activeViewedPhase && (
                                                <motion.img
                                                    key={`${activeViewedPhase}-${currentCapture}`}
                                                    src={currentCapture}
                                                    alt=""
                                                    draggable={false}
                                                    className="jd-stage__img"
                                                    custom={phaseDirRef.current}
                                                    variants={phaseImageVariants}
                                                    initial="enter"
                                                    animate="center"
                                                    exit="exit"
                                                    transition={{ duration: 0.25, ease: EASE_OUT }}
                                                    onError={() => setBrokenCapture(activeViewedPhase)}
                                                />
                                            )}
                                        </AnimatePresence>
                                        {selectedGame.captureCount === 0 && (
                                            <div className="jd-stage__empty">
                                                <MysteryArt big />
                                            </div>
                                        )}
                                        {brokenCapture === activeViewedPhase && (
                                            <div className="jd-stage__broken">
                                                <ImageOff aria-hidden />
                                                <span>La captura {activeViewedPhase} no carga.</span>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        setBrokenCapture(null)
                                                        setCaptureRetry((n) => n + 1)
                                                    }}
                                                >
                                                    <RefreshCw aria-hidden /> Reintentar
                                                </Button>
                                            </div>
                                        )}
                                        {selectedGame.captureCount > 0 && brokenCapture !== activeViewedPhase && (
                                            <button type="button" className="jd-stage__zoom" onClick={onCaptureImageClick} aria-label="Ampliar captura">
                                                <span className="jd-stage__zoom-icon">
                                                    <Maximize2 size={16} aria-hidden />
                                                </span>
                                            </button>
                                        )}
                                        <span className="jd-stage__badge">
                                            Captura <strong>{activeViewedPhase}</strong> de 6
                                        </span>
                                        <AnimatePresence>
                                            {flashKey > 0 && (
                                                <motion.span
                                                    key={flashKey}
                                                    className="jd-stage__flash"
                                                    initial={{ opacity: 1 }}
                                                    animate={{ opacity: 0 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.7, ease: 'easeOut' }}
                                                />
                                            )}
                                        </AnimatePresence>
                                        {viewedHint && (
                                            <div key={activeViewedPhase} className="jd-stage__hint">
                                                <span className="jd-stage__hint-label">{viewedHint.label}</span>
                                                <span className="jd-stage__hint-value">{viewedHint.value}</span>
                                            </div>
                                        )}
                                    </div>

                                    <JudiStrip
                                        slots={slots}
                                        viewed={activeViewedPhase}
                                        captureUrl={captureUrl}
                                        onView={setActiveViewedPhase}
                                        fx={fx}
                                        unlocked={freshPhase}
                                    />
                                    <p className="jd-keyhint">
                                        <span>
                                            {gameState === 'playing' ? (
                                                <>
                                                    Intento <b>{failedNow + 1}</b> de 6
                                                </>
                                            ) : (
                                                'Todas las capturas abiertas'
                                            )}
                                        </span>
                                        <span className="jd-keyhint__keys">
                                            <kbd className="hg-kbd">←</kbd> <kbd className="hg-kbd">→</kbd> para cambiar de captura
                                        </span>
                                    </p>
                                </div>

                                <aside className="jd-panel hg-enter" style={{ '--i': 2 } as CSSProperties}>
                                    {gameState === 'playing' ? (
                                        <JudiGuess
                                            tried={history.names}
                                            attempts={history.attempts}
                                            exact={history.exact}
                                            stake={pointsAtStake(failedNow)}
                                            checking={guessSubmitting}
                                            checkingName={pendingGuess?.guess ?? null}
                                            error={guessError}
                                            missKey={fx && fx.kind === 'miss' ? fx.n : 0}
                                            freshAttempt={fx && (fx.kind === 'miss' || fx.kind === 'skip') ? fx.slot : null}
                                            onSubmit={(name) => void submitGuess(name)}
                                            onSkip={() => void skipAttempt()}
                                            onRetry={() => void sendAttempt(pendingGuess?.guess ?? null)}
                                        />
                                    ) : (
                                        <JudiResult
                                            key={`${selectedGame.juego.id}-${gameState}`}
                                            state={gameState}
                                            attempts={history.attempts}
                                            exact={history.exact}
                                            slots={slots}
                                            game={selectedGame.juego}
                                            hints={selectedGame.hints}
                                            animate={fx?.kind === 'win' || fx?.kind === 'lost'}
                                            countdown={playingDailyGame ? formatHmsCountdown(dailyCountdownMs) : null}
                                            onBack={goBack}
                                            onNext={nextPendingGame ? () => playNext(nextPendingGame) : null}
                                        />
                                    )}

                                    <JudiHintList
                                        hints={selectedGame.hints}
                                        unlockedPhase={highestUnlockedPhase}
                                        viewed={activeViewedPhase}
                                        playing={gameState === 'playing'}
                                        fresh={freshPhase}
                                        onView={setActiveViewedPhase}
                                    />
                                </aside>
                            </div>
                        </section>

                        <Dialog open={captureZoomOpen} onOpenChange={setCaptureZoomOpen}>
                            <DialogPrimitive.Portal>
                                <DialogPrimitive.Overlay className="jd-zoom-overlay" />
                                <DialogPrimitive.Content
                                    className="jd-zoom"
                                    onTouchStart={onCaptureTouchStart}
                                    onTouchEnd={onCaptureTouchEnd}
                                    onClick={() => setCaptureZoomOpen(false)}
                                >
                                    <DialogPrimitive.Title className="sr-only">
                                        Captura ampliada, fase {activeViewedPhase} de 6
                                    </DialogPrimitive.Title>
                                    {currentCapture && (
                                        <button
                                            type="button"
                                            className="jd-zoom__btn"
                                            aria-label="Cerrar captura ampliada"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setCaptureZoomOpen(false)
                                            }}
                                        >
                                            <img src={currentCapture} alt="" draggable={false} />
                                        </button>
                                    )}
                                </DialogPrimitive.Content>
                            </DialogPrimitive.Portal>
                        </Dialog>
                    </>
                )
            )}
        </div>
    )
}
