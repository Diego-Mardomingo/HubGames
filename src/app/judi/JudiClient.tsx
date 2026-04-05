'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase, safeGetUser } from '@/lib/supabase/client'
import Loader from '@/components/Loader'
import { getFailedAttempts, getPointsForRecord, type JudiProgressRecord } from '@/lib/judi-ranking'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import confetti from 'canvas-confetti'
import { ArrowLeft, ChevronDown, ChevronRight, Search, SkipForward } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'

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
const LIST_DOT_PX = 6

const dotNeutral = 'rgba(148, 163, 184, 0.38)'

const listDotStyle = (fill: string) =>
    ({
        width: LIST_DOT_PX,
        height: LIST_DOT_PX,
        minWidth: LIST_DOT_PX,
        minHeight: LIST_DOT_PX,
        borderRadius: '50%',
        flex: `0 0 ${LIST_DOT_PX}px`,
        display: 'block',
        boxSizing: 'border-box',
        background: fill,
    }) as const

function ListAttemptDots({ failed }: { failed: number }) {
    const f = Math.min(Math.max(0, failed), JUDI_ATTEMPT_SLOTS)
    return (
        <div className="judi-dots-row" role="presentation">
            {Array.from({ length: JUDI_ATTEMPT_SLOTS }, (_, i) => (
                <span
                    key={i}
                    className="judi-list-dot"
                    style={listDotStyle(i < f ? '#f43f5e' : dotNeutral)}
                />
            ))}
        </div>
    )
}

const HEADER_DOT_PX = 7

const headerDotStyle = (fill: string) => ({
    width: HEADER_DOT_PX,
    height: HEADER_DOT_PX,
    minWidth: HEADER_DOT_PX,
    minHeight: HEADER_DOT_PX,
    borderRadius: '50%',
    flex: `0 0 ${HEADER_DOT_PX}px`,
    display: 'block' as const,
    boxSizing: 'border-box' as const,
    background: fill,
    transition: 'background 0.2s',
})

function GameHeaderAttemptDots({
    gameState,
    lives,
}: {
    gameState: 'playing' | 'won' | 'lost'
    lives: number
}) {
    const failed = Math.min(JUDI_ATTEMPT_SLOTS, Math.max(0, JUDI_ATTEMPT_SLOTS - lives))

    if (gameState === 'won') {
        // Sin fallos (o partida ya completada con lives=6): misma celebración que antes.
        if (failed === 0) {
            return (
                <div className="judi-header-dots" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {Array.from({ length: JUDI_ATTEMPT_SLOTS }, (_, i) => (
                        <span key={i} className="judi-header-dot" style={headerDotStyle('var(--success)')} />
                    ))}
                </div>
            )
        }
        return (
            <div className="judi-header-dots" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {Array.from({ length: JUDI_ATTEMPT_SLOTS }, (_, i) => {
                    const fill =
                        i < failed ? '#f43f5e' : i === failed ? 'var(--success)' : dotNeutral
                    return <span key={i} className="judi-header-dot" style={headerDotStyle(fill)} />
                })}
            </div>
        )
    }
    if (gameState === 'lost') {
        return (
            <div className="judi-header-dots" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {Array.from({ length: JUDI_ATTEMPT_SLOTS }, (_, i) => (
                    <span key={i} className="judi-header-dot" style={headerDotStyle('#f43f5e')} />
                ))}
            </div>
        )
    }
    return (
        <div className="judi-header-dots" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {Array.from({ length: JUDI_ATTEMPT_SLOTS }, (_, i) => (
                <span key={i} className="judi-header-dot" style={headerDotStyle(i < failed ? '#f43f5e' : dotNeutral)} />
            ))}
        </div>
    )
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
    const [accordion, setAccordion] = useState<{ openYears: string[]; openMonths: string[] }>({
        openYears: [],
        openMonths: [],
    })

    const dailyCountdownMs = useNextDailyCountdown()

    const { singleYear, yearGroups } = useMemo(() => buildYearGroups(games), [games])

    useEffect(() => {
        void loadUserAndGames()
    }, [])

    // Auto-refresh al cambiar de día en Madrid (00:00): muestra el nuevo juego sin recargar la página
    useEffect(() => {
        const ms = getMsUntilNextMadridMidnight()
        const timer = setTimeout(() => {
            void loadUserAndGamesRef.current()
        }, ms + 500)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
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
            const colors = ['#00a8e8', '#22c55e', '#e0f2fe', '#fbbf24', '#f472b6', '#a78bfa']
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

    if (loading && !selectedGame) {
        return <Loader />
    }

    const playingDailyGame = Boolean(selectedGame && isJudiGameForCurrentDailyDate(selectedGame.juego))

    const hintText = selectedGame
        ? {
            2: `Géneros: ${selectedGame.generos.join(', ') || 'N/D'}`,
            3:
                selectedGame.steamCcu != null
                    ? `Pico de jugadores concurrentes (Steam): ${selectedGame.steamCcu.toLocaleString('es-ES')}`
                    : 'Pico de jugadores concurrentes (Steam): N/D',
            4:
                selectedGame.steamPositivePct != null
                    ? `Reseñas positivas (Steam): ${selectedGame.steamPositivePct} %`
                    : 'Reseñas positivas (Steam): N/D',
            5: `Año de lanzamiento: ${selectedGame.releaseYear ?? 'N/D'}`,
            6: `Estudio: ${selectedGame.developersLabel ?? 'N/D'}`,
        }[activeViewedPhase as 2 | 3 | 4 | 5 | 6]
        : ''

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
        router.push('/')
        void loadUserAndGames()
    }

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div className="page-header page-header--judi-title">
                <h1 className="page-header__title">JUDI &middot; Juego del día</h1>
                <p className="judi-daily-countdown" aria-live="polite">
                    Nuevo juego en <span className="judi-daily-countdown__time">{formatHmsCountdown(dailyCountdownMs)}</span>
                </p>
                <hr className="section-divider" />
            </div>

            {view === 'start' ? (
                <>
                    {!user && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            style={{ fontSize: '0.8125rem', color: 'var(--muted)', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12 }}
                        >
                            <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Inicia sesión</Link>{' '}
                            para guardar tu progreso y competir en el ranking.
                        </motion.div>
                    )}
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}
                    >
                        {yearGroups.map((yg, yearIndex) => {
                            const yearOpen = singleYear || accordion.openYears.includes(yg.year)
                            const yearGameCount = yg.months.reduce((acc, m) => acc + m.games.length, 0)
                            return (
                                <motion.div
                                    key={yg.year}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.22, ease: 'easeOut', delay: yearIndex * 0.05 }}
                                >
                                    {!singleYear && (
                                        <button
                                            type="button"
                                            onClick={() => toggleYear(yg.year)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'var(--surface-3)', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--foreground)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
                                        >
                                            <motion.span
                                                animate={{ rotate: yearOpen ? 0 : -90 }}
                                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)', flexShrink: 0 }}
                                            >
                                                <ChevronDown size={14} />
                                            </motion.span>
                                            <span style={{ flex: 1 }}>{yg.label}</span>
                                            <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '0.75rem' }}>{yearGameCount}</span>
                                        </button>
                                    )}
                                    <AnimatePresence initial={false}>
                                        {yearOpen &&
                                            (() => {
                                                const monthBlocks = yg.months.map((group, monthIndex) => {
                                                    const isOpen = accordion.openMonths.includes(group.key)
                                                    const animIndex = yearIndex * 8 + monthIndex
                                                    return (
                                                        <motion.div
                                                            key={group.key}
                                                            initial={{ opacity: 0, y: 6 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ duration: 0.2, ease: 'easeOut', delay: singleYear ? animIndex * 0.05 : 0 }}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleMonth(group.key)}
                                                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', paddingLeft: singleYear ? 14 : 22, background: 'var(--surface-2)', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--foreground)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                                                            >
                                                                <motion.span
                                                                    animate={{ rotate: isOpen ? 0 : -90 }}
                                                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                                    style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)', flexShrink: 0 }}
                                                                >
                                                                    <ChevronDown size={14} />
                                                                </motion.span>
                                                                <span style={{ textTransform: 'capitalize', flex: 1 }}>{group.label}</span>
                                                                <span
                                                                    style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        minWidth: 26,
                                                                        minHeight: 22,
                                                                        padding: '2px 7px',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 600,
                                                                        fontVariantNumeric: 'tabular-nums',
                                                                        color: 'var(--foreground)',
                                                                        background: 'var(--surface-3)',
                                                                        border: '1px solid var(--border)',
                                                                        borderRadius: 6,
                                                                    }}
                                                                >
                                                                    {group.games.length}
                                                                </span>
                                                            </button>
                                                            <AnimatePresence initial={false}>
                                                                {isOpen && (
                                                                    <motion.div
                                                                        key="content"
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        transition={{ height: { duration: 0.25, ease: 'easeInOut' }, opacity: { duration: 0.18 } }}
                                                                        style={{ overflow: 'hidden' }}
                                                                    >
                                                                        {group.games.map((game, gameIndex) => {
                                                                            const finished = Boolean(game.completado || game.fase6)
                                                                            const failedAttempts = getFailedAttempts(game as JudiProgressRecord)
                                                                            const isDailyToday = isJudiGameForCurrentDailyDate(game)
                                                                            return (
                                                                                <motion.div
                                                                                    key={game.id}
                                                                                    initial={{ opacity: 0, x: -6 }}
                                                                                    animate={{ opacity: 1, x: 0 }}
                                                                                    transition={{ duration: 0.18, ease: 'easeOut', delay: gameIndex * 0.03 }}
                                                                                    onClick={() => startJuego(game)}
                                                                                    role="button"
                                                                                    tabIndex={0}
                                                                                    onKeyDown={(e) => { if (e.key === 'Enter') startJuego(game) }}
                                                                                    className={isDailyToday ? 'judi-row judi-row--today' : 'judi-row'}
                                                                                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', paddingLeft: singleYear ? 14 : 22, borderBottom: gameIndex < group.games.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                                                                                >
                                                                                    <div style={{ width: 52, height: 30, borderRadius: 'var(--radius)', overflow: 'hidden', flexShrink: 0, background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                        {finished && game.header_image ? (
                                                                                            <img src={game.header_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                                                                        ) : (
                                                                                            <span style={{ color: 'var(--muted)', fontSize: '0.6875rem', fontWeight: 600 }}>?</span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div
                                                                                        className="judi-col-meta"
                                                                                        style={{
                                                                                            flexShrink: 0,
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            alignItems: 'flex-start',
                                                                                            justifyContent: 'center',
                                                                                            gap: 3,
                                                                                        }}
                                                                                    >
                                                                                        <span style={{ color: 'var(--muted)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                                                                                            #{game.id} &middot; {formatShortDate(game.fecha)}
                                                                                        </span>
                                                                                        {finished && (
                                                                                            <span
                                                                                                className="judi-result-label"
                                                                                                style={{
                                                                                                    fontSize: '0.6875rem',
                                                                                                    fontWeight: 700,
                                                                                                    letterSpacing: '0.02em',
                                                                                                    color: game.completado ? 'var(--success)' : '#f43f5e',
                                                                                                    lineHeight: 1.2,
                                                                                                }}
                                                                                            >
                                                                                                {game.completado ? 'Acertado!' : 'Fallado!'}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div
                                                                                        className="judi-col-main"
                                                                                        style={{
                                                                                            flex: 1,
                                                                                            minWidth: 0,
                                                                                            display: 'flex',
                                                                                            flexDirection: 'row',
                                                                                            alignItems: 'center',
                                                                                            justifyContent: 'flex-start',
                                                                                        }}
                                                                                    >
                                                                                        {finished ? (
                                                                                            <span
                                                                                                className="judi-main-line"
                                                                                                style={{
                                                                                                    fontSize: '0.8125rem',
                                                                                                    fontWeight: 600,
                                                                                                    color: 'var(--foreground)',
                                                                                                    overflow: 'hidden',
                                                                                                    textOverflow: 'ellipsis',
                                                                                                    whiteSpace: 'nowrap',
                                                                                                    lineHeight: 1.35,
                                                                                                    width: '100%',
                                                                                                }}
                                                                                            >
                                                                                                {game.nombre}
                                                                                            </span>
                                                                                        ) : failedAttempts === 0 ? (
                                                                                            <span
                                                                                                className="judi-main-line"
                                                                                                style={{
                                                                                                    fontSize: '0.8125rem',
                                                                                                    fontWeight: 500,
                                                                                                    color: 'var(--muted)',
                                                                                                    lineHeight: 1.35,
                                                                                                }}
                                                                                            >
                                                                                                Sin intentar
                                                                                            </span>
                                                                                        ) : (
                                                                                            <ListAttemptDots failed={failedAttempts} />
                                                                                        )}
                                                                                    </div>
                                                                                    {!finished ? (
                                                                                        <div className="judi-col-pts" style={{ width: 44, textAlign: 'right', flexShrink: 0 }}>
                                                                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>—</span>
                                                                                        </div>
                                                                                    ) : null}
                                                                                    <div
                                                                                        style={{
                                                                                            width: 44,
                                                                                            flexShrink: 0,
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            alignItems: 'center',
                                                                                            justifyContent: 'center',
                                                                                            gap: 4,
                                                                                        }}
                                                                                        aria-hidden
                                                                                    >
                                                                                        {finished ? (
                                                                                            <>
                                                                                                <span
                                                                                                    style={{
                                                                                                        width: 8,
                                                                                                        height: 8,
                                                                                                        borderRadius: '50%',
                                                                                                        background: game.completado ? 'var(--success)' : '#f43f5e',
                                                                                                        boxShadow: game.completado ? '0 0 0 1px rgba(34,197,94,0.25)' : '0 0 0 1px rgba(244,63,94,0.2)',
                                                                                                        flexShrink: 0,
                                                                                                    }}
                                                                                                />
                                                                                                <span
                                                                                                    className="judi-points-line"
                                                                                                    style={{
                                                                                                        fontSize: '0.6875rem',
                                                                                                        fontWeight: 700,
                                                                                                        fontVariantNumeric: 'tabular-nums',
                                                                                                        color: (game.puntos ?? 0) > 0 ? 'var(--success)' : '#f43f5e',
                                                                                                        lineHeight: 1.15,
                                                                                                        textAlign: 'center',
                                                                                                        whiteSpace: 'nowrap',
                                                                                                    }}
                                                                                                >
                                                                                                    {game.puntos ?? 0} pts
                                                                                                </span>
                                                                                            </>
                                                                                        ) : (
                                                                                            <ChevronRight size={18} color="var(--primary)" strokeWidth={2} />
                                                                                        )}
                                                                                    </div>
                                                                                </motion.div>
                                                                            )
                                                                        })}
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
                                                        transition={{ height: { duration: 0.25, ease: 'easeInOut' }, opacity: { duration: 0.18 } }}
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
                    </motion.div>
                </>
            ) : (
                selectedGame && (
                    <>
                    <motion.div
                        initial={{ opacity: 0, y: 28, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                        style={{
                            border: playingDailyGame
                                ? '1px solid rgba(34, 211, 238, 0.42)'
                                : '1px solid var(--border)',
                            boxShadow: playingDailyGame
                                ? '0 0 0 1px rgba(34, 211, 238, 0.12), 0 8px 32px rgba(34, 211, 238, 0.06)'
                                : undefined,
                            borderRadius: 'var(--radius-lg)',
                            overflow: 'visible',
                            position: 'relative',
                            zIndex: 1,
                        }}
                    >
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr auto 1fr',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 14px',
                                background: 'var(--surface-2)',
                                borderBottom: '1px solid var(--border)',
                                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                            }}
                        >
                            <div style={{ justifySelf: 'start' }}>
                                <button type="button" onClick={goBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.8125rem', cursor: 'pointer', padding: 0 }}>
                                    <ArrowLeft size={14} />
                                    Volver
                                </button>
                            </div>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 'min(52vw, 220px)' }}>
                                JUDI #{selectedGame.juego.id} &middot; {formatShortDate(selectedGame.juego.fecha)}
                            </span>
                            <div style={{ justifySelf: 'end', minHeight: 32, display: 'flex', alignItems: 'center' }}>
                                {gameState === 'playing' ? (
                                    <button
                                        type="button"
                                        onClick={() => void skipAttempt()}
                                        disabled={guessSubmitting}
                                        title="Saltar intento: pierdes una vida sin elegir título (no se guarda en tus fallos)"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                            padding: '6px 10px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            borderRadius: 'var(--radius)',
                                            border: '1px solid rgba(148, 163, 184, 0.32)',
                                            background: 'transparent',
                                            color: 'var(--foreground)',
                                            cursor: guessSubmitting ? 'not-allowed' : 'pointer',
                                            opacity: guessSubmitting ? 0.6 : 1,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <SkipForward size={14} strokeWidth={2.25} aria-hidden />
                                        Saltar
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                            {[1, 2, 3, 4, 5, 6].map((phase) => {
                                const isActive = phase === activeViewedPhase
                                const isLocked = phase > highestUnlockedPhase && gameState === 'playing'
                                return (
                                    <button
                                        key={phase}
                                        disabled={isLocked}
                                        onClick={() => setActiveViewedPhase(phase)}
                                        style={{
                                            flex: 1, padding: '8px 0', border: 'none',
                                            background: isActive ? 'var(--primary-glow)' : 'transparent',
                                            color: isActive ? 'var(--primary)' : isLocked ? 'var(--surface-3)' : 'var(--muted)',
                                            fontWeight: isActive ? 600 : 500, fontSize: '0.75rem',
                                            cursor: isLocked ? 'not-allowed' : 'pointer',
                                            borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                                            transition: 'color 0.15s, background 0.15s',
                                        }}
                                    >
                                        {phase}
                                    </button>
                                )
                            })}
                        </div>

                        <div
                            role="region"
                            aria-label="Captura del juego. Desliza horizontalmente para cambiar de fase."
                            onTouchStart={onCaptureTouchStart}
                            onTouchEnd={onCaptureTouchEnd}
                            style={{
                                position: 'relative',
                                aspectRatio: '16/9',
                                background: 'var(--surface-3)',
                                overflow: 'hidden',
                                touchAction: 'manipulation',
                            }}
                        >
                            {selectedGame.capturas.length > 0 && (
                                <>
                                    <img
                                        src={getCaptureUrlForPhase(activeViewedPhase, selectedGame.capturas) || selectedGame.capturas[0]}
                                        alt=""
                                        draggable={false}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            display: 'block',
                                            pointerEvents: 'none',
                                            userSelect: 'none',
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={onCaptureImageClick}
                                        aria-label="Ampliar captura"
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            zIndex: 1,
                                            margin: 0,
                                            padding: 0,
                                            border: 'none',
                                            background: 'transparent',
                                            cursor: 'zoom-in',
                                        }}
                                    />
                                </>
                            )}
                            {activeViewedPhase > 1 && hintText && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        zIndex: 2,
                                        padding: '28px 14px 10px',
                                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                                        fontSize: '0.8125rem',
                                        color: '#fff',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {hintText}
                                </div>
                            )}
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '10px 14px',
                                borderBottom: '1px solid var(--border)',
                            }}
                        >
                            <GameHeaderAttemptDots gameState={gameState} lives={lives} />
                        </div>

                        <div style={{ padding: 14 }}>
                            {gameState === 'playing' ? (
                                <div style={{ display: 'grid', gap: 10 }}>
                                    <div style={{ position: 'relative', zIndex: 40 }}>
                                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', zIndex: 1 }} />
                                        <input
                                            type="text"
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
                                            placeholder={guessSubmitting ? 'Validando...' : 'Buscar juego...'}
                                            disabled={guessSubmitting}
                                            autoComplete="off"
                                            style={{ width: '100%', height: 44, paddingLeft: 32, paddingRight: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--foreground)', fontSize: '1rem', outline: 'none' }}
                                        />
                                        {showDropdown && searchResults.length > 0 && (
                                            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 220, overflowY: 'auto', zIndex: 50, boxShadow: '0 -8px 24px rgba(0,0,0,0.35)' }} className="soft-scrollbar">
                                                {searchResults.map((option) => {
                                                    const alreadyGuessed = wrongGuesses.some((g) => normalizeGameName(g) === normalizeGameName(option.name))
                                                    return (
                                                        <button
                                                            key={option.id}
                                                            disabled={alreadyGuessed}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => { if (!alreadyGuessed) { void submitGuess(option.name); setShowDropdown(false) } }}
                                                            className="judi-row"
                                                            style={{
                                                                display: 'block',
                                                                width: '100%',
                                                                padding: '8px 12px',
                                                                border: 'none',
                                                                background: alreadyGuessed ? 'rgba(244, 63, 94, 0.16)' : 'transparent',
                                                                color: alreadyGuessed ? 'var(--muted)' : 'var(--foreground)',
                                                                fontSize: '0.8125rem',
                                                                textAlign: 'left',
                                                                cursor: alreadyGuessed ? 'not-allowed' : 'pointer',
                                                                opacity: alreadyGuessed ? 0.85 : 1,
                                                                textDecoration: alreadyGuessed ? 'line-through' : 'none',
                                                                borderBottom: '1px solid var(--border)',
                                                            }}
                                                        >
                                                            {option.name}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        {showDropdown && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
                                            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--muted)', fontSize: '0.8125rem', zIndex: 50, boxShadow: '0 -8px 24px rgba(0,0,0,0.35)' }}>
                                                Sin resultados
                                            </div>
                                        )}
                                    </div>
                                    {wrongGuesses.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {wrongGuesses.map((guess, index) => (
                                                <span key={`${guess}-${index}`} style={{ padding: '3px 8px', borderRadius: 'var(--radius)', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.12)', color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 500 }}>
                                                    {guess}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '14px 8px 18px' }}>
                                    <div
                                        style={{
                                            fontSize: '1.5rem',
                                            fontWeight: 800,
                                            letterSpacing: '-0.02em',
                                            marginBottom: 14,
                                            color: gameState === 'won' ? 'var(--success)' : 'var(--danger)',
                                        }}
                                    >
                                        {gameState === 'won' ? 'Acertado!' : 'Fallado!'}
                                    </div>
                                    <p style={{ color: 'var(--muted)', fontSize: '0.9375rem', margin: '0 0 10px', lineHeight: 1.45 }}>
                                        El juego era
                                    </p>
                                    <p
                                        style={{
                                            margin: '0 0 18px',
                                            fontSize: '1.25rem',
                                            fontWeight: 700,
                                            lineHeight: 1.3,
                                            color: 'var(--foreground)',
                                        }}
                                    >
                                        {selectedGame.juego.nombre}
                                    </p>
                                    <button type="button" onClick={goBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500, padding: 0 }}>
                                        <ArrowLeft size={14} />
                                        Volver al listado
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    <Dialog open={captureZoomOpen} onOpenChange={setCaptureZoomOpen}>
                        <DialogPrimitive.Portal>
                            <DialogPrimitive.Overlay style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.88)' }} />
                            <DialogPrimitive.Content
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    zIndex: 101,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 16,
                                    margin: 0,
                                    outline: 'none',
                                    border: 'none',
                                    background: 'transparent',
                                    boxShadow: 'none',
                                }}
                                onTouchStart={onCaptureTouchStart}
                                onTouchEnd={onCaptureTouchEnd}
                                onClick={() => setCaptureZoomOpen(false)}
                            >
                                <DialogPrimitive.Title className="sr-only">
                                    Captura ampliada, fase {activeViewedPhase} de 6
                                </DialogPrimitive.Title>
                                {selectedGame.capturas.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setCaptureZoomOpen(false)
                                        }}
                                        style={{
                                            position: 'relative',
                                            zIndex: 2,
                                            maxHeight: 'min(90vh, 920px)',
                                            maxWidth: 'min(96vw, 1200px)',
                                            border: 'none',
                                            padding: 0,
                                            margin: 0,
                                            background: 'transparent',
                                            cursor: 'zoom-out',
                                            lineHeight: 0,
                                        }}
                                    >
                                        <img
                                            src={getCaptureUrlForPhase(activeViewedPhase, selectedGame.capturas) || selectedGame.capturas[0]}
                                            alt=""
                                            draggable={false}
                                            style={{
                                                display: 'block',
                                                maxHeight: 'min(90vh, 920px)',
                                                width: 'auto',
                                                maxWidth: 'min(96vw, 1200px)',
                                                objectFit: 'contain',
                                            }}
                                        />
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
