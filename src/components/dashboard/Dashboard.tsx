import Link from 'next/link'
import {
    AlertTriangle,
    Bookmark,
    CalendarClock,
    Check,
    Clock,
    Dices,
    ExternalLink,
    Flag,
    Flame,
    Gamepad2,
    Gem,
    Hourglass,
    Inbox,
    Infinity as InfinityIcon,
    Play,
    ShoppingCart,
    Star,
    ThumbsUp,
    Trophy,
    Wrench,
    X,
} from 'lucide-react'
import {
    judiStreak,
    judiWeek,
    listCounts,
    minutesInMonth,
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
import { countsByMonth, monthElapsed, monthName, progressFor, suggestTargets } from '@/lib/goals'
import { achievementPercent, gameDuration } from '@/lib/library'
import { formatHours } from '@/lib/format'
import { GOAL_LABELS, goalMinutes, goalRemainingMinutes, parseGoal } from '@/lib/game-goal'
import { metacriticScore, ratingTier, steamReviewScore } from '@/lib/scores'
import type { LibraryGame } from '@/lib/tracker'
import { isPerfect } from '@/lib/tracker-rules'
import { isJudiMaintenance, maintenanceReturn, maintenanceReturnLine, maintenanceUntilRaw, parseMaintenanceUntil } from '@/lib/judi-maintenance'
import { Button } from '@/components/ui/button'
import GameCover from '@/components/tracker/GameCover'
import SuggestionsPanel from '@/components/tracker/SuggestionsPanel'
import { MarkFlags, StatusChip } from '@/components/tracker/status'
import { PriceTag } from '@/components/wishlist/PriceInfo'
import KeyboardList from '@/components/KeyboardList'
import CountUp from '@/components/CountUp'
import Tile from '@/components/Tile'
import ActivityHeatmap from './ActivityHeatmap'
import SyncButton from './SyncButton'
import WhatToPlay from './WhatToPlay'
import ListShortcuts from './ListShortcuts'
import MonthlyGoals from './MonthlyGoals'
import OpenSearchButton from './OpenSearchButton'
import { shortDate, timeAgo } from './format'
import './dashboard.css'
import { achievementIconUrl } from '@/lib/steam-icon'

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

/** Posición en la entrada escalonada (`.hg-enter`, styles/lists.css). */
const enter = (i: number): CSSVars => ({ '--i': i })

/** Horas que cuentan al llegar: «312 h», «4,5 h»; menos de una hora, tal cual («45 min»). */
function Hours({ minutes }: { minutes: number }) {
    if (minutes < 60) return <>{formatHours(minutes)}</>
    const hours = minutes / 60
    return hours < 10 ? <CountUp value={Math.round(hours * 10) / 10} decimals={1} suffix="h" /> : <CountUp value={Math.round(hours)} suffix="h" />
}

/** Cabecera de sección: icono tintado con el color de la lista a la que pertenece, título, recuento y acciones. */
function SectionHead({ id, tone, icon, title, count, children }: { id: string; tone: string; icon: React.ReactNode; title: string; count?: string; children?: React.ReactNode }) {
    return (
        <header className="dash-sec__head">
            <span className={`dash-sec__icon hg-tint ${tone}`} aria-hidden>
                {icon}
            </span>
            <h2 id={id} className="dash-sec__title">
                {title}
            </h2>
            {count && <span className="dash-sec__count">{count}</span>}
            {children && <span className="dash-sec__end">{children}</span>}
        </header>
    )
}

/** Vacío: icono con el color de la lista, una frase y, si hay, una acción. */
function Empty({ tone, icon, title, text, action }: { tone: string; icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
    return (
        <div className="dash-empty">
            <span className={`dash-empty__icon hg-tint ${tone}`} aria-hidden>
                {icon}
            </span>
            <p>
                <b>{title}</b>
                {text}
            </p>
            {action && <div className="dash-empty__action">{action}</div>}
        </div>
    )
}

function Cover({ game, title }: { game: Pick<LibraryGame, 'appid' | 'name' | 'header_image'>; title?: string }) {
    return (
        <span className="hg-row__cover lib-cover" title={title}>
            <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" />
        </span>
    )
}

function Scores({ game }: { game: LibraryGame }) {
    const mc = game.metacritic_score !== null ? metacriticScore(game.metacritic_score) : null
    const rev = game.steamspy_userscore ? steamReviewScore(game.steamspy_userscore) : null
    return (
        <>
            {mc && (
                <span className={`hg-score hg-tint sc-${mc.tier}`} title={`Metacritic: ${mc.label}`}>
                    {game.metacritic_score}
                </span>
            )}
            {rev && (
                <span className={`hg-score hg-tint sc-${rev.tier}`} title={`Reseñas de Steam: ${rev.label}`}>
                    <ThumbsUp aria-hidden /> {Math.round(game.steamspy_userscore!)} %<span className="sr-only"> ({rev.label})</span>
                </span>
            )}
        </>
    )
}

function Bar({ pct, index, done }: { pct: number; index: number; done?: boolean }) {
    return (
        <span className={`hg-bar hg-bar--fill${done ? ' is-done' : ''}`} style={enter(index)} aria-hidden>
            <span style={{ width: `${pct}%` }} />
        </span>
    )
}

/** Fila de un juego en curso: franja de Jugando, horas, última partida, lo que falta, logro más raro y progreso. */
function PlayingRow({ game, rarest, index, now }: { game: LibraryGame; rarest: number | undefined; index: number; now: number }) {
    const tier = rarityTier(rarest)
    const left = goalRemainingMinutes(game)
    const target = goalMinutes(game)
    const goal = GOAL_LABELS[parseGoal(game.goal)]
    const duration = gameDuration(game)
    const name = game.name ?? `App ${game.appid}`
    const pct = achievementPercent(game)
    const perfect = isPerfect(game)
    return (
        <li className="hg-row lib-row dash-row--playing st-jugando" style={tier ? ({ '--rar': rarityColor(tier) } as CSSVars) : undefined}>
            <span className={`hg-row__cover lib-cover${tier ? ' has-rar' : ''}`}>
                <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="112px" />
            </span>
            <span className="hg-row__main">
                <span className="lib-row__name">
                    <Link href={`/juego/${game.appid}`} className="hg-row__link" data-row-link>
                        {name}
                    </Link>
                    <MarkFlags favorite={game.favorite} endless={game.endless} />
                </span>
                <span className="hg-row__meta lib-row__meta">
                    <span className="lib-meta" title="Horas jugadas">
                        <Clock aria-hidden /> {formatHours(game.playtime_forever)}
                    </span>
                    <span className="lib-meta" title={game.rtime_last_played ? `Última partida: ${shortDate(game.rtime_last_played)}` : undefined}>
                        <CalendarClock aria-hidden /> {game.rtime_last_played ? timeAgo(game.rtime_last_played, now) : 'sin jugar'}
                    </span>
                    {left !== null && target !== null && duration.source && (
                        <span className="lib-meta dash-left" title={`${goal}: ${formatHours(target)}`}>
                            <Hourglass aria-hidden /> {left > 0 ? `faltan ~${formatHours(left)}` : `${goal.toLowerCase()}: superado`}
                        </span>
                    )}
                    {tier && rarest !== undefined && (
                        <span className="dash-rar rar-ink" style={{ '--c': rarityColor(tier) } as CSSVars} title="El logro más raro que tienes">
                            <Gem aria-hidden /> {RARITY_TIER_LABELS[tier]} {formatPercent(rarest)}
                        </span>
                    )}
                </span>
            </span>
            {pct === null ? (
                <span className="hg-row__prog hg-row__prog--none">Sin logros</span>
            ) : (
                <span className="hg-row__prog">
                    <span className="hg-row__prog-label">
                        <Link href={`/juego/${game.appid}/logros`} className="hg-row__ach-link">
                            <b>{game.achievements_unlocked ?? 0}</b> / {game.achievements_total} logros
                        </Link>
                        <span className={perfect ? 'lib-perfect' : undefined}>{pct} %</span>
                    </span>
                    <Bar pct={pct} index={index} done={perfect} />
                </span>
            )}
            <Button asChild size="sm" variant="secondary" className="dash-play">
                <a href={steamRunUrl(game.appid)} aria-label={`Jugar a ${name}`}>
                    <Play aria-hidden /> <span className="dash-play__label">Jugar</span>
                </a>
            </Button>
        </li>
    )
}

function ActivityItem({ item, index, now }: { item: Activity; index: number; now: number }) {
    if (item.kind === 'completado') {
        return (
            <li className="hg-ach hg-ach--completed st-completado">
                <span className="hg-ach__icon" aria-hidden>
                    <Flag size={18} />
                </span>
                <span className="hg-ach__body">
                    <span className="hg-ach__name">
                        Completaste <Link href={`/juego/${item.appid}`}>{item.game ?? `App ${item.appid}`}</Link>
                    </span>
                    <span className="hg-ach__game">
                        <time dateTime={item.at} title={shortDate(item.at)}>
                            {timeAgo(item.at, now)}
                        </time>
                    </span>
                </span>
                {item.rating !== null && (
                    <span className="hg-ach__pct">
                        <span className={`hg-score hg-tint sc-${ratingTier(item.rating)}`}>
                            <Star aria-hidden /> {String(item.rating).replace('.', ',')}
                        </span>
                        <small>tu nota</small>
                    </span>
                )}
            </li>
        )
    }
    const a = item.achievement
    const tier = rarityTier(a.global_percent)
    const flash = tier === 'epica' || tier === 'leg'
    return (
        <li className={`hg-ach${flash ? ' hg-rar-flash' : ''}`} style={tier ? ({ '--c': rarityColor(tier), '--i': index } as CSSVars) : undefined}>
            <span className="hg-ach__icon" aria-hidden>
                {a.icon ? <img src={achievementIconUrl(a.icon) ?? undefined} alt="" loading="lazy" /> : <Trophy size={18} />}
            </span>
            <span className="hg-ach__body">
                <span className="hg-ach__name">{a.display_name ?? 'Logro'}</span>
                <span className="hg-ach__game">
                    <Link href={`/juego/${item.appid}/logros`}>{item.game ?? `App ${item.appid}`}</Link>
                    {' · '}
                    <time dateTime={item.at} title={shortDate(item.at)}>
                        {timeAgo(item.at, now)}
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

const JUDI_STATE: Record<JudiTodayState, { tone: string; icon: React.ReactNode; label: string; text: string }> = {
    sin_juego: { tone: 'st-bandeja', icon: <Clock aria-hidden />, label: 'Sin juego', text: 'Hoy todavía no hay juego.' },
    pendiente: { tone: 'dash-warn', icon: <Clock aria-hidden />, label: 'Hoy', text: 'El juego de hoy te está esperando.' },
    en_curso: { tone: 'dash-warn', icon: <Clock aria-hidden />, label: 'A medias', text: 'Lo tienes a medias: aún te quedan vidas.' },
    acertado: { tone: 'dash-ok', icon: <Check aria-hidden />, label: 'Acertado', text: '¡Acertado! Vuelve mañana.' },
    fallado: { tone: 'dash-ko', icon: <X aria-hidden />, label: 'Fallado', text: 'Hoy se te resistió. Mañana, más.' },
}

const WEEK_STATE: Record<ReturnType<typeof judiWeek>[number]['state'], string> = {
    ok: 'acertado',
    ko: 'fallado',
    hoy: 'sin terminar',
    sin_jugar: 'sin jugar',
    sin_juego: 'sin JUDI',
}

/** JUDI en mantenimiento (NEXT_PUBLIC_JUDI_MAINTENANCE): neutro con la llave, sin invitar a jugar. */
const JUDI_MAINTENANCE_STATE = { tone: 'st-bandeja', icon: <Wrench aria-hidden />, label: 'Pausa', text: 'JUDI está en mantenimiento. Tus partidas y tus puntos están guardados.' }

function JudiPanel({ data, index, now }: { data: DashboardData; index: number; now: number }) {
    const maintenance = isJudiMaintenance()
    const state = data.judi.state
    const s = maintenance ? JUDI_MAINTENANCE_STATE : JUDI_STATE[state]
    const streak = judiStreak(data.judi.days, data.judi.today)
    const week = judiWeek(data.judi.days, data.judi.today)
    const done = state === 'acertado' || state === 'fallado'
    const lives = !maintenance && state === 'en_curso' ? data.judi.failedToday : null
    const maintenanceLine = maintenance ? maintenanceReturnLine(maintenanceReturn(parseMaintenanceUntil(maintenanceUntilRaw()), now)) : null
    return (
        <section className="dash-panel dash-judi hg-enter" style={enter(index)} aria-labelledby="dash-judi">
            <SectionHead id="dash-judi" tone="" icon={<Gamepad2 />} title="JUDI de hoy">
                <span className={`dash-pill hg-tint ${s.tone}`}>
                    {s.icon}
                    {s.label}
                </span>
            </SectionHead>
            <p className="dash-judi__msg">
                {lives !== null ? `Lo tienes a medias: te quedan ${6 - lives} ${6 - lives === 1 ? 'vida' : 'vidas'}.` : s.text}
            </p>
            <div className="dash-judi__row">
                <span className="dash-judi__streak">
                    <span className="dash-judi__streak-n">
                        <Flame aria-hidden />
                        <strong>
                            <CountUp value={streak} />
                        </strong>
                    </span>
                    <small>{streak === 1 ? 'día de racha' : 'días de racha'}</small>
                </span>
                <ol className="dash-judi__week" aria-label="Tus últimos 7 días de JUDI">
                    {week.map((d, i) => (
                        <li key={d.fecha} className={`dash-judi__day is-${d.state}`} title={`${d.label === 'Hoy' ? 'Hoy' : d.fecha}: ${WEEK_STATE[d.state]}`}>
                            <i className="hg-pop-in" style={enter(i)} aria-hidden>
                                {d.state === 'ok' ? <Check /> : d.state === 'ko' ? <X /> : d.state === 'hoy' ? <Clock /> : null}
                            </i>
                            <span aria-hidden>{d.label}</span>
                            <span className="sr-only">
                                {d.label === 'Hoy' ? 'Hoy' : d.fecha}: {WEEK_STATE[d.state]}
                            </span>
                        </li>
                    ))}
                </ol>
            </div>
            <div className="dash-judi__foot">
                {lives !== null ? (
                    <span className="dash-judi__lives">
                        {Array.from({ length: 6 }, (_, i) => (
                            <i key={i} className={i < lives ? 'is-used' : undefined} aria-hidden />
                        ))}
                        {lives} de 6 intentos
                    </span>
                ) : (
                    <span className="dash-judi__lives">
                        {maintenanceLine ?? (done ? 'Nuevo juego a las 00:00 (hora de Madrid).' : 'Seis capturas, seis intentos.')}
                    </span>
                )}
                {!maintenance && data.judi.todayId !== null && (
                    <Button asChild size="sm" variant={done ? 'secondary' : 'default'}>
                        <Link href="/judi">
                            {!done && <Play aria-hidden />}
                            {done ? 'Ver JUDI' : state === 'en_curso' ? 'Seguir' : 'Jugar'}
                        </Link>
                    </Button>
                )}
            </div>
        </section>
    )
}

function ConnectCard() {
    return (
        <section className="dash-panel dash-connect hg-enter" style={enter(1)} aria-labelledby="dash-connect">
            <span className="dash-connect__icon hg-tint st-todos" aria-hidden>
                <Gamepad2 />
            </span>
            <div>
                <h2 id="dash-connect">Conecta tu cuenta de Steam</h2>
                <p>HubGames lee tus juegos, horas y logros de Steam y los ordena por listas. Solo lectura: no publica nada en tu nombre.</p>
                <ol className="dash-connect__steps">
                    <li>
                        <b>
                            <span className="hg-tile__icon hg-tint st-bandeja" aria-hidden>
                                <Inbox />
                            </span>
                            Llegan a la bandeja
                        </b>
                        Tus juegos entran sin clasificar.
                    </li>
                    <li>
                        <b>
                            <span className="hg-tile__icon hg-tint st-jugando" aria-hidden>
                                <Play />
                            </span>
                            Los clasificas
                        </b>
                        Jugando, Pendiente, Completado…
                    </li>
                    <li>
                        <b>
                            <span className="hg-tile__icon hg-tint rar-ink" style={{ '--c': 'var(--rar-epica)' } as CSSVars} aria-hidden>
                                <Trophy />
                            </span>
                            Sigues tus logros
                        </b>
                        Con su rareza y lo que te falta.
                    </li>
                </ol>
                <div className="dash-connect__actions">
                    <Button asChild>
                        <a href="/api/steam/link">
                            <Gamepad2 aria-hidden /> Conectar con Steam
                        </a>
                    </Button>
                    <OpenSearchButton />
                </div>
            </div>
        </section>
    )
}

/** Dashboard (#29): el "centro de control" para ver de un vistazo a qué jugar hoy. */
export default function Dashboard({ data, now, seed }: { data: DashboardData; now: number; seed: number }) {
    const playing = playingNow(data.games)
    const queue = nextInQueue([...data.games, ...data.unowned])
    const near = nearHundred(data.games)
    // Tantos logros como quepan junto a «En curso» (entre 3 y 5), para que las dos columnas queden parejas.
    const activity = recentActivity(data.recentUnlocks, data.games, Math.min(5, Math.max(3, playing.length + 1)))
    const year = yearSummary(data.games, data.unlocksThisYear, data.minutesThisYear)
    const goalCounts = countsByMonth(data.games, data.goals.unlockTimes)
    const monthProgress = progressFor(goalCounts, data.goals.month)
    const heatmap = buildHeatmap({ today: data.activity.today, playtime: data.activity.playtime, unlocks: data.activity.unlockTimes })
    const counts = listCounts(data.games, data.unowned)
    const month = monthName(data.goals.month)
    const [y, m, d] = data.activity.today.split('-').map(Number)
    const monthDay = { day: d, days: new Date(Date.UTC(y, m, 0)).getUTCDate() }
    const linked = data.steam.linked
    const hidden = linked && data.steam.visibility !== null && data.steam.visibility !== 'publico'

    const head = (
        <header className="dash-head hg-enter" style={enter(0)}>
            <div className="dash-head__row">
                <div>
                    <h1 className="page-title">{data.username ? `Hola, ${data.username}` : 'Hola'}</h1>
                    <p className="dash-status">
                        {!linked ? (
                            <span>Conecta tu cuenta de Steam para ver tu biblioteca y tus logros.</span>
                        ) : data.steam.lastSyncAt ? (
                            <span className="dash-status__ok" title={new Date(data.steam.lastSyncAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}>
                                <Check aria-hidden /> Sincronizado con Steam {timeAgo(data.steam.lastSyncAt, now)}
                            </span>
                        ) : (
                            <span>Aún no se ha sincronizado con Steam.</span>
                        )}
                        {hidden && (
                            <span className="dash-status__warn">
                                <AlertTriangle aria-hidden /> Tu perfil de Steam oculta los detalles de juego: no se pueden leer horas ni logros.{' '}
                                <Link href="/perfil">Cómo cambiarlo</Link>
                            </span>
                        )}
                    </p>
                </div>
                {linked && <SyncButton />}
            </div>
            {linked && <ListShortcuts counts={counts} limit={data.playingLimit} style={enter(1)} />}
        </header>
    )

    if (!linked) {
        return (
            <div className="dash">
                {head}
                <ConnectCard />
                <div className="dash-grid">
                    <JudiPanel data={data} index={2} now={now} />
                </div>
            </div>
        )
    }

    const rating = year.averageRating
    return (
        <div className="dash">
            {head}

            <SuggestionsPanel games={data.games.filter((g) => g.suggestion)} now={now} />

            <div className="hg-enter" style={enter(2)}>
                <ActivityHeatmap
                    map={heatmap}
                    header={
                        <dl className="hg-tiles dash-tiles">
                            <Tile icon={<Clock aria-hidden />} tone="st-jugando" label="Horas este año">
                                <dd className="hg-tile__value">
                                    <Hours minutes={year.minutes} />
                                </dd>
                                <dd className="hg-tile__note">
                                    <b>{formatHours(minutesInMonth(data.activity.playtime, data.goals.month))}</b> en {month}
                                </dd>
                            </Tile>
                            <Tile icon={<Trophy aria-hidden />} tone="st-sin_final" label="Logros este año">
                                <dd className="hg-tile__value">
                                    <CountUp value={year.unlocks} />
                                </dd>
                                <dd className="hg-tile__note">
                                    <b>{year.perfect}</b> {year.perfect === 1 ? 'juego' : 'juegos'} al 100 %
                                </dd>
                            </Tile>
                            <Tile icon={<Flag aria-hidden />} tone="st-completado" label="Completados">
                                <dd className="hg-tile__value">
                                    <CountUp value={year.completed} />
                                </dd>
                                <dd className="hg-tile__note">
                                    <b>{monthProgress.completar}</b> en {month}
                                </dd>
                            </Tile>
                            <Tile icon={<Star aria-hidden />} tone={rating !== null ? `sc-${ratingTier(rating)}` : 'st-pausado'} label="Tu nota media">
                                <dd className={`hg-tile__value${rating !== null ? ' hg-tile__value--tinted' : ''}`}>
                                    {rating !== null ? <CountUp value={rating} decimals={1} /> : '—'}
                                </dd>
                                <dd className="hg-tile__note">{rating !== null ? `De los completados este año` : 'Se pone al completar un juego'}</dd>
                            </Tile>
                        </dl>
                    }
                    footer={
                        <span className="heat__extra">
                            <Link href="/estadisticas" className="dash-link">
                                Ver estadísticas
                            </Link>
                        </span>
                    }
                />
            </div>

            <div className="dash-cols">
                <section className="dash-sec hg-enter" style={enter(3)} aria-labelledby="dash-playing">
                    <SectionHead id="dash-playing" tone="st-jugando" icon={<Play />} title="En curso" count={playing.length ? `${playing.length} de ${data.playingLimit} a la vez` : undefined}>
                        {playing.length > 1 && (
                            <span className="hg-keyhint">
                                <kbd>↑</kbd> <kbd>↓</kbd> o <kbd>j</kbd> <kbd>k</kbd> para moverte
                            </span>
                        )}
                        <Link href="/biblioteca?estado=jugando" className="dash-link">
                            Ver todos
                        </Link>
                    </SectionHead>
                    {playing.length === 0 ? (
                        <Empty
                            tone="st-jugando"
                            icon={<Play />}
                            title="Nada en curso"
                            text="Elige algo de tu cola o de «¿Qué juego hoy?»."
                            action={
                                <Button asChild size="sm" variant="secondary">
                                    <a href="#dash-wtp">
                                        <Dices aria-hidden /> Elegir a qué jugar
                                    </a>
                                </Button>
                            }
                        />
                    ) : (
                        <KeyboardList className="hg-rows" label="Juegos en curso">
                            {playing.map((g, i) => (
                                <PlayingRow key={g.appid} game={g} rarest={data.rarestPercent[g.appid]} index={i} now={now} />
                            ))}
                        </KeyboardList>
                    )}
                </section>

                <section className="dash-sec hg-enter" style={enter(4)} aria-labelledby="dash-activity">
                    <SectionHead id="dash-activity" tone="dash-leg" icon={<Trophy />} title="Logros recientes">
                        <Link href="/logros/historial" className="dash-link">
                            Historial
                        </Link>
                    </SectionHead>
                    {activity.length === 0 ? (
                        <Empty tone="st-bandeja" icon={<Trophy />} title="Sin logros todavía" text="Aparecerán aquí al sincronizar." />
                    ) : (
                        <ul className="hg-achs">
                            {activity.map((a, i) => (
                                <ActivityItem key={`${a.kind}-${a.appid}-${a.at}-${a.kind === 'logro' ? a.achievement.display_name : ''}`} item={a} index={i} now={now} />
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <div className="hg-enter" style={enter(5)}>
                <WhatToPlay games={data.games} unowned={data.unowned} now={now} initialSeed={seed} />
            </div>

            <div className="dash-grid">
                <div className="dash-col">
                    <section className="dash-sec hg-enter" style={enter(6)} aria-labelledby="dash-queue">
                        <SectionHead id="dash-queue" tone="st-pendiente" icon={<Bookmark />} title="Siguientes en la cola" count={queue.length ? `${counts.pendiente} pendientes` : undefined}>
                            <Link href="/biblioteca?estado=pendiente" className="dash-link">
                                Ordenar
                            </Link>
                        </SectionHead>
                        {queue.length === 0 ? (
                            <Empty
                                tone="st-pendiente"
                                icon={<Bookmark />}
                                title="Tu cola está vacía"
                                text="Clasifica juegos de la bandeja o busca uno para añadirlo."
                                action={
                                    counts.bandeja > 0 ? (
                                        <Button asChild size="sm" variant="secondary">
                                            <Link href="/biblioteca/bandeja">
                                                <Inbox aria-hidden /> Ir a la bandeja ({counts.bandeja})
                                            </Link>
                                        </Button>
                                    ) : (
                                        <OpenSearchButton size="sm" />
                                    )
                                }
                            />
                        ) : (
                            <ol className="hg-rows">
                                {queue.map((g, i) => {
                                    const main = gameDuration(g).main
                                    const name = g.name ?? `App ${g.appid}`
                                    return (
                                        <li key={g.appid} className={`hg-row lib-row dash-row--queue st-pendiente${g.owned ? '' : ' is-unowned'}`}>
                                            <span className="dash-pos hg-tint st-pendiente" aria-label={`Posición ${i + 1}`}>
                                                {i + 1}
                                            </span>
                                            <Cover game={g} />
                                            <span className="hg-row__main">
                                                <span className="lib-row__name">
                                                    <Link href={`/juego/${g.appid}`} className="hg-row__link">
                                                        {name}
                                                    </Link>
                                                    <MarkFlags favorite={g.favorite} endless={g.endless} />
                                                    {!g.owned && (
                                                        <span className="lib-own lib-own--no">
                                                            <ShoppingCart aria-hidden /> Sin comprar
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="hg-row__meta lib-row__meta">
                                                    {g.endless ? (
                                                        <span className="lib-meta dash-endless">
                                                            <InfinityIcon aria-hidden /> Sin final
                                                        </span>
                                                    ) : main !== null ? (
                                                        <span className="lib-meta" title="Duración de la historia">
                                                            <Hourglass aria-hidden /> Historia {formatHours(main)}
                                                        </span>
                                                    ) : (
                                                        <span className="lib-meta">Sin duración</span>
                                                    )}
                                                    <Scores game={g} />
                                                </span>
                                                {!g.owned && <PriceTag game={g} />}
                                            </span>
                                            {g.owned ? (
                                                <a className="hg-icon-btn" href={steamRunUrl(g.appid)} aria-label={`Jugar a ${name}`} title="Jugar">
                                                    <Play size={16} aria-hidden />
                                                </a>
                                            ) : (
                                                <a
                                                    className="hg-icon-btn"
                                                    href={`https://store.steampowered.com/app/${g.appid}/`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    aria-label={`${name} en la tienda de Steam`}
                                                    title="Ver en Steam"
                                                >
                                                    <ExternalLink size={16} aria-hidden />
                                                </a>
                                            )}
                                        </li>
                                    )
                                })}
                            </ol>
                        )}
                    </section>

                    <section className="dash-sec hg-enter" style={enter(7)} aria-labelledby="dash-near">
                        <SectionHead id="dash-near" tone="st-completado" icon={<Trophy />} title="Cerca del 100 %">
                            <Link href="/logros" className="dash-link">
                                Logros
                            </Link>
                        </SectionHead>
                        {near.length === 0 ? (
                            <Empty tone="st-completado" icon={<Trophy />} title="Nada cerca del 100 %" text="Aquí salen los juegos con más de la mitad de los logros." />
                        ) : (
                            <ul className="hg-rows">
                                {near.map((g, i) => {
                                    const left = (g.achievements_total ?? 0) - (g.achievements_unlocked ?? 0)
                                    const pct = achievementPercent(g) ?? 0
                                    return (
                                        <li key={g.appid} className={`hg-row lib-row dash-row--near st-${g.status}`}>
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
                                                <Bar pct={pct} index={i} />
                                            </span>
                                            <StatusChip status={g.status} />
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>
                </div>

                <div className="dash-col">
                    <JudiPanel data={data} index={6} now={now} />
                    <div className="hg-enter" style={enter(7)}>
                        <MonthlyGoals
                            userId={data.userId}
                            month={data.goals.month}
                            saved={data.goals.targets}
                            suggested={suggestTargets(goalCounts, data.goals.month)}
                            progress={monthProgress}
                            elapsed={monthElapsed(data.goals.month, new Date(now))}
                            today={monthDay}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
