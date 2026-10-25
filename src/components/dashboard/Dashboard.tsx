import Link from 'next/link'
import {
    Activity as ActivityIcon,
    CalendarDays,
    Clock,
    Flag,
    Flame,
    Gamepad2,
    Hourglass,
    LayoutDashboard,
    ListOrdered,
    Play,
    Star,
    Target,
    Trophy,
} from 'lucide-react'
import {
    judiStreak,
    nearHundred,
    nextInQueue,
    playingNow,
    recentActivity,
    remainingMinutes,
    steamRunUrl,
    yearSummary,
    type JudiTodayState,
} from '@/lib/dashboard'
import type { DashboardData } from '@/lib/dashboard-db'
import { countsByMonth, monthElapsed, progressFor, suggestTargets } from '@/lib/goals'
import { DURATION_SOURCE_LABEL, achievementPercent, gameDuration } from '@/lib/library'
import { formatHours } from '@/lib/format'
import type { LibraryGame } from '@/lib/tracker'
import { isPerfect } from '@/lib/tracker-rules'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/motion'
import GameCover from '@/components/tracker/GameCover'
import SuggestionsPanel from '@/components/tracker/SuggestionsPanel'
import GameLine from '@/components/achievements/GameLine'
import SyncButton from './SyncButton'
import WhatToPlay from './WhatToPlay'
import MonthlyGoals from './MonthlyGoals'
import { shortDate, timeAgo } from './format'
import './dashboard.css'

function Panel({ id, icon: Icon, title, action, children }: { id: string; icon: typeof Trophy; title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="dash-panel glass" aria-labelledby={id}>
            <header className="dash-panel__head">
                <h2 id={id} className="dash-panel__title">
                    <Icon size={16} aria-hidden /> {title}
                </h2>
                {action}
            </header>
            {children}
        </section>
    )
}

function PlayingCard({ game }: { game: LibraryGame }) {
    const pct = achievementPercent(game)
    const left = remainingMinutes(game)
    const duration = gameDuration(game)
    return (
        <li className="dash-playing">
            <Link href={`/juego/${game.appid}`} className="dash-playing__cover">
                <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="(max-width: 640px) 100vw, 360px" />
            </Link>
            <div className="dash-playing__body">
                <Link href={`/juego/${game.appid}`} className="dash-playing__name">
                    {game.name ?? `App ${game.appid}`}
                    {isPerfect(game) && (
                        <span className="badge-100" title="Todos los logros desbloqueados">
                            <Trophy size={11} aria-hidden /> 100%
                        </span>
                    )}
                </Link>
                <ul className="dash-facts">
                    <li>
                        <Clock size={13} aria-hidden /> {formatHours(game.playtime_forever)}
                    </li>
                    <li title={game.rtime_last_played ? new Date(game.rtime_last_played).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : undefined}>
                        <CalendarDays size={13} aria-hidden /> {timeAgo(game.rtime_last_played)}
                    </li>
                    {left !== null && duration.source && (
                        <li title={`Historia: ${formatHours(duration.main!)} según ${DURATION_SOURCE_LABEL[duration.source]}`}>
                            <Hourglass size={13} aria-hidden /> {left > 0 ? `Faltan ~${formatHours(left)}` : 'Historia superada'}
                        </li>
                    )}
                </ul>
                {pct !== null && (
                    <div className="dash-ach">
                        <span className="lib-progress" aria-hidden>
                            <span style={{ width: `${pct}%` }} />
                        </span>
                        <Link href={`/juego/${game.appid}/logros`}>
                            {game.achievements_unlocked ?? 0}/{game.achievements_total} logros · {pct} %
                        </Link>
                    </div>
                )}
            </div>
            <Button asChild size="sm" className="dash-playing__play">
                <a href={steamRunUrl(game.appid)}>
                    <Play aria-hidden /> Jugar
                </a>
            </Button>
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

    return (
        <div className="dash">
            <header className="page-head">
                <div>
                    <Reveal>
                        <span className="eyebrow">
                            <LayoutDashboard size={13} aria-hidden /> Centro de control
                        </span>
                    </Reveal>
                    <Reveal delay={0.05}>
                        <h1 className="page-title">{data.username ? `Hola, ${data.username}` : 'Hola'}</h1>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <p className="page-subtitle">
                            {playing.length > 0
                                ? `${playing.length} ${playing.length === 1 ? 'juego' : 'juegos'} en curso. ¿A cuál le das hoy?`
                                : 'No tienes nada en curso. Elige algo de tu cola.'}
                        </p>
                    </Reveal>
                </div>
                {data.steam.linked ? (
                    <div className="dash-head-sync">
                        <SyncButton />
                        <span className="dash-head-sync__last">Última sincronización: {timeAgo(data.steam.lastSyncAt)}</span>
                    </div>
                ) : (
                    <Button asChild>
                        <a href="/api/steam/link">
                            <Gamepad2 aria-hidden /> Conectar con Steam
                        </a>
                    </Button>
                )}
            </header>

            <SuggestionsPanel />

            <Panel
                id="dash-playing"
                icon={Gamepad2}
                title="Jugando ahora"
                action={
                    <Link href="/biblioteca?estado=jugando" className="dash-panel__link">
                        Ver todos
                    </Link>
                }
            >
                {playing.length === 0 ? (
                    <p className="dash-empty">
                        Nada en curso. Cuando juegues a algo, aparecerá aquí solo tras la sincronización.
                    </p>
                ) : (
                    <ul className="dash-playing-list">
                        {playing.map((g) => (
                            <PlayingCard key={g.appid} game={g} />
                        ))}
                    </ul>
                )}
            </Panel>

            <WhatToPlay games={data.games} now={now} initialSeed={seed} />

            <div className="dash-grid">
                <div className="dash-col">
                    <Panel
                        id="dash-queue"
                        icon={ListOrdered}
                        title="Siguientes en la cola"
                        action={
                            <Link href="/biblioteca?estado=pendiente" className="dash-panel__link">
                                Ordenar
                            </Link>
                        }
                    >
                        {queue.length === 0 ? (
                            <p className="dash-empty">No tienes pendientes. Clasifica juegos desde la bandeja.</p>
                        ) : (
                            <ol className="dash-queue">
                                {queue.map((g, i) => {
                                    const d = gameDuration(g)
                                    return (
                                        <li key={g.appid}>
                                            <span className="dash-queue__pos">{i + 1}</span>
                                            <Link href={`/juego/${g.appid}`} className="dash-queue__cover">
                                                <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="96px" />
                                            </Link>
                                            <Link href={`/juego/${g.appid}`} className="dash-queue__name">
                                                {g.name ?? `App ${g.appid}`}
                                                <small>{d.main !== null ? `Historia: ${formatHours(d.main)}` : 'Sin duración'}</small>
                                            </Link>
                                            <a className="dash-icon-btn" href={steamRunUrl(g.appid)} aria-label={`Jugar a ${g.name ?? g.appid}`} title="Jugar">
                                                <Play size={15} aria-hidden />
                                            </a>
                                        </li>
                                    )
                                })}
                            </ol>
                        )}
                    </Panel>

                    <Panel
                        id="dash-near"
                        icon={Target}
                        title="Cerca del 100 %"
                        action={
                            <Link href="/logros" className="dash-panel__link">
                                Logros
                            </Link>
                        }
                    >
                        {near.length === 0 ? (
                            <p className="dash-empty">Ningún juego por encima del 50 % de logros sin terminar.</p>
                        ) : (
                            <ul className="game-lines">
                                {near.map((g) => {
                                    const left = (g.achievements_total ?? 0) - (g.achievements_unlocked ?? 0)
                                    return <GameLine key={g.appid} game={g} detail={left === 1 ? 'Te falta 1 logro' : `Te faltan ${left} logros`} />
                                })}
                            </ul>
                        )}
                    </Panel>

                    <Panel
                        id="dash-activity"
                        icon={ActivityIcon}
                        title="Actividad reciente"
                        action={
                            <Link href="/logros/historial" className="dash-panel__link">
                                Historial
                            </Link>
                        }
                    >
                        {activity.length === 0 ? (
                            <p className="dash-empty">Todavía no hay actividad.</p>
                        ) : (
                            <ul className="dash-activity">
                                {activity.map((a) => (
                                    <li key={`${a.kind}-${a.appid}-${a.at}-${a.kind === 'logro' ? a.achievement.display_name : ''}`}>
                                        {a.kind === 'logro' ? (
                                            a.achievement.icon ? (
                                                <img className="dash-activity__icon" src={a.achievement.icon} alt="" loading="lazy" />
                                            ) : (
                                                <span className="dash-activity__icon" aria-hidden>
                                                    <Trophy size={14} />
                                                </span>
                                            )
                                        ) : (
                                            <span className="dash-activity__icon is-completed" aria-hidden>
                                                <Flag size={14} />
                                            </span>
                                        )}
                                        <span className="dash-activity__text">
                                            {a.kind === 'logro' ? (
                                                <>
                                                    <strong>{a.achievement.display_name ?? 'Logro'}</strong> en{' '}
                                                    <Link href={`/juego/${a.appid}/logros`}>{a.game ?? `App ${a.appid}`}</Link>
                                                    {a.achievement.global_percent !== null && (
                                                        <small> · {String(Math.round(a.achievement.global_percent * 10) / 10).replace('.', ',')} % de jugadores</small>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    Completaste <Link href={`/juego/${a.appid}`}>{a.game ?? `App ${a.appid}`}</Link>
                                                    {a.rating !== null && (
                                                        <small>
                                                            {' '}
                                                            · <Star size={11} aria-hidden /> {String(a.rating).replace('.', ',')}
                                                        </small>
                                                    )}
                                                </>
                                            )}
                                        </span>
                                        <time className="dash-activity__when" dateTime={a.at} title={shortDate(a.at)}>
                                            {timeAgo(a.at)}
                                        </time>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                <div className="dash-col">
                    <Panel id="dash-judi" icon={Flame} title="JUDI de hoy">
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

                    <Panel id="dash-year" icon={CalendarDays} title={`Tu ${year.year}`}>
                        <dl className="dash-year">
                            <div>
                                <dt>Completados</dt>
                                <dd>{year.completed}</dd>
                            </div>
                            <div>
                                <dt>Logros</dt>
                                <dd>{year.unlocks}</dd>
                            </div>
                            <div>
                                <dt>Al 100 %</dt>
                                <dd>{year.perfect}</dd>
                            </div>
                            <div>
                                <dt>Nota media</dt>
                                <dd>{year.averageRating !== null ? String(year.averageRating).replace('.', ',') : '—'}</dd>
                            </div>
                        </dl>
                        <p className="dash-year__note">
                            {year.minutes > 0
                                ? `${formatHours(year.minutes)} jugadas desde que se guarda tu historial de horas.`
                                : 'Las horas por día se cuentan desde octubre de 2026.'}
                        </p>
                    </Panel>
                </div>
            </div>
        </div>
    )
}
