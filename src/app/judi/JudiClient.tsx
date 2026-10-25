'use client'

import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useAnimate } from 'framer-motion'
import { supabase, safeGetUser } from '@/lib/supabase/client'
import Loader from '@/components/Loader'
import { getFailedAttempts, getPointsForRecord, type JudiProgressRecord } from '@/lib/judi-ranking'
import { findJudiLocalKey, judiCaptureUrl, parseJudiDay, writeJudiLocal, type JudiDay, type JudiHints } from '@/lib/judi'
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
    Clock,
    Flame,
    Gamepad2,
    Lock,
    Maximize2,
    Percent,
    Search,
    SkipForward,
    Sparkles,
    Tags,
    Target,
    ThumbsUp,
    Trophy,
    Users,
    X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CountUp, Reveal, RollingText, useTilt } from '@/components/motion'
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
        <div className={`pips pips--${size}`} role="img" aria-label={`${misses} de ${JUDI_ATTEMPT_SLOTS} intentos fallados`}>
            {states.map((state, i) => (
                <motion.span
                    key={i}
                    className={`pip pip--${state}`}
                    initial={false}
                    animate={state === 'empty' ? { scale: 1 } : { scale: [1, 1.6, 1] }}
                    transition={{ duration: 0.45, ease: 'easeOut', delay: state === 'hit' ? i * 0.04 : 0 }}
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

/** Arte de "juego misterioso" para partidas sin resolver (no revela la portada). */
function MysteryArt({ seed, big = false }: { seed: number; big?: boolean }) {
    // Tonos dentro de la paleta de marca (cian → violeta → magenta).
    const hue = 190 + ((seed * 47) % 150)
    return (
        <div className={`mystery ${big ? 'mystery--big' : ''}`} style={{ ['--h' as string]: hue }} aria-hidden>
            <span className="mystery__q">?</span>
            <span className="mystery__scan" />
        </div>
    )
}

function GameTile({ game, index, onPlay }: { game: GameRecord; index: number; onPlay: (game: GameRecord) => void }) {
    const tilt = useTilt<HTMLButtonElement>(9)
    const status = getTileStatus(game)
    const finished = status === 'won' || status === 'lost'
    const failed = getFailedAttempts(game as JudiProgressRecord)
    const isToday = isJudiGameForCurrentDailyDate(game)

    return (
        <motion.button
            type="button"
            data-game-row
            className={`tile tile--${status}${isToday ? ' tile--today glow-border' : ''}`}
            onClick={() => onPlay(game)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT, delay: Math.min(index, 14) * 0.03 }}
            {...tilt}
        >
            <div className="tile__art">
                {finished && game.header_image ? (
                    <img src={game.header_image} alt="" loading="lazy" draggable={false} />
                ) : (
                    <MysteryArt seed={game.id} />
                )}
                <span className="tile__num">#{game.id}</span>
                {isToday && <span className="tile__today">Hoy</span>}
                {finished && (
                    <span className={`tile__badge tile__badge--${status}`} aria-hidden>
                        {status === 'won' ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
                    </span>
                )}
            </div>
            <div className="tile__body">
                <span className="tile__date">{formatShortDate(game.fecha)}</span>
                <span className="tile__title">
                    {finished ? game.nombre ?? (status === 'won' ? 'Acertado' : 'Fallado') : status === 'progress' ? 'En curso' : 'Sin jugar'}
                </span>
                <div className="tile__foot">
                    {finished ? (
                        <span className={`tile__pts ${(game.puntos ?? 0) > 0 ? 'is-pos' : 'is-zero'}`}>
                            {status === 'won' ? `+${game.puntos ?? 0}` : '0'} pts
                        </span>
                    ) : status === 'progress' ? (
                        <AttemptPips states={listPipStates(failed)} size="sm" />
                    ) : (
                        <span className="tile__play">
                            Jugar <ArrowRight size={13} />
                        </span>
                    )}
                </div>
            </div>
            <span className="tile__glare" aria-hidden />
        </motion.button>
    )
}

function HeroCard({ game, onPlay }: { game: GameRecord | null; onPlay: (game: GameRecord) => void }) {
    const tilt = useTilt<HTMLButtonElement>(7)
    if (!game) return null
    const status = getTileStatus(game)
    const finished = status === 'won' || status === 'lost'
    const failed = getFailedAttempts(game as JudiProgressRecord)
    const parsed = parseLegacyDate(game.fecha)
    const longDate = parsed
        ? parsed.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
        : game.fecha

    return (
        <motion.div
            className="hero-card-wrap"
            initial={{ opacity: 0, y: 24, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.15 }}
        >
            <span className="hero-card-ghost hero-card-ghost--1" aria-hidden />
            <span className="hero-card-ghost hero-card-ghost--2" aria-hidden />
            <button type="button" className={`hero-card hero-card--${status} glow-border`} onClick={() => onPlay(game)} {...tilt}>
                <div className="hero-card__art">
                    {finished && game.header_image ? (
                        <img src={game.header_image} alt="" draggable={false} />
                    ) : (
                        <MysteryArt seed={game.id} big />
                    )}
                </div>
                <div className="hero-card__overlay">
                    <div className="hero-card__row">
                        <span className="hero-card__num">JUDI #{game.id}</span>
                        <span className={`hero-card__state hero-card__state--${status}`}>
                            {status === 'won' ? 'Acertado' : status === 'lost' ? 'Fallado' : status === 'progress' ? 'En curso' : 'Sin jugar'}
                        </span>
                    </div>
                    <span className="hero-card__date">{longDate}</span>
                    <div className="hero-card__row hero-card__row--bottom">
                        <span className="hero-card__name">{finished ? game.nombre ?? (status === 'won' ? 'Acertado' : 'Fallado') : '¿Lo reconoces?'}</span>
                        <AttemptPips
                            states={
                                status === 'won'
                                    ? gamePipStates('won', JUDI_ATTEMPT_SLOTS - failed)
                                    : status === 'lost'
                                        ? gamePipStates('lost', 0)
                                        : listPipStates(failed)
                            }
                        />
                    </div>
                </div>
                <span className="tile__glare" aria-hidden />
            </button>
        </motion.div>
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
    enter: (dir: number) => ({ opacity: 0, x: dir * 60, scale: 1.04, filter: 'blur(6px)' }),
    center: { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' },
    exit: (dir: number) => ({ opacity: 0, x: dir * -60, scale: 0.98, filter: 'blur(6px)' }),
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
            const colors = ['#b69cff', '#6f8bff', '#2ad4f0', '#34d399', '#fcd34d', '#f472b6']
            void confetti({
                particleCount: 130,
                spread: 78,
                origin: { y: 0.62 },
                colors,
                ticks: 220,
            })
            void confetti({
                particleCount: 55,
                spread: 110,
                origin: { y: 0.58, x: 0.25 },
                colors,
                scalar: 0.85,
                startVelocity: 38,
            })
            void confetti({
                particleCount: 55,
                spread: 110,
                origin: { y: 0.58, x: 0.75 },
                colors,
                scalar: 0.85,
                startVelocity: 38,
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
        { label: 'Puntos', value: stats.points, suffix: '', icon: Sparkles, tone: 'violet' },
        { label: 'Acertados', value: stats.wins, suffix: '', icon: Target, tone: 'green' },
        { label: 'Racha', value: stats.streak, suffix: '', icon: Flame, tone: 'orange' },
        { label: 'Precisión', value: stats.accuracy, suffix: '%', icon: Percent, tone: 'cyan' },
    ] as const

    return (
        <div className="judi">
            {view === 'start' ? (
                <>
                    <section className="hero">
                        <div className="hero__copy">
                            <motion.span
                                className="eyebrow"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, ease: EASE_OUT }}
                            >
                                <span className="eyebrow__dot" />
                                JUDI · Juego del día
                            </motion.span>
                            <h1 className="hero__title">
                                {['¿Qué', 'juego'].map((word, i) => (
                                    <motion.span
                                        key={word}
                                        className="hero__word"
                                        initial={{ opacity: 0, y: '0.6em', filter: 'blur(8px)' }}
                                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                        transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.08 + i * 0.08 }}
                                    >
                                        {word}
                                    </motion.span>
                                ))}
                                <br />
                                <motion.span
                                    className="hero__word"
                                    initial={{ opacity: 0, y: '0.6em', filter: 'blur(8px)' }}
                                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                    transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.24 }}
                                >
                                    es <span className="text-gradient hero__shine">hoy</span>?
                                </motion.span>
                            </h1>
                            <Reveal delay={0.35}>
                                <p className="hero__lead">
                                    6 capturas, 5 pistas y un único videojuego. Cuanto antes lo adivines, más puntos sumas en el ranking.
                                </p>
                            </Reveal>
                            <Reveal delay={0.45} className="hero__actions">
                                {heroGame && (
                                    <Button size="lg" onClick={() => void startJuego(heroGame)} data-play>
                                        {getTileStatus(heroGame) === 'won' || getTileStatus(heroGame) === 'lost'
                                            ? 'Ver resultado'
                                            : getTileStatus(heroGame) === 'progress'
                                                ? 'Continuar partida'
                                                : 'Jugar ahora'}
                                        <ArrowRight size={18} data-icon="inline-end" aria-hidden />
                                    </Button>
                                )}
                                <div className="countdown" aria-live="polite">
                                    <Clock size={15} aria-hidden />
                                    <span className="countdown__label">Nuevo juego en</span>
                                    <RollingText text={formatHmsCountdown(dailyCountdownMs)} className="countdown__time" />
                                </div>
                            </Reveal>
                        </div>
                        <HeroCard game={heroGame} onPlay={(g) => void startJuego(g)} />
                    </section>

                    <section className="stats" aria-label="Tus estadísticas">
                        {statTiles.map((tile, i) => {
                            const Icon = tile.icon
                            return (
                                <motion.div
                                    key={tile.label}
                                    className={`stat stat--${tile.tone}`}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.3 + i * 0.07 }}
                                    whileHover={{ y: -3 }}
                                >
                                    <span className="stat__icon">
                                        <Icon size={18} aria-hidden />
                                    </span>
                                    <span className="stat__label">{tile.label}</span>
                                    <CountUp value={tile.value} suffix={tile.suffix} className="stat__value" />
                                </motion.div>
                            )
                        })}
                    </section>

                    {!user && (
                        <Reveal delay={0.4} className="nudge glass">
                            <span className="nudge__icon">
                                <Trophy size={18} aria-hidden />
                            </span>
                            <p className="nudge__text">
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
                        </Reveal>
                    )}

                    <section className="history" aria-label="Historial de juegos">
                        <div className="history__head">
                            <div>
                                <h2 className="history__title">Historial</h2>
                                <p className="history__sub">{games.length} juegos desde el inicio. Puedes jugar cualquier día pasado.</p>
                            </div>
                            <div className="segmented" role="tablist" aria-label="Filtrar juegos">
                                {LIST_FILTERS.map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={listFilter === f.id}
                                        className={`segmented__btn ${listFilter === f.id ? 'active' : ''}`}
                                        onClick={() => changeFilter(f.id)}
                                    >
                                        {listFilter === f.id && (
                                            <motion.span
                                                layoutId="filter-pill"
                                                className="segmented__pill"
                                                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                            />
                                        )}
                                        <span className="segmented__label">{f.label}</span>
                                        <span className="segmented__count">{filterCounts[f.id]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {yearGroups.length === 0 && (
                            <motion.div className="history__empty" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                                <Gamepad2 size={28} aria-hidden />
                                <p>Nada por aquí con este filtro.</p>
                            </motion.div>
                        )}

                        {yearGroups.map((yg, yearIndex) => {
                            const yearOpen = singleYear || accordion.openYears.includes(yg.year)
                            const yearGames = yg.months.flatMap((m) => m.games)
                            const yearWon = yearGames.filter((g) => g.completado).length
                            return (
                                <motion.div
                                    key={yg.year}
                                    className="year"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3, ease: 'easeOut', delay: yearIndex * 0.05 }}
                                >
                                    {!singleYear && (
                                        <button
                                            type="button"
                                            className={`year-head ${yearOpen ? 'is-open' : ''}`}
                                            onClick={() => toggleYear(yg.year)}
                                            aria-expanded={yearOpen}
                                        >
                                            <span className="year-head__label">{yg.label}</span>
                                            <span className="year-head__meta">
                                                {yearWon}/{yearGames.length} acertados
                                            </span>
                                            <motion.span
                                                className="year-head__chev"
                                                animate={{ rotate: yearOpen ? 0 : -90 }}
                                                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                                            >
                                                <ChevronDown size={18} />
                                            </motion.span>
                                        </button>
                                    )}
                                    <AnimatePresence initial={false}>
                                        {yearOpen &&
                                            (() => {
                                                const monthBlocks = yg.months.map((group, monthIndex) => {
                                                    const isOpen = accordion.openMonths.includes(group.key)
                                                    const animIndex = yearIndex * 8 + monthIndex
                                                    const won = group.games.filter((g) => g.completado).length
                                                    const lost = group.games.filter((g) => g.fase6 && !g.completado).length
                                                    const total = group.games.length
                                                    return (
                                                        <motion.div
                                                            key={group.key}
                                                            className="month"
                                                            initial={{ opacity: 0, y: 6 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ duration: 0.25, ease: 'easeOut', delay: singleYear ? animIndex * 0.05 : 0 }}
                                                        >
                                                            <button
                                                                type="button"
                                                                className={`month-head ${isOpen ? 'is-open' : ''}`}
                                                                onClick={() => toggleMonth(group.key)}
                                                                aria-expanded={isOpen}
                                                            >
                                                                <motion.span
                                                                    className="month-head__chev"
                                                                    animate={{ rotate: isOpen ? 0 : -90 }}
                                                                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                                                                >
                                                                    <ChevronDown size={16} />
                                                                </motion.span>
                                                                <span className="month-head__label">{group.label}</span>
                                                                <span className="month-head__bar" aria-hidden>
                                                                    <motion.span
                                                                        className="month-head__bar-won"
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${total ? (won / total) * 100 : 0}%` }}
                                                                        transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 }}
                                                                    />
                                                                    <motion.span
                                                                        className="month-head__bar-lost"
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${total ? (lost / total) * 100 : 0}%` }}
                                                                        transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.3 }}
                                                                    />
                                                                </span>
                                                                <span className="month-head__count">
                                                                    {won}/{total}
                                                                </span>
                                                            </button>
                                                            <AnimatePresence initial={false}>
                                                                {isOpen && (
                                                                    <motion.div
                                                                        key="content"
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        transition={{ height: { duration: 0.35, ease: EASE_OUT }, opacity: { duration: 0.2 } }}
                                                                        style={{ overflow: 'hidden' }}
                                                                    >
                                                                        <div className="tile-grid">
                                                                            {group.games.map((game, gameIndex) => (
                                                                                <GameTile key={game.id} game={game} index={gameIndex} onPlay={(g) => void startJuego(g)} />
                                                                            ))}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </motion.div>
                                                    )
                                                })
                                                return singleYear ? (
                                                    <div key={`y-${yg.year}`}>{monthBlocks}</div>
                                                ) : (
                                                    <motion.div
                                                        key={`y-${yg.year}`}
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ height: { duration: 0.35, ease: EASE_OUT }, opacity: { duration: 0.2 } }}
                                                        style={{ overflow: 'hidden' }}
                                                    >
                                                        {monthBlocks}
                                                    </motion.div>
                                                )
                                            })()}
                                    </AnimatePresence>
                                </motion.div>
                            )
                        })}
                    </section>
                </>
            ) : (
                selectedGame && (
                    <>
                        <motion.section
                            className={`game ${playingDailyGame ? 'game--today' : ''}`}
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: EASE_OUT }}
                        >
                            <div className="game-top">
                                <motion.button
                                    type="button"
                                    className="icon-btn"
                                    onClick={goBack}
                                    aria-label="Volver al historial"
                                    whileHover={{ x: -2 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <ArrowLeft size={18} />
                                </motion.button>
                                <div className="game-top__title">
                                    <span className="eyebrow">
                                        {playingDailyGame ? (
                                            <>
                                                <span className="eyebrow__dot" />
                                                Juego de hoy
                                            </>
                                        ) : (
                                            'Archivo'
                                        )}
                                    </span>
                                    <h1 className="game-top__heading">
                                        JUDI #{selectedGame.juego.id}
                                        <span className="game-top__date">{formatLongDate(selectedGame.juego.fecha)}</span>
                                    </h1>
                                </div>
                                <div className="game-top__right">
                                    <div className="lives">
                                        <span className="lives__label">Intentos</span>
                                        <AttemptPips states={pipStates} />
                                    </div>
                                    {gameState === 'playing' ? (
                                        <motion.button
                                            type="button"
                                            className="chip-btn"
                                            onClick={() => void skipAttempt()}
                                            disabled={guessSubmitting}
                                            title="Saltar intento: pierdes una vida sin elegir título (no se guarda en tus fallos)"
                                            whileTap={{ scale: 0.92 }}
                                        >
                                            <SkipForward size={14} strokeWidth={2.25} aria-hidden />
                                            Saltar
                                        </motion.button>
                                    ) : null}
                                </div>
                            </div>

                            <div className="game-grid">
                                <div className="game-stage-col">
                                    <div
                                        className="stage"
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
                                                    className="stage__img"
                                                    custom={phaseDirRef.current}
                                                    variants={phaseImageVariants}
                                                    initial="enter"
                                                    animate="center"
                                                    exit="exit"
                                                    transition={{ duration: 0.45, ease: EASE_OUT }}
                                                />
                                            )}
                                        </AnimatePresence>
                                        {selectedGame.captureCount === 0 && (
                                            <div className="stage__empty">
                                                <MysteryArt seed={selectedGame.juego.id} big />
                                            </div>
                                        )}
                                        {selectedGame.captureCount > 0 && (
                                            <button type="button" className="stage__zoom" onClick={onCaptureImageClick} aria-label="Ampliar captura">
                                                <span className="stage__zoom-icon">
                                                    <Maximize2 size={16} />
                                                </span>
                                            </button>
                                        )}
                                        <span className="stage__badge">
                                            Captura <strong>{activeViewedPhase}</strong>/6
                                        </span>
                                        <AnimatePresence>
                                            {flashKey > 0 && (
                                                <motion.span
                                                    key={flashKey}
                                                    className="stage__flash"
                                                    initial={{ opacity: 0.85 }}
                                                    animate={{ opacity: 0 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ duration: 0.7, ease: 'easeOut' }}
                                                />
                                            )}
                                        </AnimatePresence>
                                        <AnimatePresence mode="wait">
                                            {activeHint && (
                                                <motion.div
                                                    key={activeHint.phase}
                                                    className="stage__hint"
                                                    initial={{ opacity: 0, y: 14 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 8 }}
                                                    transition={{ duration: 0.3, ease: EASE_OUT }}
                                                >
                                                    <activeHint.icon size={15} aria-hidden />
                                                    <span className="stage__hint-label">{activeHint.label}</span>
                                                    <span className="stage__hint-value">{activeHint.value}</span>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div className="phase-tabs" role="tablist" aria-label="Fases">
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
                                                    className={`phase-tab ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                                                >
                                                    {isActive && (
                                                        <motion.span
                                                            layoutId="phase-pill"
                                                            className="phase-tab__pill"
                                                            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                                                        />
                                                    )}
                                                    <span className="phase-tab__label">
                                                        {isLocked ? <Lock size={12} aria-hidden /> : phase}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <aside className="game-panel glass">
                                    {gameState === 'playing' ? (
                                        <div className="guess-block">
                                            <label className="panel-title" htmlFor="judi-guess">
                                                ¿Qué juego es?
                                            </label>
                                            <div ref={guessScope} className="guess">
                                                <Search size={17} className="guess__icon" aria-hidden />
                                                <input
                                                    id="judi-guess"
                                                    type="text"
                                                    className="guess__input"
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
                                                    placeholder={guessSubmitting ? 'Validando...' : 'Escribe el nombre del juego...'}
                                                    disabled={guessSubmitting}
                                                    autoComplete="off"
                                                />
                                                {searchLoading && <span className="guess__spinner" aria-hidden />}
                                                <AnimatePresence>
                                                    {showDropdown && searchResults.length > 0 && (
                                                        <motion.div
                                                            className="guess__dropdown soft-scrollbar"
                                                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                                            transition={{ duration: 0.18, ease: 'easeOut' }}
                                                        >
                                                            {searchResults.map((option, i) => {
                                                                const alreadyGuessed = wrongGuesses.some((g) => normalizeGameName(g) === normalizeGameName(option.name))
                                                                return (
                                                                    <motion.button
                                                                        key={option.id}
                                                                        type="button"
                                                                        disabled={alreadyGuessed}
                                                                        className={`guess__option ${alreadyGuessed ? 'is-guessed' : ''}`}
                                                                        onMouseDown={(e) => e.preventDefault()}
                                                                        onClick={() => { if (!alreadyGuessed) { void submitGuess(option.name); setShowDropdown(false) } }}
                                                                        initial={{ opacity: 0, x: -6 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        transition={{ duration: 0.18, delay: Math.min(i, 8) * 0.02 }}
                                                                    >
                                                                        <span>{option.name}</span>
                                                                        {alreadyGuessed ? <X size={14} aria-hidden /> : <ArrowRight size={14} className="guess__option-arrow" aria-hidden />}
                                                                    </motion.button>
                                                                )
                                                            })}
                                                        </motion.div>
                                                    )}
                                                    {showDropdown && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
                                                        <motion.div
                                                            className="guess__dropdown guess__dropdown--empty"
                                                            initial={{ opacity: 0, y: -6 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -6 }}
                                                        >
                                                            Sin resultados
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                            {guessError && (
                                                <p className="guess__error" role="alert">
                                                    {guessError}
                                                </p>
                                            )}
                                            <p className="guess__help">
                                                Cada fallo desbloquea una captura y una pista nuevas.{' '}
                                                <span className="guess__help-keys">Usa ← → para moverte entre fases.</span>
                                            </p>
                                            {wrongGuesses.length > 0 && (
                                                <div className="wrong-list">
                                                    <AnimatePresence initial={false}>
                                                        {wrongGuesses.map((guess, index) => (
                                                            <motion.span
                                                                key={`${guess}-${index}`}
                                                                className="wrong-chip"
                                                                initial={{ opacity: 0, scale: 0.6, y: 6 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                                                            >
                                                                <X size={12} strokeWidth={3} aria-hidden />
                                                                {guess}
                                                            </motion.span>
                                                        ))}
                                                    </AnimatePresence>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <motion.div
                                            className={`result result--${gameState}`}
                                            initial={{ opacity: 0, scale: 0.94, y: 12 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                                        >
                                            {selectedGame.juego.header_image && (
                                                <div className="result__art">
                                                    <img src={selectedGame.juego.header_image} alt="" />
                                                </div>
                                            )}
                                            <motion.span
                                                className="result__icon"
                                                initial={{ scale: 0, rotate: -30 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                transition={{ type: 'spring', stiffness: 420, damping: 14, delay: 0.15 }}
                                            >
                                                {gameState === 'won' ? <Trophy size={22} /> : <X size={22} strokeWidth={3} />}
                                            </motion.span>
                                            <p className="result__status">{gameState === 'won' ? '¡Acertado!' : 'Fallado'}</p>
                                            <p className="result__label">El juego era</p>
                                            <p className="result__name">{selectedGame.juego.nombre}</p>
                                            {gameState === 'won' && (
                                                <p className="result__pts">
                                                    +<CountUp value={earnedPoints} /> pts
                                                </p>
                                            )}
                                            <div className="result__actions">
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

                                    <div className="hints">
                                        <span className="panel-title">Pistas</span>
                                        <ul className="hints__list">
                                            {hints.map((hint) => {
                                                const unlocked = hint.phase <= highestUnlockedPhase
                                                const Icon = hint.icon
                                                return (
                                                    <li key={hint.phase}>
                                                        <button
                                                            type="button"
                                                            className={`hint ${unlocked ? 'is-unlocked' : 'is-locked'} ${activeViewedPhase === hint.phase ? 'is-active' : ''}`}
                                                            disabled={!unlocked}
                                                            onClick={() => setActiveViewedPhase(hint.phase)}
                                                        >
                                                            <span className="hint__icon">{unlocked ? <Icon size={15} aria-hidden /> : <Lock size={13} aria-hidden />}</span>
                                                            <span className="hint__text">
                                                                <span className="hint__label">{hint.label}</span>
                                                                <AnimatePresence mode="wait" initial={false}>
                                                                    {unlocked ? (
                                                                        <motion.span
                                                                            key="v"
                                                                            className="hint__value"
                                                                            initial={{ opacity: 0, filter: 'blur(6px)' }}
                                                                            animate={{ opacity: 1, filter: 'blur(0px)' }}
                                                                            transition={{ duration: 0.5 }}
                                                                        >
                                                                            {hint.value}
                                                                        </motion.span>
                                                                    ) : (
                                                                        <span key="l" className="hint__value hint__value--locked">
                                                                            Se desbloquea en la fase {hint.phase}
                                                                        </span>
                                                                    )}
                                                                </AnimatePresence>
                                                            </span>
                                                            <span className="hint__phase">F{hint.phase}</span>
                                                        </button>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </div>
                                </aside>
                            </div>
                        </motion.section>

                        <Dialog open={captureZoomOpen} onOpenChange={setCaptureZoomOpen}>
                            <DialogPrimitive.Portal>
                                <DialogPrimitive.Overlay className="zoom-overlay" />
                                <DialogPrimitive.Content
                                    className="zoom-content"
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
                                            className="zoom-content__btn"
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
