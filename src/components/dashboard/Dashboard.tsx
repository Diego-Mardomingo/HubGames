import Link from 'next/link'
import { Flag, Gamepad2, Play, Star, Trophy } from 'lucide-react'
import {
    judiStreak,
    nearHundred,
    nextInQueue,
    playingNow,
    recentActivity,
    steamRunUrl,
    yearSummary,
    type Activity,
    type JudiTodayState,
} from '@/lib/dashboard'
import type { DashboardData } from '@/lib/dashboard-db'
import { buildHeatmap } from '@/lib/activity-heatmap'
import { RARITY_TIER_LABELS, rarityColor, rarityTier } from '@/lib/rarity'
import { formatPercent } from '@/lib/achievements'
import { countsByMonth, monthElapsed, progressFor, suggestTargets } from '@/lib/goals'
import { DURATION_SOURCE_LABEL, achievementPercent, gameDuration } from '@/lib/library'
import { formatHours } from '@/lib/format'
import { GOAL_LABELS, goalMinutes, goalRemainingMinutes, parseGoal } from '@/lib/game-goal'
import { STATUS_LABELS, type LibraryGame } from '@/lib/tracker'
import { isPerfect } from '@/lib/tracker-rules'
import { Button } from '@/components/ui/button'
import GameCover from '@/components/tracker/GameCover'
import SuggestionsPanel from '@/components/tracker/SuggestionsPanel'
import ActivityHeatmap from './ActivityHeatmap'
import KeyboardList from '@/components/KeyboardList'
import SyncButton from './SyncButton'
import WhatToPlay from './WhatToPlay'
import MonthlyGoals from './MonthlyGoals'
import { shortDate, timeAgo } from './format'
import './dashboard.css'

type CSSVars = React.CSSProperties & Record<`--${string}`, string>

function Panel({ id, title, action, children, className }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <section className={`dash-panel${className ? ` ${className}` : ''}`} aria-labelledby={id}>
            <header className="dash-panel__head">
                <h2 id={id} className="dash-panel__title">
                    {title}
                </h2>
                {action}
            </header>
            {children}
        </section>
    )
}

function Cover({ game, title }: { game: Pick<LibraryGame, 'appid' | 'name' | 'header_image'>; title?: string }) {
    return (
        <span className="hg-row__cover" title={title}>
            <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" />
        </span>
    )
}

function AchievementBar({ game }: { game: LibraryGame }) {
    const pct = achievementPercent(game)
    if (pct === null) return <span className="hg-row__prog hg-row__prog--none">Sin logros</span>
    return (
        <span className="hg-row__prog">
            <span className="hg-row__prog-label">
                <Link href={`/juego/${game.appid}/logros`} className="hg-row__ach-link">
                    <b>{game.achievements_unlocked ?? 0}</b> / {game.achievements_total} logros
                </Link>
                <span>{pct} %</span>
            </span>
            <span className="hg-bar" aria-hidden>
                <span style={{ width: `${pct}%` }} />
            </span>
        </span>
    )
}

/** Fila de un juego en curso: portada con la franja del logro más raro, horas, progreso de logros y estado. */
function PlayingRow({ game, rarest }: { game: LibraryGame; rarest: number | undefined }) {
    const tier = rarityTier(rarest)
    // Lo que falta según tu objetivo (#24): historia, historia + extras o, sin logros, el 100 % en horas.
    const left = goalRemainingMinutes(game)
    const target = goalMinutes(game)
    const goal = GOAL_LABELS[parseGoal(game.goal)]
    const duration = gameDuration(game)
    const name = game.name ?? `App ${game.appid}`
    const perfect = isPerfect(game)
    return (
        <li className={`hg-row hg-row--playing${tier ? ' has-rarity' : ''}`} style={tier ? ({ '--c': rarityColor(tier) } as CSSVars) : undefined}>
            <Cover game={game} title={tier && rarest !== undefined ? `Logro más raro: ${RARITY_TIER_LABELS[tier].toLowerCase()} (${formatPercent(rarest)})` : undefined} />
            <span className="hg-row__main">
                <Link href={`/juego/${game.appid}`} className="hg-row__link" data-row-link>
                    {name}
                </Link>
                <span className="hg-row__meta">
                    <span>{formatHours(game.playtime_forever)}</span>
                    {' · '}
                    <time
                        dateTime={game.rtime_last_played ?? undefined}
                        title={game.rtime_last_played ? new Date(game.rtime_last_played).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : undefined}
                    >
                        {game.rtime_last_played ? timeAgo(game.rtime_last_played) : 'sin jugar'}
                    </time>
                    {left !== null && target !== null && duration.source && (
                        <span title={`${goal}: ${formatHours(target)} según ${DURATION_SOURCE_LABEL[duration.source]}`}>
                            {' · '}
                            {left > 0 ? `faltan ~${formatHours(left)}` : `${goal.toLowerCase()}: superado`}
                        </span>
                    )}
                </span>
            </span>
            <AchievementBar game={game} />
            <span className={`hg-chip${perfect ? ' hg-chip--done' : ' hg-chip--playing'}`} title={perfect ? 'Todos los logros desbloqueados' : undefined}>
                {perfect ? '100 %' : STATUS_LABELS[game.status]}
            </span>
            <a className="hg-icon-btn" href={steamRunUrl(game.appid)} aria-label={`Jugar a ${name}`} title="Jugar">
                <Play size={16} aria-hidden />
            </a>
        </li>
    )
}

function ActivityItem({ item }: { item: Activity }) {
    if (item.kind === 'completado') {
        return (
            <li className="hg-ach hg-ach--completed">
                <span className="hg-ach__icon" aria-hidden>
                    <Flag size={18} />
                </span>
                <span className="hg-ach__body">
                    <span className="hg-ach__name">
                        Completaste <Link href={`/juego/${item.appid}`}>{item.game ?? `App ${item.appid}`}</Link>
                    </span>
                    <span className="hg-ach__game">
                        <time dateTime={item.at} title={shortDate(item.at)}>
                            {timeAgo(item.at)}
                        </time>
                    </span>
                </span>
                {item.rating !== null && (
                    <span className="hg-ach__pct">
                        <span className="hg-ach__rating">
                            <Star size={12} aria-hidden /> {String(item.rating).replace('.', ',')}
                        </span>
                        <small>tu nota</small>
                    </span>
                )}
            </li>
        )
    }
    const a = item.achievement
    const tier = rarityTier(a.global_percent)
    return (
        <li className="hg-ach" style={tier ? ({ '--c': rarityColor(tier) } as CSSVars) : undefined}>
            <span className="hg-ach__icon" aria-hidden>
                {a.icon ? <img src={a.icon} alt="" loading="lazy" /> : <Trophy size={18} />}
            </span>
            <span className="hg-ach__body">
                <span className="hg-ach__name">{a.display_name ?? 'Logro'}</span>
                <span className="hg-ach__game">
                    <Link href={`/juego/${item.appid}/logros`}>{item.game ?? `App ${item.appid}`}</Link>
                    {' · '}
                    <time dateTime={item.at} title={shortDate(item.at)}>
                        {timeAgo(item.at)}
                    </time>
                </span>
            </span>
            {a.global_percent !== null && (
                <span className="hg-ach__pct">
                    <span>
                        {formatPercent(a.global_percent)}
                        <span className="sr-only"> de jugadores</span>
                    </span>
                    {tier && <small>{RARITY_TIER_LABELS[tier]}</small>}
                </span>
            )}
        </li>
    )
}

const JUDI_STATE: Record<JudiTodayState, string> = {
    sin_juego: 'Hoy todavía no hay juego.',
    pendiente: 'El juego de hoy te está esperando.',
    en_curso: 'Lo tienes a medias: aún te quedan vidas.',
    acertado: '¡Acertado! Vuelve mañana.',
    fallado: 'Hoy se te resistió. Mañana, más.',
}

/** Dashboard (#29): el "centro de control" para ver de un vistazo a qué jugar hoy. */
export default function Dashboard({ data, now, seed }: { data: DashboardData; now: number; seed: number }) {
    const playing = playingNow(data.games)
    const queue = nextInQueue(data.games)
    const near = nearHundred(data.games)
    const activity = recentActivity(data.recentUnlocks, data.games)
    const year = yearSummary(data.games, data.unlocksThisYear, data.minutesThisYear)
    const streak = judiStreak(data.judi.days, data.judi.today)
    const judiDone = data.judi.state === 'acertado' || data.judi.state === 'fallado'
    const goalCounts = countsByMonth(data.games, data.goals.unlockTimes)
    const heatmap = buildHeatmap({ today: data.activity.today, playtime: data.activity.playtime, unlocks: data.activity.unlockTimes })

    const syncStatus = !data.steam.linked
        ? 'Conecta tu cuenta de Steam para ver tu biblioteca y tus logros.'
        : data.steam.lastSyncAt
          ? `Sincronizado con Steam ${timeAgo(data.steam.lastSyncAt, now)}`
          : 'Aún no se ha sincronizado con Steam.'
    const playingText =
        playing.length > 0 ? `${playing.length} ${playing.length === 1 ? 'juego' : 'juegos'} en curso` : 'Nada en curso: elige algo de tu cola'

    return (
        <div className="dash">
            <header className="dash-head">
                <div>
                    <h1 className="page-title">{data.username ? `Hola, ${data.username}` : 'Hola'}</h1>
                    <p className="page-subtitle">
                        <span title={data.steam.lastSyncAt ? new Date(data.steam.lastSyncAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : undefined}>
                            {syncStatus}
                        </span>
                        {data.steam.linked && <> · {playingText}</>}
                    </p>
                </div>
                {data.steam.linked ? (
                    <SyncButton />
                ) : (
                    <Button asChild>
                        <a href="/api/steam/link">
                            <Gamepad2 aria-hidden /> Conectar con Steam
                        </a>
                    </Button>
                )}
            </header>

            <SuggestionsPanel />

            <ActivityHeatmap
                map={heatmap}
                stats={[
                    { value: formatHours(year.minutes), label: 'jugadas este año' },
                    { value: String(year.unlocks), label: year.unlocks === 1 ? 'logro este año' : 'logros este año' },
                    { value: String(year.completed), label: year.completed === 1 ? 'completado' : 'completados' },
                    { value: String(playing.length), label: 'en curso' },
                ]}
                footer={
                    <>
                        <span className="heat__note">Horas diarias desde octubre de 2026; los días anteriores se colorean por logros.</span>
                        <span className="heat__extra">
                            {year.perfect} al 100 %
                            {year.averageRating !== null && <> · nota media {String(year.averageRating).replace('.', ',')}</>}
                            {' · '}
                            <Link href="/estadisticas" className="dash-link">
                                Ver estadísticas
                            </Link>
                        </span>
                    </>
                }
            />

            <div className="dash-cols">
                <Panel
                    id="dash-playing"
                    title="En curso"
                    className="dash-panel--list"
                    action={
                        <>
                            {playing.length > 1 && (
                                <span className="hg-keyhint">
                                    <kbd>↑</kbd> <kbd>↓</kbd> o <kbd>j</kbd> <kbd>k</kbd> para moverte · <kbd>Enter</kbd> abre la ficha
                                </span>
                            )}
                            <Link href="/biblioteca?estado=jugando" className="dash-link">
                                Ver todos
                            </Link>
                        </>
                    }
                >
                    {playing.length === 0 ? (
                        <p className="dash-empty">Nada en curso. Cuando juegues a algo, aparecerá aquí tras la sincronización.</p>
                    ) : (
                        <KeyboardList className="hg-rows" label="Juegos en curso">
                            {playing.map((g) => (
                                <PlayingRow key={g.appid} game={g} rarest={data.rarestPercent[g.appid]} />
                            ))}
                        </KeyboardList>
                    )}
                </Panel>

                <Panel
                    id="dash-activity"
                    title="Logros recientes"
                    className="dash-panel--list"
                    action={
                        <Link href="/logros/historial" className="dash-link">
                            Historial
                        </Link>
                    }
                >
                    {activity.length === 0 ? (
                        <p className="dash-empty">Todavía no hay actividad.</p>
                    ) : (
                        <ul className="hg-achs">
                            {activity.map((a) => (
                                <ActivityItem key={`${a.kind}-${a.appid}-${a.at}-${a.kind === 'logro' ? a.achievement.display_name : ''}`} item={a} />
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>

            <WhatToPlay games={data.games} now={now} initialSeed={seed} />

            <div className="dash-grid">
                <div className="dash-col">
                    <Panel
                        id="dash-queue"
                        title="Siguientes en la cola"
                        className="dash-panel--list"
                        action={
                            <Link href="/biblioteca?estado=pendiente" className="dash-link">
                                Ordenar
                            </Link>
                        }
                    >
                        {queue.length === 0 ? (
                            <p className="dash-empty">No tienes pendientes. Clasifica juegos desde la bandeja.</p>
                        ) : (
                            <ol className="hg-rows">
                                {queue.map((g) => {
                                    const d = gameDuration(g)
                                    const name = g.name ?? `App ${g.appid}`
                                    return (
                                        <li key={g.appid} className="hg-row hg-row--queue">
                                            <Cover game={g} />
                                            <span className="hg-row__main">
                                                <Link href={`/juego/${g.appid}`} className="hg-row__link">
                                                    {name}
                                                </Link>
                                                <span className="hg-row__meta">{d.main !== null ? `Historia: ${formatHours(d.main)}` : 'Sin duración'}</span>
                                            </span>
                                            <a className="hg-icon-btn" href={steamRunUrl(g.appid)} aria-label={`Jugar a ${name}`} title="Jugar">
                                                <Play size={16} aria-hidden />
                                            </a>
                                        </li>
                                    )
                                })}
                            </ol>
                        )}
                    </Panel>

                    <Panel
                        id="dash-near"
                        title="Cerca del 100 %"
                        className="dash-panel--list"
                        action={
                            <Link href="/logros" className="dash-link">
                                Logros
                            </Link>
                        }
                    >
                        {near.length === 0 ? (
                            <p className="dash-empty">Ningún juego por encima del 50 % de logros sin terminar.</p>
                        ) : (
                            <ul className="hg-rows">
                                {near.map((g) => {
                                    const left = (g.achievements_total ?? 0) - (g.achievements_unlocked ?? 0)
                                    const pct = achievementPercent(g) ?? 0
                                    return (
                                        <li key={g.appid} className="hg-row hg-row--near">
                                            <Cover game={g} />
                                            <span className="hg-row__main">
                                                <Link href={`/juego/${g.appid}/logros`} className="hg-row__link">
                                                    {g.name ?? `App ${g.appid}`}
                                                </Link>
                                                <span className="hg-row__meta">{left === 1 ? 'Te falta 1 logro' : `Te faltan ${left} logros`}</span>
                                            </span>
                                            <span className="hg-row__prog">
                                                <span className="hg-row__prog-label">
                                                    <span>
                                                        <b>{g.achievements_unlocked ?? 0}</b> / {g.achievements_total}
                                                    </span>
                                                    <span>{pct} %</span>
                                                </span>
                                                <span className="hg-bar" aria-hidden>
                                                    <span style={{ width: `${pct}%` }} />
                                                </span>
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </Panel>
                </div>

                <div className="dash-col">
                    <Panel id="dash-judi" title="JUDI de hoy">
                        <p className="dash-judi__state">{JUDI_STATE[data.judi.state]}</p>
                        <div className="dash-judi__row">
                            <span className="dash-stat">
                                <strong>{streak}</strong>
                                <small>{streak === 1 ? 'día de racha' : 'días de racha'}</small>
                            </span>
                            {data.judi.todayId !== null && (
                                <Button asChild size="sm" variant={judiDone ? 'secondary' : 'default'}>
                                    <Link href="/judi">{judiDone ? 'Ver JUDI' : data.judi.state === 'en_curso' ? 'Seguir' : 'Jugar'}</Link>
                                </Button>
                            )}
                        </div>
                    </Panel>

                    <MonthlyGoals
                        userId={data.userId}
                        month={data.goals.month}
                        saved={data.goals.targets}
                        suggested={suggestTargets(goalCounts, data.goals.month)}
                        progress={progressFor(goalCounts, data.goals.month)}
                        elapsed={monthElapsed(data.goals.month, new Date(now))}
                    />
                </div>
            </div>
        </div>
    )
}
