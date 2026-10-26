'use client'

import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useAnimate } from 'framer-motion'
import { supabase, safeGetUser } from '@/lib/supabase/client'
import Loader from '@/components/Loader'
import { getFailedAttempts, getPointsForRecord, type JudiProgressRecord } from '@/lib/judi-ranking'
import { findJudiLocalKey, JUDI_CHANGED_EVENT, judiCaptureUrl, parseJudiDay, writeJudiLocal, type JudiDay, type JudiHints } from '@/lib/judi'
import JudiFinishActions from './JudiFinishActions'
import {
    JUDI_HOME_SCROLL_Y_KEY,
    getWindowScrollY,
    persistJudiHomeScrollYFromWindow,
    readSavedHomeScrollY,
} from '@/lib/judi-home-scroll'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import confetti from 'canvas-confetti'
import {
    ArrowLeft,
    ArrowRight,
    Building2,
    CalendarDays,
    Check,
    ChevronDown,
    Lock,
    Maximize2,
    Search,
    SkipForward,
    Tags,
    ThumbsUp,
    Users,
    X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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

type GuessOption = {
    id: number
    name: string
}

type MonthGroup = {
    key: string
    label: string
    games: GameRecord[]
}

type YearGroup = {
    year: string
    label: string
    months: MonthGroup[]
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

function getCurrentMonthKey(): string {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
}

function getMonthLabelOnly(monthKey: string) {
    if (monthKey === 'sin-fecha') return 'Sin fecha'
    const parts = monthKey.split('-')
    if (parts.length !== 2) return monthKey
    const [yyyy, mm] = parts
    const monthDate = new Date(Number(yyyy), Number(mm) - 1, 1)
    return monthDate.toLocaleDateString('es-ES', { month: 'long' })
}

function buildYearGroups(games: GameRecord[]): { singleYear: boolean; yearGroups: YearGroup[] } {
    const byYear = new Map<string, Map<string, GameRecord[]>>()

    for (const game of games) {
        const parsed = parseLegacyDate(game.fecha)
        if (!parsed) {
            if (!byYear.has('sin-fecha')) byYear.set('sin-fecha', new Map())
            const months = byYear.get('sin-fecha')!
            if (!months.has('sin-fecha')) months.set('sin-fecha', [])
            months.get('sin-fecha')!.push(game)
            continue
        }
        const y = String(parsed.getFullYear())
        const mk = getMonthKey(game.fecha)
        if (!byYear.has(y)) byYear.set(y, new Map())
        const months = byYear.get(y)!
        if (!months.has(mk)) months.set(mk, [])
        months.get(mk)!.push(game)
    }

    const yearKeys = [...byYear.keys()].sort((a, b) => {
        if (a === 'sin-fecha') return 1
        if (b === 'sin-fecha') return -1
        return b.localeCompare(a)
    })

    const singleYear = yearKeys.length <= 1

    const yearGroups: YearGroup[] = yearKeys.map((year) => {
        const monthMap = byYear.get(year)!
        const monthKeys = [...monthMap.keys()].sort((a, b) => b.localeCompare(a))
        const months: MonthGroup[] = monthKeys.map((key) => ({
            key,
            label: getMonthLabelOnly(key),
            games: monthMap.get(key)!.sort((a, b) => b.id - a.id),
        }))
        const label = year === 'sin-fecha' ? 'Sin fecha' : year
        return { year, label, months }
    })

    return { singleYear, yearGroups }
}

function parseLegacyDate(date: string) {
    const parts = date.split('-')
    if (parts.length !== 3) return null
    const [dd, mm, yyyy] = parts
    const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
    if (Number.isNaN(dateObj.getTime())) return null
    return dateObj
}

function getMonthKey(date: string) {
    const parsed = parseLegacyDate(date)
    if (!parsed) return 'sin-fecha'
    const yyyy = parsed.getFullYear()
    const mm = String(parsed.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
}

function formatShortDate(date: string) {
    const parsed = parseLegacyDate(date)
    if (!parsed) return date
    return parsed.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
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

function formatHmsCountdown(ms: number): string {
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
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

function getLocalGuessesRaw(): Record<string, string[]> {
    try {
        const raw = localStorage.getItem('judi_intentos')
        return raw ? (JSON.parse(raw) as Record<string, string[]>) : {}
    } catch {
        return {}
    }
}

/** Por fecha: la clave es estable aunque se reinicien los ids de la lista (TRUNCATE). */
function readLocalProgressForGame(game: { fecha: string }, raw: Record<string, JudiProgress>): JudiProgress | undefined {
    const key = findJudiLocalKey(raw, game.fecha)
    return key ? raw[key] : undefined
}

function readLocalGuessesForGame(game: { fecha: string }, raw: Record<string, string[]>): string[] {
    const key = findJudiLocalKey(raw, game.fecha)
    return (key ? raw[key] : undefined) ?? []
}

function normalizeGameName(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
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

type PipState = 'empty' | 'miss' | 'hit'

function listPipStates(failed: number): PipState[] {
    const f = Math.min(Math.max(0, failed), JUDI_ATTEMPT_SLOTS)
    return Array.from({ length: JUDI_ATTEMPT_SLOTS }, (_, i) => (i < f ? 'miss' : 'empty'))
}

function gamePipStates(gameState: 'playing' | 'won' | 'lost', lives: number): PipState[] {
    const failed = Math.min(JUDI_ATTEMPT_SLOTS, Math.max(0, JUDI_ATTEMPT_SLOTS - lives))
    return Array.from({ length: JUDI_ATTEMPT_SLOTS }, (_, i) => {
        if (gameState === 'lost') return 'miss'
        if (gameState === 'won') {
            // Sin fallos: todo en verde (celebración); si no, fallos en rojo + acierto en verde.
            if (failed === 0) return 'hit'
            return i < failed ? 'miss' : i === failed ? 'hit' : 'empty'
        }
        return i < failed ? 'miss' : 'empty'
    })
}

function AttemptPips({ states, size = 'md' }: { states: PipState[]; size?: 'sm' | 'md' }) {
    const misses = states.filter((s) => s === 'miss').length
    return (
        <div className={`jd-pips jd-pips--${size}`} role="img" aria-label={`${misses} de ${JUDI_ATTEMPT_SLOTS} intentos fallados`}>
            {states.map((state, i) => (
                <motion.span
                    key={i}
                    className={`jd-pip jd-pip--${state}`}
                    initial={false}
                    animate={state === 'empty' ? { scale: 1 } : { scale: [1, 1.35, 1] }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                />
            ))}
        </div>
    )
}

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

function GameTile({ game, onPlay }: { game: GameRecord; onPlay: (game: GameRecord) => void }) {
    const status = getTileStatus(game)
    const finished = status === 'won' || status === 'lost'
    const failed = getFailedAttempts(game as JudiProgressRecord)
    const isToday = isJudiGameForCurrentDailyDate(game)
    const title = finished ? game.nombre ?? STATUS_LABEL[status] : STATUS_LABEL[status]

    return (
        <li>
            <button
                type="button"
                data-game-row
                className={`jd-tile jd-tile--${status}${isToday ? ' is-today' : ''}`}
                onClick={() => onPlay(game)}
                aria-label={`JUDI #${game.id}, ${formatShortDate(game.fecha)}: ${title}${finished && game.nombre ? ` (${STATUS_LABEL[status].toLowerCase()})` : ''}`}
            >
                <span className="jd-tile__art">
                    {finished && game.header_image ? (
                        <img src={game.header_image} alt="" loading="lazy" draggable={false} />
                    ) : (
                        <MysteryArt />
                    )}
                </span>
                <span className="jd-tile__body">
                    <span className="jd-tile__meta">
                        {isToday ? <b>Hoy</b> : formatShortDate(game.fecha)} · #{game.id}
                    </span>
                    <span className="jd-tile__title">{title}</span>
                    <span className="jd-tile__foot">
                        {finished ? (
                            <span className={`jd-tile__state jd-tile__state--${status}`}>
                                {status === 'won' ? <Check size={13} strokeWidth={2.75} aria-hidden /> : <X size={13} strokeWidth={2.75} aria-hidden />}
                                {status === 'won' ? `+${game.puntos ?? 0} pts` : '0 pts'}
                            </span>
                        ) : status === 'progress' ? (
                            <AttemptPips states={listPipStates(failed)} size="sm" />
                        ) : (
                            <span className="jd-tile__play">Jugar</span>
                        )}
                    </span>
                </span>
            </button>
        </li>
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
                    <AttemptPips
                        states={
                            status === 'won'
                                ? gamePipStates('won', JUDI_ATTEMPT_SLOTS - failed)
                                : status === 'lost'
                                    ? gamePipStates('lost', 0)
                                    : listPipStates(failed)
                        }
                    />
                    <span className="jd-today__pips-label">
                        {status === 'won'
                            ? `+${game.puntos ?? 0} puntos`
                            : status === 'lost'
                                ? 'Sin puntos'
                                : `${JUDI_ATTEMPT_SLOTS - failed} intentos restantes`}
                    </span>
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

type ListFilter = 'all' | 'pending' | 'won' | 'lost'

const LIST_FILTERS: { id: ListFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'pending', label: 'Pendientes' },
    { id: 'won', label: 'Acertados' },
    { id: 'lost', label: 'Fallados' },
]

const JUDI_FILTER_SESSION_KEY = 'judi_list_filter'

function readFilterSession(): ListFilter {
    if (typeof window === 'undefined') return 'all'
    const raw = sessionStorage.getItem(JUDI_FILTER_SESSION_KEY)
    return raw === 'pending' || raw === 'won' || raw === 'lost' ? raw : 'all'
}

function matchesFilter(game: GameRecord, filter: ListFilter) {
    if (filter === 'all') return true
    if (filter === 'won') return Boolean(game.completado)
    if (filter === 'lost') return Boolean(game.fase6 && !game.completado)
    return !game.completado && !game.fase6
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
    const [lives, setLives] = useState(6)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<GuessOption[]>([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)
    const [guessSubmitting, setGuessSubmitting] = useState(false)
    const [guessError, setGuessError] = useState<string | null>(null)
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing')
    const [wrongGuesses, setWrongGuesses] = useState<string[]>([])
    const [captureZoomOpen, setCaptureZoomOpen] = useState(false)
    const swipeBlockClickRef = useRef(false)
    const touchStartRef = useRef<{ x: number; y: number } | null>(null)
    const winConfettiFiredRef = useRef(false)
    const loadUserAndGamesRef = useRef<() => Promise<void>>(async () => {})
    /** Último scroll del listado; el cleanup no puede usar window.scrollY al desmontar (el router ya lo ha puesto en 0). */
    const lastHomeScrollYRef = useRef(0)
    /** Evita repetir restore al cambiar acordeón/imágenes; se resetea al salir del listado o al recargar datos. */
    const homeScrollRestoreDoneRef = useRef(false)
    /** El listener de scroll solo depende de [view]; estos refs evitan pisar la Y al mostrar el Loader de startJuego. */
    const loadingRef = useRef(loading)
    const selectedGameRef = useRef(selectedGame)
    const [accordion, setAccordion] = useState<{ openYears: string[]; openMonths: string[] }>({
        openYears: [],
        openMonths: [],
    })
    const [listFilter, setListFilter] = useState<ListFilter>(() => readFilterSession())
    /** Contador para el destello rojo de la captura al fallar. */
    const [flashKey, setFlashKey] = useState(0)
    const [guessScope, animateGuess] = useAnimate<HTMLDivElement>()
    /** Dirección de la transición entre capturas (1 = siguiente, -1 = anterior). */
    const phaseDirRef = useRef(1)
    const lastPhaseRef = useRef(activeViewedPhase)

    const dailyCountdownMs = useNextDailyCountdown()

    const visibleGames = useMemo(() => games.filter((g) => matchesFilter(g, listFilter)), [games, listFilter])
    const { singleYear, yearGroups } = useMemo(() => buildYearGroups(visibleGames), [visibleGames])

    const stats = useMemo(() => {
        let points = 0
        let wins = 0
        let losses = 0
        for (const g of games) {
            if (g.completado) {
                wins++
                points += g.puntos ?? 0
            } else if (g.fase6) {
                losses++
            }
        }
        // Racha: días consecutivos acertados hacia atrás (el de hoy sin jugar no la rompe).
        const byDateDesc = [...games].sort(
            (a, b) => (parseLegacyDate(b.fecha)?.getTime() ?? 0) - (parseLegacyDate(a.fecha)?.getTime() ?? 0)
        )
        let streak = 0
        for (const g of byDateDesc) {
            if (isJudiGameForCurrentDailyDate(g) && !g.completado && !g.fase6) continue
            if (!g.completado) break
            streak++
        }
        const played = wins + losses
        return { points, wins, losses, streak, accuracy: played > 0 ? Math.round((wins / played) * 100) : 0 }
    }, [games])

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

    /** useLayoutEffect: el listado depende de meses/años abiertos; si esto corre después del paint, restore scroll usa altura errónea. */
    useLayoutEffect(() => {
        if (games.length === 0) return
        const { singleYear: oneYear, yearGroups: groups } = buildYearGroups(games)
        const validMonthKeys = new Set(groups.flatMap((y) => y.months.map((m) => m.key)))
        const validYearKeys = new Set(groups.map((y) => y.year))

        const stored = readAccordionSession()
        if (stored?.userModified) {
            setAccordion({
                openYears: (stored.openYears ?? []).filter((y) => validYearKeys.has(y)),
                openMonths: (stored.openMonths ?? []).filter((m) => validMonthKeys.has(m)),
            })
            return
        }

        const currentMonth = getCurrentMonthKey()
        const currentYearStr = String(new Date().getFullYear())

        let defaultMonths: string[] = []
        if (validMonthKeys.has(currentMonth)) {
            defaultMonths = [currentMonth]
        } else {
            const inCurrentYear = [...validMonthKeys]
                .filter((k) => k !== 'sin-fecha' && k.startsWith(`${currentYearStr}-`))
                .sort((a, b) => b.localeCompare(a))
            if (inCurrentYear[0]) {
                defaultMonths = [inCurrentYear[0]]
            } else {
                const sorted = [...validMonthKeys].sort((a, b) => b.localeCompare(a))
                if (sorted[0]) defaultMonths = [sorted[0]]
            }
        }

        let defaultYears: string[] = []
        if (!oneYear) {
            if (validYearKeys.has(currentYearStr)) {
                defaultYears = [currentYearStr]
            } else if (defaultMonths.length > 0) {
                defaultYears = [...new Set(defaultMonths.map((m) => m.split('-')[0]!))].filter((y) =>
                    validYearKeys.has(y)
                )
            }
        }

        setAccordion({
            openYears: defaultYears,
            openMonths: defaultMonths,
        })
    }, [games])

    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([])
            return
        }
        const timer = setTimeout(async () => {
            setSearchLoading(true)
            const { data } = await supabase.rpc('hubgames_judi_search_pool', { p_query: searchQuery })
            setSearchResults((data || []).map((item: { steam_appid: number; game_name: string }) => ({ id: item.steam_appid, name: item.game_name })))
            setSearchLoading(false)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const loadUserAndGames = async () => {
        loadUserAndGamesRef.current = loadUserAndGames
        setLoading(true)
        const { data: { user: authUser } } = await safeGetUser()
        setUser(authUser)
        // Solo los días ya publicados (hasta hoy en Madrid), con tu progreso. Nombre y portada, solo de los terminados.
        const { data: rows } = await supabase.rpc('hubgames_judi_list')
        const rawLocal = authUser ? {} : getLocalProgressRaw()

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
            }
        }))
        setLoading(false)
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
        setSearchQuery('')
        setSearchResults([])
        setShowDropdown(false)
        setWrongGuesses([])
        setGuessError(null)

        const { data: { user: authUser } } = await safeGetUser()
        let day: JudiDay | null
        let progress: JudiProgress | undefined
        let savedWrongGuesses: string[] = []
        if (authUser) {
            const { data } = await supabase.rpc('hubgames_judi_get_day', { p_id: game.id })
            day = parseJudiDay(data)
            savedWrongGuesses = day?.guesses ?? []
        } else {
            progress = readLocalProgressForGame(game, getLocalProgressRaw())
            savedWrongGuesses = readLocalGuessesForGame(game, getLocalGuessesRaw())
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

        setWrongGuesses(savedWrongGuesses)
        if (state === 'won') {
            setGameState('won')
            setHighestUnlockedPhase(6)
            setActiveViewedPhase(6)
            // Vidas = intentos restantes; los fallos vienen de fase1..fase5 (el acierto no marca faseN).
            const failedOnWin = authUser ? day.failed ?? 0 : getFailedAttempts(progress as JudiProgressRecord)
            setLives(JUDI_ATTEMPT_SLOTS - failedOnWin)
        } else if (state === 'lost') {
            setGameState('lost')
            setHighestUnlockedPhase(6)
            setActiveViewedPhase(6)
            setLives(0)
        } else {
            setHighestUnlockedPhase(day.phase)
            setActiveViewedPhase(day.phase)
            setLives(7 - day.phase)
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

    const saveLocalGuesses = (gameRef: { id: number; fecha: string }, guesses: string[]) => {
        const guessesData = getLocalGuessesRaw()
        const next = writeJudiLocal(guessesData, gameRef.fecha, gameRef.id, guesses)
        if (guesses.length === 0) delete next[gameRef.fecha]
        localStorage.setItem('judi_intentos', JSON.stringify(next))
    }

    /** Feedback de fallo: sacudida del buscador + destello en la captura. */
    const signalMiss = () => {
        setFlashKey((k) => k + 1)
        if (guessScope.current) {
            void animateGuess(guessScope.current, { x: [0, -12, 10, -7, 5, -2, 0] }, { duration: 0.5, ease: 'easeOut' })
        }
    }

    /**
     * Envía un intento al servidor (#39); `guess` null = saltar. Con sesión, el servidor guarda el progreso; sin sesión,
     * solo lo comprueba y el progreso se guarda en localStorage.
     */
    const sendAttempt = async (guess: string | null) => {
        if (!selectedGame || gameState !== 'playing' || guessSubmitting) return
        const game = selectedGame.juego
        setGuessSubmitting(true)
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
            if (day.result === 'duplicate') return

            const reveal = { nombre: day.nombre, header_image: day.headerImage, appid: day.appid }
            if (day.nombre) {
                setSelectedGame((prev) => (prev ? { ...prev, juego: { ...prev.juego, ...reveal } } : prev))
            }
            setSelectedGame((prev) => (prev ? { ...prev, hints: day.hints, captureCount: day.captureCount } : prev))
            setSearchQuery('')
            setSearchResults([])
            setShowDropdown(false)

            if (day.state === 'won') {
                setGameState('won')
                if (!authUser) {
                    saveLocalProgress(game, { completado: true, ...reveal })
                    saveLocalGuesses(game, [])
                }
                return
            }

            signalMiss()
            if (guess) {
                const nextGuesses = [...wrongGuesses, guess]
                setWrongGuesses(nextGuesses)
                if (!authUser) saveLocalGuesses(game, nextGuesses)
            }
            if (day.state === 'lost') {
                setHighestUnlockedPhase(6)
                setLives(0)
                setGameState('lost')
                if (!authUser) saveLocalProgress(game, { fase6: true, ...reveal })
            } else {
                if (!authUser) saveLocalProgress(game, { [`fase${highestUnlockedPhase}`]: true })
                setHighestUnlockedPhase(day.phase)
                setActiveViewedPhase(day.phase)
                setLives(7 - day.phase)
            }
        } finally {
            setGuessSubmitting(false)
            window.dispatchEvent(new Event(JUDI_CHANGED_EVENT))
        }
    }

    const submitGuess = async (rawGuess: string) => {
        const guessText = rawGuess.trim()
        if (!guessText) return
        const alreadyGuessed = wrongGuesses.some((guess) => normalizeGameName(guess) === normalizeGameName(guessText))
        if (alreadyGuessed) return
        await sendAttempt(guessText)
    }

    /** Consume un intento sin elegir título (misma lógica que fallar, sin guardar nombre en intentos). */
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
        if (gameState !== 'won') {
            winConfettiFiredRef.current = false
            return
        }
        if (winConfettiFiredRef.current) return
        winConfettiFiredRef.current = true
        const id = window.setTimeout(() => {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
            const colors = systemConfettiColors()
            void confetti({
                particleCount: 90,
                spread: 70,
                origin: { y: 0.6 },
                colors,
                ticks: 180,
                scalar: 0.9,
                disableForReducedMotion: true,
            })
        }, 120)
        return () => window.clearTimeout(id)
    }, [gameState])

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
    const accordionLayoutKey = `${singleYear ? '1' : '0'}|${accordion.openYears.join('\u0001')}|${accordion.openMonths.join('\u0001')}`
    useEffect(() => {
        if (view !== 'start' || loading || games.length === 0) return
        if (homeScrollRestoreDoneRef.current) return

        const targetY = readSavedHomeScrollY()
        if (targetY <= 0) {
            homeScrollRestoreDoneRef.current = true
            return
        }

        const maxYInitial = getMaxScrollY()
        if (maxYInitial < 1 && accordion.openMonths.length === 0) {
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

    const h = selectedGame?.hints
    const hints = h
        ? [
            { phase: 2, label: 'Géneros', value: h.generos ?? 'N/D', icon: Tags },
            {
                phase: 3,
                label: 'Pico de jugadores (Steam)',
                value: h.ccu != null ? h.ccu.toLocaleString('es-ES') : 'N/D',
                icon: Users,
            },
            {
                phase: 4,
                label: 'Reseñas positivas (Steam)',
                value: h.positivas != null ? `${h.positivas} %` : 'N/D',
                icon: ThumbsUp,
            },
            { phase: 5, label: 'Año de lanzamiento', value: h.anio ?? 'N/D', icon: CalendarDays },
            { phase: 6, label: 'Estudio', value: h.estudio ?? 'N/D', icon: Building2 },
        ]
        : []
    const activeHint = hints.find((h) => h.phase === activeViewedPhase)

    const heroGame = games.find((g) => isJudiGameForCurrentDailyDate(g)) ?? games[0] ?? null

    const toggleYear = (year: string) => {
        setAccordion((prev) => {
            const openYears = prev.openYears.includes(year)
                ? prev.openYears.filter((y) => y !== year)
                : [...prev.openYears, year]
            const next = { ...prev, openYears }
            writeAccordionSession({
                openYears: next.openYears,
                openMonths: next.openMonths,
                userModified: true,
            })
            return next
        })
    }

    const toggleMonth = (monthKey: string) => {
        setAccordion((prev) => {
            const openMonths = prev.openMonths.includes(monthKey)
                ? prev.openMonths.filter((k) => k !== monthKey)
                : [...prev.openMonths, monthKey]
            const next = { ...prev, openMonths }
            writeAccordionSession({
                openYears: next.openYears,
                openMonths: next.openMonths,
                userModified: true,
            })
            return next
        })
    }

    const goBack = () => {
        setCaptureZoomOpen(false)
        setView('start')
        setSearchQuery('')
        setSearchResults([])
        setShowDropdown(false)
        router.push('/judi', { scroll: false })
        void loadUserAndGames()
    }

    const pipStates = gamePipStates(gameState, lives)
    const failedNow = Math.min(JUDI_ATTEMPT_SLOTS, Math.max(0, JUDI_ATTEMPT_SLOTS - lives))
    const earnedPoints = gameState === 'won' ? Math.max(JUDI_ATTEMPT_SLOTS - failedNow, 1) : 0
    const nextPendingGame = selectedGame
        ? games.find((g) => !g.completado && !g.fase6 && g.id !== selectedGame.juego.id) ?? null
        : null
    const currentCapture =
        selectedGame && selectedGame.captureCount > 0 ? judiCaptureUrl(selectedGame.juego.id, activeViewedPhase) : undefined

    const filterCounts: Record<ListFilter, number> = {
        all: games.length,
        pending: games.filter((g) => matchesFilter(g, 'pending')).length,
        won: stats.wins,
        lost: stats.losses,
    }

    const changeFilter = (next: ListFilter) => {
        setListFilter(next)
        sessionStorage.setItem(JUDI_FILTER_SESSION_KEY, next)
    }

    const playNext = (game: GameRecord) => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
        void startJuego(game)
    }

    const statTiles = [
        { label: 'puntos', value: stats.points.toLocaleString('es-ES') },
        { label: 'acertados', value: stats.wins.toLocaleString('es-ES') },
        { label: stats.streak === 1 ? 'día de racha' : 'días de racha', value: stats.streak.toLocaleString('es-ES') },
        { label: 'de precisión', value: `${stats.accuracy} %` },
    ]

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

                    <TodayCard game={heroGame} countdown={formatHmsCountdown(dailyCountdownMs)} onPlay={(g) => void startJuego(g)} />

                    <dl className="jd-kpis" aria-label="Tus estadísticas">
                        {statTiles.map((tile) => (
                            <div key={tile.label} className="jd-kpi">
                                <dt>{tile.label}</dt>
                                <dd>{tile.value}</dd>
                            </div>
                        ))}
                    </dl>

                    {!user && (
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
                    )}

                    <section className="hg-section jd-history" aria-labelledby="jd-history-title">
                        <div className="jd-history__head">
                            <div className="hg-section__head">
                                <h2 id="jd-history-title" className="hg-section__title">
                                    Historial <span className="hg-section__count">{games.length} juegos</span>
                                </h2>
                                <p className="hg-section__hint">Puedes jugar cualquier día pasado.</p>
                            </div>
                            <div className="hg-seg hg-seg--scroll" role="group" aria-label="Filtrar juegos">
                                {LIST_FILTERS.map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        aria-pressed={listFilter === f.id}
                                        className="hg-seg__opt"
                                        onClick={() => changeFilter(f.id)}
                                    >
                                        {f.label}
                                        <span className="hg-seg__count">{filterCounts[f.id]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {yearGroups.length === 0 && (
                            <div className="hg-empty">
                                <p>Nada por aquí con este filtro.</p>
                            </div>
                        )}

                        {yearGroups.map((yg) => {
                            const yearOpen = singleYear || accordion.openYears.includes(yg.year)
                            const yearGames = yg.months.flatMap((m) => m.games)
                            const yearWon = yearGames.filter((g) => g.completado).length
                            const monthBlocks = yg.months.map((group) => {
                                const isOpen = accordion.openMonths.includes(group.key)
                                const won = group.games.filter((g) => g.completado).length
                                const lost = group.games.filter((g) => g.fase6 && !g.completado).length
                                const total = group.games.length
                                return (
                                    <div key={group.key} className="jd-month">
                                        <button
                                            type="button"
                                            className={`jd-month__head${isOpen ? ' is-open' : ''}`}
                                            onClick={() => toggleMonth(group.key)}
                                            aria-expanded={isOpen}
                                        >
                                            <ChevronDown size={16} className="jd-chev" aria-hidden />
                                            <span className="jd-month__label">{group.label}</span>
                                            <span className="jd-month__bar" aria-hidden>
                                                <span className="jd-month__bar-won" style={{ width: `${total ? (won / total) * 100 : 0}%` }} />
                                                <span className="jd-month__bar-lost" style={{ width: `${total ? (lost / total) * 100 : 0}%` }} />
                                            </span>
                                            <span className="jd-month__count">
                                                <b>{won}</b> de {total} acertados
                                            </span>
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {isOpen && (
                                                <motion.div
                                                    key="content"
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ height: { duration: 0.25, ease: EASE_OUT }, opacity: { duration: 0.15 } }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <ul className="jd-tiles">
                                                        {group.games.map((game) => (
                                                            <GameTile key={game.id} game={game} onPlay={(g) => void startJuego(g)} />
                                                        ))}
                                                    </ul>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )
                            })
                            return (
                                <div key={yg.year} className="jd-year">
                                    {!singleYear && (
                                        <button
                                            type="button"
                                            className={`jd-year__head${yearOpen ? ' is-open' : ''}`}
                                            onClick={() => toggleYear(yg.year)}
                                            aria-expanded={yearOpen}
                                        >
                                            <ChevronDown size={18} className="jd-chev" aria-hidden />
                                            <span className="jd-year__label">{yg.label}</span>
                                            <span className="jd-year__meta">
                                                {yearWon} de {yearGames.length} acertados
                                            </span>
                                        </button>
                                    )}
                                    {singleYear ? (
                                        <div className="jd-months">{monthBlocks}</div>
                                    ) : (
                                        <AnimatePresence initial={false}>
                                            {yearOpen && (
                                                <motion.div
                                                    key={`y-${yg.year}`}
                                                    className="jd-months"
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ height: { duration: 0.25, ease: EASE_OUT }, opacity: { duration: 0.15 } }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    {monthBlocks}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    )}
                                </div>
                            )
                        })}
                    </section>
                </>
            ) : (
                selectedGame && (
                    <>
                        <section className={`jd-game${playingDailyGame ? ' jd-game--today' : ''}`}>
                            <div className="jd-game__top">
                                <button type="button" className="hg-icon-btn jd-back" onClick={goBack} aria-label="Volver al historial">
                                    <ArrowLeft size={18} aria-hidden />
                                </button>
                                <div className="jd-game__title">
                                    <h1 className="jd-game__heading">
                                        JUDI #{selectedGame.juego.id}
                                        <span className={`hg-chip${playingDailyGame ? ' hg-chip--playing' : ''}`}>
                                            {playingDailyGame ? 'Juego de hoy' : 'Archivo'}
                                        </span>
                                    </h1>
                                    <p className="jd-game__date">{formatLongDate(selectedGame.juego.fecha)}</p>
                                </div>
                                <div className="jd-game__right">
                                    <div className="jd-lives">
                                        <span className="jd-lives__label">Intentos</span>
                                        <AttemptPips states={pipStates} />
                                    </div>
                                    {gameState === 'playing' ? (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => void skipAttempt()}
                                            disabled={guessSubmitting}
                                            title="Saltar intento: pierdes una vida sin elegir título (no se guarda en tus fallos)"
                                        >
                                            <SkipForward aria-hidden />
                                            Saltar
                                        </Button>
                                    ) : null}
                                </div>
                            </div>

                            <div className="jd-game__grid">
                                <div className="jd-stage-col">
                                    <div
                                        className="jd-stage"
                                        role="region"
                                        aria-label="Captura del juego. Desliza horizontalmente para cambiar de fase."
                                        onTouchStart={onCaptureTouchStart}
                                        onTouchEnd={onCaptureTouchEnd}
                                    >
                                        <AnimatePresence initial={false} custom={phaseDirRef.current}>
                                            {currentCapture && (
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
                                                />
                                            )}
                                        </AnimatePresence>
                                        {selectedGame.captureCount === 0 && (
                                            <div className="jd-stage__empty">
                                                <MysteryArt big />
                                            </div>
                                        )}
                                        {selectedGame.captureCount > 0 && (
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
                                        {activeHint && (
                                            <div key={activeHint.phase} className="jd-stage__hint">
                                                <span className="jd-stage__hint-label">{activeHint.label}</span>
                                                <span className="jd-stage__hint-value">{activeHint.value}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="jd-phases" role="tablist" aria-label="Fases">
                                        {[1, 2, 3, 4, 5, 6].map((phase) => {
                                            const isActive = phase === activeViewedPhase
                                            const isLocked = phase > highestUnlockedPhase && gameState === 'playing'
                                            return (
                                                <button
                                                    key={phase}
                                                    type="button"
                                                    role="tab"
                                                    aria-selected={isActive}
                                                    aria-label={isLocked ? `Fase ${phase} (bloqueada)` : `Fase ${phase}`}
                                                    disabled={isLocked}
                                                    onClick={() => setActiveViewedPhase(phase)}
                                                    className="jd-phase"
                                                >
                                                    {isLocked ? <Lock size={13} aria-hidden /> : phase}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    <p className="jd-keyhint">
                                        <kbd className="hg-kbd">←</kbd> <kbd className="hg-kbd">→</kbd> para cambiar de captura
                                    </p>
                                </div>

                                <aside className="jd-panel">
                                    {gameState === 'playing' ? (
                                        <div className="jd-guess-block">
                                            <label className="jd-panel__title" htmlFor="judi-guess">
                                                ¿Qué juego es?
                                            </label>
                                            <div ref={guessScope} className="jd-guess">
                                                <Search size={16} className="jd-guess__icon" aria-hidden />
                                                <input
                                                    id="judi-guess"
                                                    type="text"
                                                    className="hg-input jd-guess__input"
                                                    value={searchQuery}
                                                    onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true) }}
                                                    onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
                                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && searchQuery.trim().length >= 2 && !guessSubmitting) {
                                                            e.preventDefault()
                                                            void submitGuess(searchQuery.trim())
                                                        }
                                                    }}
                                                    placeholder={guessSubmitting ? 'Comprobando…' : 'Escribe el nombre del juego'}
                                                    disabled={guessSubmitting}
                                                    autoComplete="off"
                                                />
                                                {searchLoading && <span className="jd-guess__spinner" aria-hidden />}
                                                {showDropdown && searchResults.length > 0 && (
                                                    <div className="jd-guess__dropdown soft-scrollbar">
                                                        {searchResults.map((option) => {
                                                            const alreadyGuessed = wrongGuesses.some((g) => normalizeGameName(g) === normalizeGameName(option.name))
                                                            return (
                                                                <button
                                                                    key={option.id}
                                                                    type="button"
                                                                    disabled={alreadyGuessed}
                                                                    className="jd-guess__option"
                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                    onClick={() => { if (!alreadyGuessed) { void submitGuess(option.name); setShowDropdown(false) } }}
                                                                >
                                                                    <span>{option.name}</span>
                                                                    {alreadyGuessed && <X size={14} aria-label="Ya probado" />}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                                {showDropdown && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
                                                    <div className="jd-guess__dropdown jd-guess__dropdown--empty">Sin resultados</div>
                                                )}
                                            </div>
                                            {guessError && (
                                                <p className="alert alert--error jd-guess__error" role="alert">
                                                    {guessError}
                                                </p>
                                            )}
                                            <p className="jd-guess__help">Cada fallo desbloquea una captura y una pista nuevas.</p>
                                            {wrongGuesses.length > 0 && (
                                                <ul className="jd-wrong" aria-label="Intentos fallados">
                                                    {wrongGuesses.map((guess, index) => (
                                                        <li key={`${guess}-${index}`} className="jd-wrong__chip">
                                                            <X size={12} strokeWidth={2.75} aria-hidden />
                                                            {guess}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ) : (
                                        <motion.div
                                            className={`jd-result jd-result--${gameState}`}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.25, ease: EASE_OUT }}
                                            role="status"
                                        >
                                            <div className="jd-result__head">
                                                <span className="jd-result__icon" aria-hidden>
                                                    {gameState === 'won' ? <Check size={18} strokeWidth={3} /> : <X size={18} strokeWidth={3} />}
                                                </span>
                                                <p className="jd-result__status">
                                                    {gameState === 'won'
                                                        ? failedNow === 0
                                                            ? 'Acertado a la primera'
                                                            : `Acertado en el intento ${failedNow + 1}`
                                                        : 'Fallado'}
                                                </p>
                                                <p className="jd-result__pts">
                                                    {gameState === 'won' ? `+${earnedPoints}` : '0'}
                                                    <small>puntos</small>
                                                </p>
                                            </div>
                                            <div className="jd-result__game">
                                                {selectedGame.juego.header_image && <img src={selectedGame.juego.header_image} alt="" />}
                                                <div>
                                                    <span className="jd-result__label">El juego era</span>
                                                    <p className="jd-result__name">
                                                        {selectedGame.juego.nombre}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="jd-result__actions">
                                                <Button variant="secondary" onClick={goBack}>
                                                    <ArrowLeft size={15} data-icon="inline-start" aria-hidden />
                                                    Historial
                                                </Button>
                                                {nextPendingGame && (
                                                    <Button onClick={() => playNext(nextPendingGame)}>
                                                        Siguiente reto
                                                        <ArrowRight size={15} data-icon="inline-end" aria-hidden />
                                                    </Button>
                                                )}
                                            </div>
                                            <JudiFinishActions
                                                game={selectedGame.juego}
                                                appid={selectedGame.juego.appid ?? null}
                                                state={gameState}
                                                failed={failedNow}
                                                loggedIn={!!user}
                                            />
                                        </motion.div>
                                    )}

                                    <div className="jd-hints">
                                        <h2 className="jd-panel__title">Pistas</h2>
                                        <ul className="jd-hints__list">
                                            {hints.map((hint) => {
                                                const unlocked = hint.phase <= highestUnlockedPhase
                                                const Icon = hint.icon
                                                return (
                                                    <li key={hint.phase}>
                                                        <button
                                                            type="button"
                                                            className={`jd-hint${unlocked ? '' : ' is-locked'}${activeViewedPhase === hint.phase ? ' is-active' : ''}`}
                                                            disabled={!unlocked}
                                                            aria-pressed={unlocked ? activeViewedPhase === hint.phase : undefined}
                                                            onClick={() => setActiveViewedPhase(hint.phase)}
                                                        >
                                                            <span className="jd-hint__icon">{unlocked ? <Icon size={15} aria-hidden /> : <Lock size={13} aria-hidden />}</span>
                                                            <span className="jd-hint__text">
                                                                <span className="jd-hint__label">{hint.label}</span>
                                                                <span className="jd-hint__value">
                                                                    {unlocked ? hint.value : 'Bloqueada'}
                                                                </span>
                                                            </span>
                                                            <span className="jd-hint__phase">Fase {hint.phase}</span>
                                                        </button>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </div>
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
