'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Award, Check, Flag, Hourglass, History, Target, Trophy, Zap } from 'lucide-react'
import type { LibraryGame } from '@/lib/tracker'
import {
    computeMilestones,
    countByGame,
    forgottenGames,
    lastTouched,
    nearCompletion,
    perfectGames,
    pointsByGame,
    rarestUnlocked,
    remainingAchievements,
    thisMonth,
    unlockedByRarity,
    formatPercent,
    type Achievement,
} from '@/lib/achievements'
import { RARITY_TIER_LABELS, rarityColor, rarityTier, type RarityTier } from '@/lib/rarity'
import { achievementPercent } from '@/lib/library'
import { Button } from '@/components/ui/button'
import KeyboardList from '@/components/KeyboardList'
import CountUp from '@/components/CountUp'
import Tile from '@/components/Tile'
import AchievementItem from '@/components/achievements/AchievementItem'
import GameLine from '@/components/achievements/GameLine'
import Milestones from '@/components/achievements/Milestones'
import GameCover from '@/components/tracker/GameCover'
import { StatusChip } from '@/components/tracker/status'
import EmptyState from '@/components/EmptyState'
import SteamEmpty from '@/components/SteamEmpty'
import SyncButton from '@/components/dashboard/SyncButton'
import '@/components/achievements/achievements.css'

const STEP = 8

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

export interface LogrosData {
    games: LibraryGame[]
    unlocked: Achievement[]
    easy: Achievement[]
    /** Para el vacío sin ningún logro: «Conectar con Steam» o «Sincronizar» (null si no se pudo leer). */
    steamLinked: boolean | null
}

const DATE = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const SHORT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const AGO = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })
const THRESHOLDS: Record<RarityTier, string> = { comun: '≥ 40 %', poco: '< 40 %', rara: '< 15 %', epica: '< 5 %', leg: '< 1 %' }

const n = (v: number) => v.toLocaleString('es-ES')
/** Posición en la entrada escalonada (`.hg-enter`, styles/lists.css). */
const enter = (i: number): CSSVars => ({ '--i': i })

function ago(ms: number | null): string {
    if (ms === null) return 'nunca'
    const days = Math.round((Date.now() - ms) / (24 * 3600_000))
    if (days < 60) return AGO.format(-days, 'day')
    if (days < 730) return AGO.format(-Math.round(days / 30), 'month')
    return AGO.format(-Math.round(days / 365), 'year')
}

/**
 * Lista con "Ver más": enseña `STEP` elementos y va abriendo de `STEP * 2` en `STEP * 2`. `index` da la posición en la
 * entrada escalonada: las filas nuevas entran desde 0 y las que ya se veían no se mueven.
 */
function useMore(total: number) {
    const [{ shown, from }, setState] = useState({ shown: STEP, from: 0 })
    return {
        shown,
        index: (i: number) => (i >= from ? i - from : i),
        more:
            total > shown ? (
                <Button variant="ghost" size="sm" className="hg-more" onClick={() => setState((s) => ({ shown: s.shown + STEP * 2, from: s.shown }))}>
                    Ver más ({total - shown})
                </Button>
            ) : null,
    }
}

/** Sección de cazador: icono tintado con su color, título, recuento, pista y, si está vacía, un vacío con acción. */
function Section({
    id,
    tone,
    icon,
    title,
    hint,
    count,
    index,
    empty,
    children,
}: {
    id: string
    tone: string
    icon: React.ReactNode
    title: string
    hint: string
    count: number
    index: number
    empty: { title: string; text?: React.ReactNode; action?: React.ReactNode }
    children: React.ReactNode
}) {
    return (
        <section className="lg-sec hg-enter" style={enter(index)} aria-labelledby={id}>
            <header className="lg-sec__head">
                <span className={`lg-sec__icon hg-tint ${tone}`} aria-hidden>
                    {icon}
                </span>
                <h2 id={id} className="lg-sec__title">
                    {title}
                </h2>
                <span className="lg-sec__count">{n(count)}</span>
            </header>
            <p className="lg-sec__hint">{hint}</p>
            {count === 0 ? (
                <EmptyState tone={tone} icon={icon} title={empty.title} action={empty.action}>
                    {empty.text}
                </EmptyState>
            ) : (
                children
            )}
        </section>
    )
}

/** Resumen de logros (#26, #27) con los datos ya cargados: tiles, puntuación de cazador, hitos y vistas de cazador. */
export default function LogrosView({ data, error }: { data: LogrosData; error: string }) {
    const views = useMemo(() => {
        const byAppid = new Map(data.games.map((g) => [g.appid, g]))
        const games = data.games.filter((g) => g.status !== 'descartado')
        const easy = data.easy.filter((a) => byAppid.get(a.appid)?.status !== 'descartado')
        const near = nearCompletion(games)
        const points = pointsByGame(data.unlocked)
        // Para el vacío de "Juegos al 100 %": el que tienes más cerca (aunque no llegue a la mitad).
        const closest =
            near[0] ??
            games
                .filter((g) => remainingAchievements(g) > 0 && (g.achievements_unlocked ?? 0) > 0)
                .sort((a, b) => (achievementPercent(b) ?? 0) - (achievementPercent(a) ?? 0))[0]
        return {
            byAppid,
            near,
            easy,
            easyByGame: countByGame(easy),
            forgotten: forgottenGames(games),
            rarest: rarestUnlocked(data.unlocked, 10),
            perfect: perfectGames(data.games),
            points,
            pointsOf: new Map(points.games.map((g) => [g.appid, g.points])),
            rarity: unlockedByRarity(data.unlocked),
            month: thisMonth(data.unlocked),
            milestones: computeMilestones(data.unlocked, data.games),
            closest,
        }
    }, [data])

    const near = useMore(views.near.length)
    const easy = useMore(views.easy.length)
    const forgotten = useMore(views.forgotten.length)


    const game = (appid: number) => views.byAppid.get(appid)
    const gameName = (appid: number) => game(appid)?.name ?? `App ${appid}`
    const gameLink = (appid: number) => <Link href={`/juego/${appid}/logros`}>{gameName(appid)}</Link>
    const withAchievements = data.games.filter((g) => (g.achievements_unlocked ?? 0) > 0).length
    const rarest = views.rarest[0]
    const rarestTier = rarest ? rarityTier(rarest.global_percent) : null
    const lastPerfect = views.perfect[0]
    const tiers = views.rarity.filter((r) => r.count > 0)
    const top = views.points.games.slice(0, 5)
    const topMax = top[0]?.points ?? 1

    const head = (
        <header className="page-head hg-enter" style={enter(0)}>
            <div>
                <h1 className="page-title">Logros</h1>
                <p className="page-subtitle">
                    {n(data.unlocked.length)} logros desbloqueados en {withAchievements} juegos, {views.perfect.length} al 100 %.
                </p>
            </div>
            <Button variant="secondary" asChild>
                <Link href="/logros/historial">
                    <History aria-hidden /> Ver historial
                </Link>
            </Button>
        </header>
    )

    // Sin ningún logro: un solo vacío de página en vez de los tiles a cero y cinco secciones vacías.
    if (data.unlocked.length === 0 && !error)
        return (
            <div className="logros">
                {head}
                {data.steamLinked === false ? (
                    <SteamEmpty linked={false} what="tus logros" />
                ) : (
                    <EmptyState
                        size="page"
                        tone="st-sin_final"
                        icon={<Award />}
                        title="Aún no tienes logros"
                        className="hg-enter"
                        style={enter(1)}
                        action={<SyncButton label="Sincronizar con Steam" variant="secondary" />}
                    >
                        Salen al sincronizar los juegos de Steam que tienen logros: verás tus puntos, los más raros y lo que te falta.
                    </EmptyState>
                )}
            </div>
        )

    return (
        <div className="logros">
            {head}

            {error && (
                <p className="alert alert--error" role="alert">
                    {error}
                </p>
            )}

            <dl className="hg-tiles lg-tiles hg-enter" style={enter(1)}>
                <Tile icon={<Zap aria-hidden />} tone="st-todos" label="Puntos de cazador">
                    <dd className="hg-tile__value">
                        <CountUp value={views.points.total} />
                    </dd>
                    <dd className="hg-tile__note">
                        {views.month.points > 0 ? (
                            <>
                                <b>+{n(views.month.points)}</b> este mes
                            </>
                        ) : (
                            'nada nuevo este mes'
                        )}
                    </dd>
                </Tile>
                <Tile icon={<Award aria-hidden />} tone="st-sin_final" label="Logros">
                    <dd className="hg-tile__value">
                        <CountUp value={data.unlocked.length} />
                    </dd>
                    <dd className="hg-tile__note">
                        en {withAchievements} {withAchievements === 1 ? 'juego' : 'juegos'}
                        {views.month.achievements > 0 && (
                            <>
                                {' '}
                                · <b>+{n(views.month.achievements)}</b> este mes
                            </>
                        )}
                    </dd>
                </Tile>
                <Tile icon={<Flag aria-hidden />} tone="st-completado" label="Juegos al 100 %">
                    <dd className="hg-tile__value">
                        <CountUp value={views.perfect.length} />
                    </dd>
                    <dd className="hg-tile__note" title={lastPerfect?.name ?? undefined}>
                        {lastPerfect ? (
                            <>
                                el último,{' '}
                                <Link href={`/juego/${lastPerfect.appid}/logros`}>
                                    <b>{lastPerfect.name ?? `App ${lastPerfect.appid}`}</b>
                                </Link>
                                {lastPerfect.last_unlock_at && ` · ${SHORT.format(new Date(lastPerfect.last_unlock_at))}`}
                            </>
                        ) : (
                            'todavía ninguno'
                        )}
                    </dd>
                </Tile>
                <div className={`hg-tile lg-rare-tile ${rarestTier ? `rar-${rarestTier}` : ''}`} style={rarestTier ? ({ '--c': rarityColor(rarestTier) } as CSSVars) : undefined}>
                    <dt>
                        <span className="hg-tile__icon hg-tint">
                            <Trophy aria-hidden />
                        </span>
                        Tu logro más raro
                    </dt>
                    {rarest && rarestTier ? (
                        <>
                            <dd className="hg-tile__value hg-tile__value--tinted">
                                {formatPercent(rarest.global_percent)} <small>{RARITY_TIER_LABELS[rarestTier]}</small>
                            </dd>
                            <dd className="hg-tile__note" title={`${rarest.display_name ?? rarest.apiname} · ${gameName(rarest.appid)}`}>
                                <b>{rarest.display_name ?? rarest.apiname}</b> · {gameName(rarest.appid)}
                            </dd>
                        </>
                    ) : (
                        <>
                            <dd className="hg-tile__value">—</dd>
                            <dd className="hg-tile__note">todavía ninguno</dd>
                        </>
                    )}
                </div>
            </dl>

            <div className="lg-hunt hg-enter" style={enter(2)}>
                <div className="lg-hunt__col">
                    <section className="lg-panel" aria-labelledby="hunt-score">
                        <header className="lg-sec__head">
                            <span className="lg-sec__icon hg-tint st-todos" aria-hidden>
                                <Zap />
                            </span>
                            <h2 id="hunt-score" className="lg-sec__title">
                                Puntuación de cazador
                            </h2>
                            <span className="lg-sec__count">{n(views.points.total)} puntos</span>
                        </header>
                        <p className="lg-score__formula">
                            De dónde salen tus puntos. Cada logro vale más cuanto menos gente lo tiene: 3 puntos uno del 50 %, 10 uno del 10 %, 20 uno del
                            1 % y hasta 30.
                        </p>
                        {tiers.length > 0 ? (
                            <>
                                <div className="lg-stack" aria-hidden>
                                    {tiers.map((r) => (
                                        <span key={r.tier} style={{ flex: r.count, '--c': rarityColor(r.tier) } as CSSVars} title={`${RARITY_TIER_LABELS[r.tier]}: ${n(r.count)}`} />
                                    ))}
                                </div>
                                <ul className="lg-rar-table" aria-label="Tus logros y puntos por rareza">
                                    {tiers.map((r, k) => (
                                        <li key={r.tier} className="lg-rar-cell" style={{ '--c': rarityColor(r.tier), '--k': k } as CSSVars}>
                                            <span className="lg-rar-cell__name rar-ink">{RARITY_TIER_LABELS[r.tier]}</span>
                                            <span className="lg-rar-cell__n">
                                                <CountUp value={r.count} />
                                                <span className="sr-only"> logros</span>
                                            </span>
                                            <span className="lg-rar-cell__pts">{n(r.points)} pts</span>
                                            <span className="lg-rar-cell__thr">{THRESHOLDS[r.tier]} de jugadores</span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <p className="lg-panel__note">Cuando desbloquees logros, aquí verás cuántos tienes de cada rareza y cuántos puntos te dan.</p>
                        )}
                    </section>
                    <section className="lg-panel" aria-labelledby="hunt-top">
                        <header className="lg-sec__head">
                            <span className="lg-sec__icon hg-tint st-todos" aria-hidden>
                                <Trophy />
                            </span>
                            <h3 id="hunt-top" className="lg-sec__title lg-sec__title--sm">
                                Juegos con más puntos
                            </h3>
                        </header>
                        {top.length > 0 ? (
                            <ol className="lg-top">
                                {top.map((g, i) => (
                                    <li key={g.appid} className="lg-top__game hg-enter" style={enter(i + 2)}>
                                        <span className="lg-top__pos">{i + 1}</span>
                                        <span className="lg-top__cover">
                                            <GameCover appid={g.appid} name={game(g.appid)?.name ?? null} headerImage={game(g.appid)?.header_image ?? null} variant="header" sizes="64px" />
                                        </span>
                                        <span className="lg-top__name">
                                            <Link href={`/juego/${g.appid}/logros`} title={gameName(g.appid)}>
                                                {gameName(g.appid)}
                                            </Link>
                                            <span className="hg-bar hg-bar--fill" style={enter(i + 2)} aria-hidden>
                                                <span style={{ width: `${Math.max(2, Math.round((g.points / topMax) * 100))}%` }} />
                                            </span>
                                        </span>
                                        <span className="lg-top__pts">
                                            {n(g.points)} <small>pts</small>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="lg-panel__note">Aún no tienes puntos.</p>
                        )}
                    </section>
                </div>
                <section className="lg-panel" aria-labelledby="hunt-milestones">
                    <header className="lg-sec__head">
                        <span className="lg-sec__icon hg-tint st-completado" aria-hidden>
                            <Flag />
                        </span>
                        <h2 id="hunt-milestones" className="lg-sec__title">
                            Hitos
                        </h2>
                    </header>
                    <Milestones data={views.milestones} />
                </section>
            </div>

            <div className="hunt-grid">
                <Section
                    id="hunt-near"
                    tone="st-completado"
                    icon={<Flag />}
                    title="Cerca del 100 %"
                    hint="Al menos la mitad de los logros. Los que menos te faltan, primero."
                    count={views.near.length}
                    index={3}
                    empty={{ title: 'Ningún juego por encima de la mitad', text: 'Cuando pases del 50 % de logros de un juego, aparecerá aquí.' }}
                >
                    <KeyboardList className="hg-rows game-lines" label="Juegos cerca del 100 %">
                        {views.near.slice(0, near.shown).map((g, i) => {
                            const left = remainingAchievements(g)
                            const easyLeft = views.easyByGame.get(g.appid) ?? 0
                            return (
                                <GameLine
                                    key={g.appid}
                                    game={g}
                                    index={near.index(i)}
                                    detail={
                                        <>
                                            <span className="lg-left">{left === 1 ? 'Te falta 1' : `Te faltan ${left}`}</span>
                                            {easyLeft > 0 && (
                                                <span className="lg-easy-tag" title="Logros que tiene más de la mitad de los jugadores">
                                                    {easyLeft} {easyLeft === 1 ? 'fácil' : 'fáciles'}
                                                </span>
                                            )}
                                        </>
                                    }
                                />
                            )
                        })}
                    </KeyboardList>
                    {near.more}
                </Section>

                <Section
                    id="hunt-easy"
                    tone="st-todos"
                    icon={<Target />}
                    title="Logros fáciles que te faltan"
                    hint="Los tiene más de la mitad de los jugadores y tú no."
                    count={views.easy.length}
                    index={4}
                    empty={{ title: 'No te queda ninguno fácil', text: 'Todos los que tiene más de la mitad de los jugadores ya son tuyos.' }}
                >
                    <ul className="hg-achs ach-list">
                        {views.easy.slice(0, easy.shown).map((a, i) => {
                            const status = game(a.appid)?.status
                            return (
                                <AchievementItem
                                    key={`${a.appid}:${a.apiname}`}
                                    achievement={a}
                                    gameName={gameName(a.appid)}
                                    index={easy.index(i)}
                                    context={
                                        <>
                                            {gameLink(a.appid)}
                                            {status && <StatusChip status={status} />}
                                        </>
                                    }
                                />
                            )
                        })}
                    </ul>
                    {easy.more}
                </Section>

                <Section
                    id="hunt-forgotten"
                    tone="st-pausado"
                    icon={<Hourglass />}
                    title="Olvidados"
                    hint="Más de la mitad de los logros y sin tocarlos desde hace más de 90 días."
                    count={views.forgotten.length}
                    index={5}
                    empty={{ title: 'Nada olvidado', text: 'Ningún juego a medias lleva más de 90 días sin tocarse.' }}
                >
                    <KeyboardList className="hg-rows game-lines" label="Juegos olvidados">
                        {views.forgotten.slice(0, forgotten.shown).map((g, i) => (
                            <GameLine
                                key={g.appid}
                                game={g}
                                index={forgotten.index(i)}
                                detail={
                                    <span className="lib-meta lg-ago">
                                        <Hourglass aria-hidden />
                                        {ago(lastTouched(g))}
                                    </span>
                                }
                            />
                        ))}
                    </KeyboardList>
                    {forgotten.more}
                </Section>

                <Section
                    id="hunt-rare"
                    tone="rar-leg"
                    icon={<Trophy />}
                    title="Tus logros más raros"
                    hint="Los que menos jugadores tienen."
                    count={views.rarest.length}
                    index={6}
                    empty={{ title: 'Todavía ninguno', text: 'Cuando desbloquees logros, aquí saldrán los que menos jugadores tienen.' }}
                >
                    <ul className="hg-achs ach-list">
                        {views.rarest.map((a, i) => (
                            <AchievementItem key={`${a.appid}:${a.apiname}`} achievement={a} gameName={gameName(a.appid)} context={gameLink(a.appid)} index={i} />
                        ))}
                    </ul>
                </Section>
            </div>

            <Section
                id="hunt-perfect"
                tone="st-completado"
                icon={<Flag />}
                title="Juegos al 100 %"
                hint="Todos los logros desbloqueados. El más reciente, primero."
                count={views.perfect.length}
                index={7}
                empty={{
                    title: 'Todavía ningún juego al 100 %',
                    text: views.closest ? (
                        <>
                            {' '}
                            El que tienes más cerca es <b>{views.closest.name ?? `App ${views.closest.appid}`}</b>: te faltan{' '}
                            {remainingAchievements(views.closest)}.
                        </>
                    ) : undefined,
                    action: views.closest ? (
                        <Button variant="secondary" size="sm" asChild>
                            <Link href={`/juego/${views.closest.appid}/logros`}>
                                <Award aria-hidden /> Ver sus logros
                            </Link>
                        </Button>
                    ) : undefined,
                }}
            >
                <KeyboardList className="hg-cards" label="Juegos al 100 %">
                    {views.perfect.map((g, i) => {
                        const pts = views.pointsOf.get(g.appid)
                        return (
                            <li key={g.appid} className="hg-card hg-enter" style={enter(i)}>
                                <span className="hg-card__cover">
                                    <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="180px" />
                                    <span className="lg-perfect-badge hg-pop-in" style={enter(i)}>
                                        <Check aria-hidden />
                                        100 %
                                    </span>
                                </span>
                                <span className="hg-card__body">
                                    <Link href={`/juego/${g.appid}/logros`} className="hg-card__link" title={g.name ?? undefined} data-row-link>
                                        {g.name ?? `App ${g.appid}`}
                                    </Link>
                                    <span className="hg-card__meta lg-perfect-meta">
                                        <span>{g.achievements_total} logros</span>
                                        {pts !== undefined && <span className="lg-pts">{n(pts)} pts</span>}
                                        {g.last_unlock_at && <time dateTime={g.last_unlock_at}>{DATE.format(new Date(g.last_unlock_at))}</time>}
                                    </span>
                                </span>
                            </li>
                        )
                    })}
                </KeyboardList>
            </Section>
        </div>
    )
}
