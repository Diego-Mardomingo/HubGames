'use client'

import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence, useAnimate } from 'framer-motion'
import { supabase, safeGetUser } from '@/lib/supabase/client'
import Loader from '@/components/Loader'
import { getFailedAttempts, getPointsForRecord, type JudiProgressRecord } from '@/lib/judi-ranking'
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

type GameRecord = {
    id: number
    id_videojuego: number
    nombre: string
    fecha: string
    calificacion: number
    desarrollador: string
    released: string
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
    capturas: string[]
    plataformas: string[]
    generos: string[]
    /** Pico jugadores concurrentes (Steam / SteamSpy) */
    steamCcu: number | null
    /** Porcentaje aproximado de reseñas positivas (userscore o positivas/total) */
    steamPositivePct: number | null
    releaseYear: string | null
    developersLabel: string | null
}

type JudiProgress = JudiProgressRecord & {
    id_lista_judi?: number
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

/** Clave estable para localStorage: evita colisiones cuando los ids de lista se reinician (TRUNCATE). */
function judiLocalStorageKey(game: { fecha: string; id_videojuego: number }) {
    return `${game.fecha}::${game.id_videojuego}`
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

function readLocalProgressForGame(
    game: { fecha: string; id_videojuego: number },
    raw: Record<string, JudiProgress>
): JudiProgress | undefined {
    return raw[judiLocalStorageKey(game)]
}

function readLocalGuessesForGame(
    game: { fecha: string; id_videojuego: number },
    raw: Record<string, string[]>
): string[] {
    return raw[judiLocalStorageKey(game)] ?? []
}

function normalizeGameName(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function parseSteamDevelopers(raw: unknown): string[] {
    if (!raw) return []
    if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    return []
}

/** Porcentaje de reseñas positivas: prioriza steamspy_userscore; si no, positivas / (positivas + negativas). */
function steamPositivePercent(
    userscore: number | null | undefined,
    positive: number | null | undefined,
    negative: number | null | undefined
): number | null {
    if (userscore != null && Number.isFinite(Number(userscore)) && Number(userscore) > 0) {
        return Math.round(Number(userscore))
    }
    const p = positive ?? 0
    const n = negative ?? 0
    if (p + n === 0) return null
    return Math.round((p / (p + n)) * 100)
}

function extractReleaseYear(
    steam: { release_date?: string | null; release_date_text?: string | null } | null | undefined,
    listaReleased: string
): string | null {
    const raw = steam?.release_date
    if (raw) {
        const d = new Date(raw)
        if (!Number.isNaN(d.getTime())) return String(d.getFullYear())
    }
    const text = `${steam?.release_date_text ?? ''} ${listaReleased}`.trim()
    const m = text.match(/\b(19|20)\d{2}\b/)
    return m ? m[0] : null
}

/** Índice de captura según fase: 1 → última captura (pista visual inicial); 2–6 → capturas 0…4 */
function getCaptureUrlForPhase(phase: number, capturas: string[]): string | undefined {
    if (capturas.length === 0) return undefined
    const idx =
        phase === 1
            ? Math.min(5, capturas.length - 1)
            : Math.min(Math.max(0, phase - 2), capturas.length - 1)
    return capturas[idx] ?? capturas[0]
}

const SWIPE_MIN_PX = 56
const SWIPE_BLOCK_CLICK_MS = 420

/** Evita que % y _ de Postgres interpreten comodines en ilike */
function sanitizeIlikeToken(token: string) {
    return token.replace(/\\/g, '').replace(/%/g, '').replace(/_/g, '').trim()
}

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
                    {finished ? game.nombre : status === 'progress' ? 'En curso' : 'Sin jugar'}
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
                        <span className="hero-card__name">{finished ? game.nombre : '¿Lo reconoces?'}</span>
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
            const tokens = searchQuery
                .toLowerCase()
                .split(/\s+/)
                .map(sanitizeIlikeToken)
                .filter((t) => t.length >= 1)
            if (tokens.length === 0) {
                setSearchResults([])
                setSearchLoading(false)
                return
            }
            let query = supabase
                .from('hubgames_judi_pool')
                .select('steam_appid, game_name')
                .eq('is_eligible', true)
                .eq('discarded', false)
            for (const token of tokens) {
                query = query.ilike('game_name', `%${token}%`)
            }
            const { data } = await query.order('relevance_score', { ascending: false }).limit(14)
            setSearchResults((data || []).map((item) => ({ id: item.steam_appid, name: item.game_name })))
            setSearchLoading(false)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const loadUserAndGames = async () => {
        loadUserAndGamesRef.current = loadUserAndGames
        setLoading(true)
        const { data: { user: authUser } } = await safeGetUser()
        setUser(authUser)
        const { data: judiGamesRaw } = await supabase
            .from('hubgames_lista_videojuegos_judi')
            .select('*')
            .order('id', { ascending: false })

        // Ocultar juegos con fecha futura en Madrid: se insertan a las 11:00 pero no se muestran hasta las 00:00
        const todayMadrid = getLegacyJudiDateMadridString(new Date())
        const todayDate = parseLegacyDate(todayMadrid)
        const judiGames = (judiGamesRaw ?? []).filter((game) => {
            const gameDate = parseLegacyDate(game.fecha)
            if (!gameDate || !todayDate) return true
            return gameDate <= todayDate
        })

        let userProgress: JudiProgress[] = []
        if (authUser) {
            const { data: progress } = await supabase
                .from('hubgames_judi_fases_usuario')
                .select('id_lista_judi, completado, fase1, fase2, fase3, fase4, fase5, fase6')
                .eq('id_usuario', authUser.id)
            userProgress = progress || []
        } else {
            const rawLocal = getLocalProgressRaw()
            judiGames.forEach((game) => {
                const rec = readLocalProgressForGame(game, rawLocal)
                if (rec) {
                    userProgress.push({ ...rec, id_lista_judi: game.id })
                }
            })
        }

        const progressByGameId = new Map<number, JudiProgress>()
        userProgress.forEach((record) => {
            if (record.id_lista_judi) {
                progressByGameId.set(record.id_lista_judi, record)
            }
        })

        const appIds = judiGames
            .map((game) => game.id_videojuego)
            .filter(Boolean)
        let imageByAppId = new Map<number, string>()

        if (appIds.length > 0) {
            const { data: imageRows } = await supabase
                .from('hubgames_juegos_steam')
                .select('steam_appid, header_image')
                .in('steam_appid', appIds)

            imageByAppId = new Map(
                (imageRows || []).map((row: any) => [row.steam_appid, row.header_image])
            )
        }

        setGames(judiGames.map((game) => {
            const progress = progressByGameId.get(game.id)
            const points = progress ? getPointsForRecord(progress) : null
            return {
                ...game,
                completado: Boolean(progress?.completado),
                fase1: Boolean(progress?.fase1),
                fase2: Boolean(progress?.fase2),
                fase3: Boolean(progress?.fase3),
                fase4: Boolean(progress?.fase4),
                fase5: Boolean(progress?.fase5),
                fase6: Boolean(progress?.fase6),
                puntos: points ?? undefined,
                header_image: imageByAppId.get(game.id_videojuego) || null,
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

        const [capturasRes, platformsRes, genresRes, steamRes] = await Promise.all([
            supabase.from('hubgames_capturas').select('captura').eq('id_videojuego', game.id_videojuego),
            supabase.from('hubgames_videojuego_plataforma').select('plataforma').eq('id_videojuego', game.id_videojuego),
            supabase.from('hubgames_videojuego_genero').select('genero').eq('id_videojuego', game.id_videojuego),
            supabase
                .from('hubgames_juegos_steam')
                .select(
                    'steamspy_ccu, steamspy_userscore, steamspy_positive, steamspy_negative, release_date, release_date_text, developers'
                )
                .eq('steam_appid', game.id_videojuego)
                .maybeSingle(),
        ])

        const steam = steamRes.data
        const steamCcuRaw = steam?.steamspy_ccu
        const steamCcu =
            steamCcuRaw != null && steamCcuRaw !== '' ? Number(steamCcuRaw) : null
        const steamPositivePct = steam
            ? steamPositivePercent(steam.steamspy_userscore, steam.steamspy_positive, steam.steamspy_negative)
            : null
        const releaseYear = extractReleaseYear(steam, game.released || '')
        const devs = parseSteamDevelopers(steam?.developers)
        const developersLabel = devs.length > 0 ? devs.join(', ') : null

        const gameData: GameData = {
            juego: game,
            capturas: (capturasRes.data || []).map((item) => item.captura),
            plataformas: (platformsRes.data || []).map((item) => item.plataforma),
            generos: (genresRes.data || []).map((item) => item.genero),
            steamCcu: steamCcu != null && Number.isFinite(steamCcu) ? steamCcu : null,
            steamPositivePct,
            releaseYear,
            developersLabel,
        }

        let progress: any = null
        let savedWrongGuesses: string[] = []
        const { data: { user: authUser } } = await safeGetUser()
        if (authUser) {
            const { data } = await supabase
                .from('hubgames_judi_fases_usuario')
                .select('*')
                .eq('id_lista_judi', game.id)
                .eq('id_usuario', authUser.id)
                .maybeSingle()
            progress = data
            const { data: intentos } = await supabase
                .from('hubgames_judi_intentos')
                .select('intento')
                .eq('id_lista_judi', game.id)
                .eq('id_usuario', authUser.id)
            savedWrongGuesses = (intentos || []).map((item) => item.intento)
        } else {
            const progressData = getLocalProgressRaw()
            progress = readLocalProgressForGame(game, progressData)
            const guessesData = getLocalGuessesRaw()
            savedWrongGuesses = readLocalGuessesForGame(game, guessesData)
        }

        setWrongGuesses(savedWrongGuesses)
        if (progress?.completado) {
            setGameState('won')
            setHighestUnlockedPhase(6)
            setActiveViewedPhase(6)
            // Misma lógica que en partida: vidas = intentos restantes; los fallos vienen de fase1..fase5 (el acierto no marca faseN).
            const failedOnWin = getFailedAttempts(progress as JudiProgressRecord)
            setLives(JUDI_ATTEMPT_SLOTS - failedOnWin)
        } else if (progress?.fase6) {
            setGameState('lost')
            setHighestUnlockedPhase(6)
            setActiveViewedPhase(6)
            setLives(0)
        } else {
            let phase = 1
            if (progress?.fase5) phase = 6
            else if (progress?.fase4) phase = 5
            else if (progress?.fase3) phase = 4
            else if (progress?.fase2) phase = 3
            else if (progress?.fase1) phase = 2
            setHighestUnlockedPhase(phase)
            setActiveViewedPhase(phase)
            setLives(7 - phase)
            setGameState('playing')
        }

        setSelectedGame(gameData)
        setView('game')
        setLoading(false)
    }

    const saveWrongGuess = async (gameRef: { id: number; fecha: string; id_videojuego: number }, guess: string) => {
        const { data: { user: authUser } } = await safeGetUser()
        if (authUser) {
            await supabase.from('hubgames_judi_intentos').insert({ id_lista_judi: gameRef.id, id_usuario: authUser.id, intento: guess }).select()
        } else {
            const guessesData = getLocalGuessesRaw()
            const key = judiLocalStorageKey(gameRef)
            if (!guessesData[key]) guessesData[key] = []
            if (!guessesData[key].includes(guess)) guessesData[key].push(guess)
            delete guessesData[String(gameRef.id)]
            localStorage.setItem('judi_intentos', JSON.stringify(guessesData))
        }
    }

    const clearWrongGuesses = async (gameRef: { id: number; fecha: string; id_videojuego: number }) => {
        const { data: { user: authUser } } = await safeGetUser()
        if (authUser) {
            await supabase.from('hubgames_judi_intentos').delete().eq('id_lista_judi', gameRef.id).eq('id_usuario', authUser.id)
        } else {
            const guessesData = getLocalGuessesRaw()
            const key = judiLocalStorageKey(gameRef)
            delete guessesData[key]
            delete guessesData[String(gameRef.id)]
            localStorage.setItem('judi_intentos', JSON.stringify(guessesData))
        }
    }

    const updateProgress = async (gameRef: { id: number; fecha: string; id_videojuego: number }, field: string, value: any) => {
        const { data: { user: authUser } } = await safeGetUser()
        if (authUser) {
            const { data: existing } = await supabase
                .from('hubgames_judi_fases_usuario')
                .select('id_lista_judi')
                .eq('id_lista_judi', gameRef.id)
                .eq('id_usuario', authUser.id)
                .maybeSingle()
            if (existing) {
                await supabase.from('hubgames_judi_fases_usuario').update({ [field]: value }).eq('id_lista_judi', gameRef.id).eq('id_usuario', authUser.id)
            } else {
                await supabase.from('hubgames_judi_fases_usuario').insert({ id_lista_judi: gameRef.id, id_usuario: authUser.id, [field]: value })
            }
        } else {
            const progressData = getLocalProgressRaw()
            const key = judiLocalStorageKey(gameRef)
            const prev = progressData[key] ?? { id_lista_judi: gameRef.id }
            progressData[key] = { ...prev, id_lista_judi: gameRef.id, [field]: value } as JudiProgress
            delete progressData[String(gameRef.id)]
            localStorage.setItem('judi_progress', JSON.stringify(progressData))
        }
    }

    /** Feedback de fallo: sacudida del buscador + destello en la captura. */
    const signalMiss = () => {
        setFlashKey((k) => k + 1)
        if (guessScope.current) {
            void animateGuess(guessScope.current, { x: [0, -12, 10, -7, 5, -2, 0] }, { duration: 0.5, ease: 'easeOut' })
        }
    }

    const submitGuess = async (rawGuess: string) => {
        if (!selectedGame || gameState !== 'playing' || guessSubmitting) return
        const guessText = rawGuess.trim()
        if (!guessText) return

        const alreadyGuessed = wrongGuesses.some((guess) => normalizeGameName(guess) === normalizeGameName(guessText))
        if (alreadyGuessed) return

        setGuessSubmitting(true)
        const isCorrect =
            Boolean(guessText) && normalizeGameName(guessText) === normalizeGameName(selectedGame.juego.nombre)

        try {
            if (isCorrect) {
                setGameState('won')
                await updateProgress(selectedGame.juego, 'completado', true)
                await clearWrongGuesses(selectedGame.juego)
                setSearchQuery('')
                setSearchResults([])
                setShowDropdown(false)
                return
            }

            const nextPhase = highestUnlockedPhase + 1
            signalMiss()
            await saveWrongGuess(selectedGame.juego, guessText)
            setWrongGuesses((prev) => [...prev, guessText])

            if (nextPhase > 6) {
                setHighestUnlockedPhase(6)
                setLives(0)
                setGameState('lost')
                await updateProgress(selectedGame.juego, 'fase6', true)
            } else {
                const currentPhaseToMark = highestUnlockedPhase
                setHighestUnlockedPhase(nextPhase)
                setActiveViewedPhase(nextPhase)
                setLives(7 - nextPhase)
                await updateProgress(selectedGame.juego, `fase${currentPhaseToMark}`, true)
            }
            setSearchQuery('')
            setSearchResults([])
            setShowDropdown(false)
        } finally {
            setGuessSubmitting(false)
        }
    }

    /** Consume un intento sin elegir título (misma lógica que fallar, sin guardar nombre en intentos). */
    const skipAttempt = async () => {
        if (!selectedGame || gameState !== 'playing' || guessSubmitting) return
        setGuessSubmitting(true)
        signalMiss()
        try {
            const nextPhase = highestUnlockedPhase + 1
            if (nextPhase > 6) {
                setHighestUnlockedPhase(6)
                setLives(0)
                setGameState('lost')
                await updateProgress(selectedGame.juego, 'fase6', true)
            } else {
                const currentPhaseToMark = highestUnlockedPhase
                setHighestUnlockedPhase(nextPhase)
                setActiveViewedPhase(nextPhase)
                setLives(7 - nextPhase)
                await updateProgress(selectedGame.juego, `fase${currentPhaseToMark}`, true)
            }
            setSearchQuery('')
            setSearchResults([])
            setShowDropdown(false)
        } finally {
            setGuessSubmitting(false)
        }
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

    const hints = selectedGame
        ? [
            { phase: 2, label: 'Géneros', value: selectedGame.generos.join(', ') || 'N/D', icon: Tags },
            {
                phase: 3,
                label: 'Pico de jugadores (Steam)',
                value: selectedGame.steamCcu != null ? selectedGame.steamCcu.toLocaleString('es-ES') : 'N/D',
                icon: Users,
            },
            {
                phase: 4,
                label: 'Reseñas positivas (Steam)',
                value: selectedGame.steamPositivePct != null ? `${selectedGame.steamPositivePct} %` : 'N/D',
                icon: ThumbsUp,
            },
            { phase: 5, label: 'Año de lanzamiento', value: selectedGame.releaseYear ?? 'N/D', icon: CalendarDays },
            { phase: 6, label: 'Estudio', value: selectedGame.developersLabel ?? 'N/D', icon: Building2 },
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
        router.push('/', { scroll: false })
        void loadUserAndGames()
    }

    const pipStates = gamePipStates(gameState, lives)
    const failedNow = Math.min(JUDI_ATTEMPT_SLOTS, Math.max(0, JUDI_ATTEMPT_SLOTS - lives))
    const earnedPoints = gameState === 'won' ? Math.max(JUDI_ATTEMPT_SLOTS - failedNow, 1) : 0
    const nextPendingGame = selectedGame
        ? games.find((g) => !g.completado && !g.fase6 && g.id !== selectedGame.juego.id) ?? null
        : null
    const currentCapture = selectedGame
        ? getCaptureUrlForPhase(activeViewedPhase, selectedGame.capturas) || selectedGame.capturas[0]
        : undefined

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
                                        {selectedGame.capturas.length === 0 && (
                                            <div className="stage__empty">
                                                <MysteryArt seed={selectedGame.juego.id} big />
                                            </div>
                                        )}
                                        {selectedGame.capturas.length > 0 && (
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
