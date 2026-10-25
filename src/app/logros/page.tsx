'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Flag, History, Trophy } from 'lucide-react'
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
import KeyboardList from '@/components/KeyboardList'
import AchievementItem from '@/components/achievements/AchievementItem'
import GameLine from '@/components/achievements/GameLine'
import GameCover from '@/components/tracker/GameCover'
import '@/components/achievements/achievements.css'

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
                <Button variant="ghost" size="sm" className="hg-more" onClick={() => setShown((n) => n + STEP * 2)}>
                    Ver más ({total - shown})
                </Button>
            ) : null,
    }
}

function Section({ id, title, hint, count, children }: { id: string; title: string; hint: string; count: number; children: React.ReactNode }) {
    return (
        <section className="hg-section" aria-labelledby={id}>
            <header className="hg-section__head">
                <h2 id={id} className="hg-section__title">
                    {title}
                    <span className="hg-section__count">{count}</span>
                </h2>
                <p className="hg-section__hint">{hint}</p>
            </header>
            {count === 0 ? <p className="hg-empty">Nada por aquí todavía.</p> : children}
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

    if (!data || !views) return <Loader label="Cargando logros" resetScroll />

    const gameName = (appid: number) => views.byAppid.get(appid)?.name ?? `App ${appid}`
    const gameLink = (appid: number) => <Link href={`/juego/${appid}/logros`}>{gameName(appid)}</Link>
    const withAchievements = data.games.filter((g) => (g.achievements_unlocked ?? 0) > 0).length

    return (
        <div className="logros">
            <header className="page-head">
                <div>
                    <h1 className="page-title">Logros</h1>
                    <p className="page-subtitle">
                        {data.unlocked.length.toLocaleString('es-ES')} logros desbloqueados en {withAchievements} juegos, {views.perfect.length} al 100 %.
                    </p>
                </div>
                <Button variant="secondary" asChild>
                    <Link href="/logros/historial">
                        <History aria-hidden /> Ver historial
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
                    <h2 id="hunt-score" className="score__title">
                        Puntuación de cazador
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
                                <span className="milestone__icon" aria-hidden>
                                    <Trophy size={12} />
                                </span>
                                <span className="milestone__label">{m.label}</span>
                                {m.date && <time dateTime={m.date}>{DATE.format(new Date(m.date))}</time>}
                            </li>
                        ))}
                        {views.milestones.next.map((m) => (
                            <li key={m.id} className="milestone is-pending">
                                <span className="milestone__icon" aria-hidden>
                                    <Flag size={12} />
                                </span>
                                <span className="milestone__label">{m.label}</span>
                                {m.target !== undefined ? (
                                    <span className="milestone__progress">
                                        <span>
                                            {(m.current ?? 0).toLocaleString('es-ES')} / {m.target.toLocaleString('es-ES')}
                                        </span>
                                        <span className="hg-bar" aria-hidden>
                                            <span style={{ width: `${Math.min(100, ((m.current ?? 0) / m.target) * 100)}%` }} />
                                        </span>
                                    </span>
                                ) : (
                                    <span className="milestone__progress">Pendiente</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <div className="hunt-grid">
                <Section id="hunt-near" title="Cerca del 100 %" hint="Al menos la mitad de los logros. Los que menos te faltan, primero." count={views.near.length}>
                    <KeyboardList className="hg-rows game-lines" label="Juegos cerca del 100 %">
                        {views.near.slice(0, near.shown).map((g) => {
                            const left = remainingAchievements(g)
                            return <GameLine key={g.appid} game={g} detail={left === 1 ? 'Te falta 1 logro' : `Te faltan ${left} logros`} />
                        })}
                    </KeyboardList>
                    {near.more}
                </Section>

                <Section id="hunt-easy" title="Logros fáciles que te faltan" hint="Los tiene más de la mitad de los jugadores y tú no." count={views.easy.length}>
                    <ul className="hg-achs ach-list">
                        {views.easy.slice(0, easy.shown).map((a) => (
                            <AchievementItem key={`${a.appid}:${a.apiname}`} achievement={a} gameName={gameName(a.appid)} context={gameLink(a.appid)} />
                        ))}
                    </ul>
                    {easy.more}
                </Section>

                <Section
                    id="hunt-forgotten"
                    title="Olvidados"
                    hint="Más de la mitad de los logros y sin tocarlos desde hace más de 90 días."
                    count={views.forgotten.length}
                >
                    <KeyboardList className="hg-rows game-lines" label="Juegos olvidados">
                        {views.forgotten.slice(0, forgotten.shown).map((g) => (
                            <GameLine key={g.appid} game={g} detail={`Última vez ${ago(lastTouched(g))}`} />
                        ))}
                    </KeyboardList>
                    {forgotten.more}
                </Section>

                <Section id="hunt-rare" title="Tus logros más raros" hint="Los que menos jugadores tienen." count={views.rarest.length}>
                    <ul className="hg-achs ach-list">
                        {views.rarest.map((a) => (
                            <AchievementItem key={`${a.appid}:${a.apiname}`} achievement={a} gameName={gameName(a.appid)} context={gameLink(a.appid)} />
                        ))}
                    </ul>
                </Section>
            </div>

            <Section id="hunt-perfect" title="Juegos al 100 %" hint="Todos los logros desbloqueados." count={views.perfect.length}>
                <KeyboardList className="hg-cards" label="Juegos al 100 %">
                    {views.perfect.map((g) => (
                        <li key={g.appid} className="hg-card">
                            <span className="hg-card__cover">
                                <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="180px" />
                            </span>
                            <span className="hg-card__body">
                                <Link href={`/juego/${g.appid}/logros`} className="hg-card__link" title={g.name ?? undefined} data-row-link>
                                    {g.name ?? `App ${g.appid}`}
                                </Link>
                                <span className="hg-card__meta">{g.achievements_total} logros</span>
                            </span>
                        </li>
                    ))}
                </KeyboardList>
            </Section>
        </div>
    )
}
