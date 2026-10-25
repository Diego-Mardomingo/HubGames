'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Award, Flag, Gem, History, Hourglass, Sparkles, Target, Trophy } from 'lucide-react'
import { safeGetSession } from '@/lib/supabase/client'
import { loadLibrary, type LibraryGame } from '@/lib/tracker'
import {
    computeMilestones,
    forgottenGames,
    lastTouched,
    nearCompletion,
    perfectGames,
    pointsByGame,
    rarestUnlocked,
    remainingAchievements,
    type Achievement,
} from '@/lib/achievements'
import { loadEasyMissing, loadUnlockedAchievements } from '@/lib/achievements-db'
import { Button } from '@/components/ui/button'
import Loader from '@/components/Loader'
import { Reveal } from '@/components/motion'
import AchievementItem from '@/components/achievements/AchievementItem'
import GameLine from '@/components/achievements/GameLine'
import GameCover from '@/components/tracker/GameCover'
import '@/components/achievements/achievements.css'
import '@/components/tracker/tracker.css'

/** "Fácil" = lo tiene más de la mitad de los jugadores. */
const EASY_PERCENT = 50
const STEP = 8

interface Data {
    games: LibraryGame[]
    unlocked: Achievement[]
    easy: Achievement[]
}

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const AGO = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

function ago(ms: number | null): string {
    if (ms === null) return 'nunca'
    const days = Math.round((Date.now() - ms) / (24 * 3600_000))
    if (days < 60) return AGO.format(-days, 'day')
    if (days < 730) return AGO.format(-Math.round(days / 30), 'month')
    return AGO.format(-Math.round(days / 365), 'year')
}

/** Lista con "Ver más": enseña `STEP` elementos y va abriendo de `STEP` en `STEP`. */
function useMore(total: number) {
    const [shown, setShown] = useState(STEP)
    return {
        shown,
        more:
            total > shown ? (
                <Button variant="ghost" size="sm" className="hunt__more" onClick={() => setShown((n) => n + STEP * 2)}>
                    Ver más ({total - shown})
                </Button>
            ) : null,
    }
}

function Section({
    id,
    icon: Icon,
    title,
    hint,
    count,
    children,
}: {
    id: string
    icon: typeof Trophy
    title: string
    hint: string
    count: number
    children: React.ReactNode
}) {
    return (
        <section className="hunt glass" aria-labelledby={id}>
            <header className="hunt__head">
                <h2 id={id} className="hunt__title">
                    <Icon size={16} aria-hidden /> {title}
                    <span className="ach-tab__count">{count}</span>
                </h2>
                <p className="hunt__hint">{hint}</p>
            </header>
            {count === 0 ? <p className="hunt__empty">Nada por aquí todavía.</p> : children}
        </section>
    )
}

export default function LogrosPage() {
    const router = useRouter()
    const [data, setData] = useState<Data | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        safeGetSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login')
                return
            }
            // Pedimos de sobra: luego se quitan los juegos marcados como "No me interesa".
            Promise.all([loadLibrary(), loadUnlockedAchievements(), loadEasyMissing(EASY_PERCENT, 300)])
                .then(([games, unlocked, easy]) => setData({ games, unlocked, easy }))
                .catch((e: Error) => {
                    setError(e.message)
                    setData({ games: [], unlocked: [], easy: [] })
                })
        })
    }, [router])

    const views = useMemo(() => {
        if (!data) return null
        const byAppid = new Map(data.games.map((g) => [g.appid, g]))
        const games = data.games.filter((g) => g.status !== 'descartado')
        return {
            byAppid,
            near: nearCompletion(games),
            easy: data.easy.filter((a) => byAppid.get(a.appid)?.status !== 'descartado'),
            forgotten: forgottenGames(games),
            rarest: rarestUnlocked(data.unlocked, 10),
            perfect: perfectGames(data.games),
            points: pointsByGame(data.unlocked),
            milestones: computeMilestones(data.unlocked, data.games),
        }
    }, [data])

    const near = useMore(views?.near.length ?? 0)
    const easy = useMore(views?.easy.length ?? 0)
    const forgotten = useMore(views?.forgotten.length ?? 0)

    if (!data || !views) return <Loader label="Cargando logros" />

    const gameName = (appid: number) => views.byAppid.get(appid)?.name ?? `App ${appid}`
    const gameLink = (appid: number) => <Link href={`/juego/${appid}/logros`}>{gameName(appid)}</Link>
    const withAchievements = data.games.filter((g) => (g.achievements_unlocked ?? 0) > 0).length

    return (
        <div className="logros logros--wide">
            <header className="page-head">
                <div>
                    <Reveal>
                        <span className="eyebrow">
                            <Trophy size={13} aria-hidden /> Caza de logros
                        </span>
                    </Reveal>
                    <Reveal delay={0.05}>
                        <h1 className="page-title">Logros</h1>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <p className="page-subtitle">
                            {data.unlocked.length} logros desbloqueados en {withAchievements} juegos, {views.perfect.length} al 100 %.
                        </p>
                    </Reveal>
                </div>
                <Button variant="secondary" asChild>
                    <Link href="/logros/historial">
                        <History aria-hidden /> Línea temporal
                    </Link>
                </Button>
            </header>

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            <section className="score glass" aria-labelledby="hunt-score">
                <div className="score__main">
                    <h2 id="hunt-score" className="hunt__title">
                        <Sparkles size={16} aria-hidden /> Puntuación de cazador
                    </h2>
                    <p className="score__total">
                        {views.points.total.toLocaleString('es-ES')}
                        <small>puntos</small>
                    </p>
                    <p className="score__formula">
                        Cada logro vale más cuanto menos gente lo tiene: 3 puntos uno del 50 %, 10 uno del 10 %, 20 uno del 1 % y hasta 30.
                    </p>
                    {views.points.games.length > 0 && (
                        <ol className="score__top" aria-label="Juegos con más puntos">
                            {views.points.games.slice(0, 5).map((g) => (
                                <li key={g.appid}>
                                    <Link href={`/juego/${g.appid}/logros`}>{gameName(g.appid)}</Link>
                                    <span>{g.points.toLocaleString('es-ES')} pts</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
                <div className="milestones">
                    <h3 className="milestones__title">Hitos</h3>
                    <ul className="milestones__list">
                        {views.milestones.reached.map((m) => (
                            <li key={m.id} className="milestone">
                                <span className="milestone__icon">
                                    <Trophy size={12} aria-hidden />
                                </span>
                                <span className="milestone__label">{m.label}</span>
                                {m.date && <time dateTime={m.date}>{DATE.format(new Date(m.date))}</time>}
                            </li>
                        ))}
                        {views.milestones.next.map((m) => (
                            <li key={m.id} className="milestone is-pending">
                                <span className="milestone__icon">
                                    <Flag size={12} aria-hidden />
                                </span>
                                <span className="milestone__label">{m.label}</span>
                                <span className="milestone__progress">
                                    {m.target !== undefined ? `${(m.current ?? 0).toLocaleString('es-ES')}/${m.target.toLocaleString('es-ES')}` : 'Pendiente'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <div className="hunt-grid">
                <Section id="hunt-near" icon={Target} title="Cerca del 100 %" hint="Al menos la mitad de los logros. Los que menos te faltan, primero." count={views.near.length}>
                    <ul className="game-lines">
                        {views.near.slice(0, near.shown).map((g) => {
                            const left = remainingAchievements(g)
                            return <GameLine key={g.appid} game={g} detail={left === 1 ? 'Te falta 1 logro' : `Te faltan ${left} logros`} />
                        })}
                    </ul>
                    {near.more}
                </Section>

                <Section
                    id="hunt-easy"
                    icon={Sparkles}
                    title="Logros fáciles que te faltan"
                    hint="Los tiene más de la mitad de los jugadores y tú no."
                    count={views.easy.length}
                >
                    <ul className="ach-list">
                        {views.easy.slice(0, easy.shown).map((a) => (
                            <AchievementItem key={`${a.appid}:${a.apiname}`} achievement={a} gameName={gameName(a.appid)} context={gameLink(a.appid)} />
                        ))}
                    </ul>
                    {easy.more}
                </Section>

                <Section
                    id="hunt-forgotten"
                    icon={Hourglass}
                    title="Olvidados"
                    hint="Más de la mitad de los logros y sin tocarlos desde hace más de 90 días."
                    count={views.forgotten.length}
                >
                    <ul className="game-lines">
                        {views.forgotten.slice(0, forgotten.shown).map((g) => (
                            <GameLine key={g.appid} game={g} detail={`Última vez ${ago(lastTouched(g))}`} />
                        ))}
                    </ul>
                    {forgotten.more}
                </Section>

                <Section id="hunt-rare" icon={Gem} title="Tus logros más raros" hint="Los que menos jugadores tienen." count={views.rarest.length}>
                    <ul className="ach-list">
                        {views.rarest.map((a) => (
                            <AchievementItem key={`${a.appid}:${a.apiname}`} achievement={a} gameName={gameName(a.appid)} context={gameLink(a.appid)} />
                        ))}
                    </ul>
                </Section>
            </div>

            <Section id="hunt-perfect" icon={Award} title="Juegos al 100 %" hint="Todos los logros desbloqueados." count={views.perfect.length}>
                <ul className="perfect-grid">
                    {views.perfect.map((g) => (
                        <li key={g.appid}>
                            <Link href={`/juego/${g.appid}/logros`} className="perfect-card" title={g.name ?? undefined}>
                                <span className="perfect-card__cover">
                                    <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="192px" />
                                </span>
                                <span className="perfect-card__name">{g.name ?? `App ${g.appid}`}</span>
                                <span className="badge-100">
                                    <Trophy size={11} aria-hidden /> {g.achievements_total}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </Section>
        </div>
    )
}
