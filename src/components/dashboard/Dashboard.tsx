import { Suspense } from 'react'
import Link from 'next/link'
import { AlertTriangle, Check, Clock, Flag, Flame, Gamepad2, Inbox, Play, Star, Trophy, Wrench, X } from 'lucide-react'
import {
    judiStreak,
    judiWeek,
    listCounts,
    minutesInMonth,
    nextInQueue,
    parkedGames,
    playingNow,
    queueHorizon,
    queueMinutes,
    recentActivity,
    steamRunUrl,
    untilRelease,
    upcomingReleases,
    weekStrip,
    weeklyPace,
    yearSummary,
    type Activity,
    type JudiTodayState,
} from '@/lib/dashboard'
import type { DashboardData, HomeWishlistGame } from '@/lib/dashboard-db'
import { buildHeatmap, madridDate } from '@/lib/activity-heatmap'
import { RARITY_TIER_LABELS, rarityColor, rarityTier } from '@/lib/rarity'
import { formatPercent } from '@/lib/achievements'
import { countsByMonth, monthElapsed, monthName, progressFor, suggestTargets } from '@/lib/goals'
import { achievementPercent, gameDuration } from '@/lib/library'
import { formatHours } from '@/lib/format'
import { metacriticScore, ratingTier } from '@/lib/scores'
import { formatPrice, isAtAllStoresLow, isAtHistoricalLow } from '@/lib/wishlist'
import { loadMostWishlisted } from '@/lib/steam-upcoming'
import type { LibraryGame } from '@/lib/tracker'
import { isJudiMaintenance, maintenanceReturn, maintenanceReturnLine, maintenanceUntilRaw, parseMaintenanceUntil } from '@/lib/judi-maintenance'
import { Button } from '@/components/ui/button'
import GameCover from '@/components/tracker/GameCover'
import CountUp from '@/components/CountUp'
import ActivityHeatmap from './ActivityHeatmap'
import SyncButton from './SyncButton'
import WhatToPlay from './WhatToPlay'
import ListShortcuts from './ListShortcuts'
import MonthlyGoals from './MonthlyGoals'
import OpenSearchButton from './OpenSearchButton'
import Carousel from './Carousel'
import { ParkedActions, SoonActions } from './HomeActions'
import { shortDate, timeAgo } from './format'
import './dashboard.css'
import './home.css'
import { achievementIconUrl } from '@/lib/steam-icon'

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>

/** Posición en la entrada escalonada (`.hg-enter`, styles/lists.css). */
const enter = (i: number): CSSVars => ({ '--i': i })

const HOUR = new Intl.DateTimeFormat('es-ES', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' })
const LONG_DAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: 'UTC' })
const RELEASE_DAY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' })

/** «Buenos días» de 6 a 14, «Buenas tardes» hasta las 21 y «Buenas noches» el resto, en hora de Madrid. */
function greeting(now: number): string {
    const h = Number(HOUR.format(new Date(now)))
    return h >= 6 && h < 14 ? 'Buenos días' : h >= 14 && h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

/** «1,6 h», «45 min» o «0». */
function short(minutes: number): string {
    return minutes === 0 ? '0' : formatHours(minutes)
}

/** Cabecera del panel de JUDI: título y, a la derecha, su estado. */
function SectionHead({ id, title, children }: { id: string; tone?: string; icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
    return (
        <header className="home-head">
            <h2 id={id} className="home-head__title">
                {title}
            </h2>
            {children && <span className="home-head__end">{children}</span>}
        </header>
    )
}

/** Cabecera de sección: título en frase, recuento en gris y un enlace. */
function Head({ id, title, count, more }: { id: string; title: string; count?: string; more?: { href: string; label: string } }) {
    return (
        <>
            <h2 id={id} className="home-head__title">
                {title}
            </h2>
            {count && <span className="home-head__count">{count}</span>}
            {more && (
                <Link href={more.href} className="home-head__more">
                    {more.label}
                </Link>
            )}
        </>
    )
}

/** Tu semana: una portada por día con lo que más jugaste y las horas debajo; los días sin jugar, un hueco punteado. */
function WeekStrip({ data }: { data: DashboardData }) {
    const unlockDays = data.activity.unlockTimes.map((t) => madridDate(t))
    const week = weekStrip(data.activity.playtime, unlockDays, data.activity.today)
    const names = new Map(data.games.map((g) => [g.appid, g]))
    return (
        <ol className="home-week" aria-label="Lo que más jugaste cada día de los últimos 7">
            {week.map((d) => {
                const g = d.appid !== null ? names.get(d.appid) : undefined
                const day = d.today ? 'Hoy' : LONG_DAY.format(new Date(`${d.date}T00:00:00Z`))
                const tip = d.minutes
                    ? `${day[0].toUpperCase() + day.slice(1)}: ${formatHours(d.minutes)}${g?.name ? `, sobre todo ${g.name}` : ''}${d.unlocks ? `, ${d.unlocks} ${d.unlocks === 1 ? 'logro' : 'logros'}` : ''}`
                    : `${day[0].toUpperCase() + day.slice(1)}: no jugaste`
                return (
                    <li key={d.date} className={`${d.minutes ? '' : 'is-zero'}${d.today ? ' is-today' : ''}`} title={tip}>
                        <span className="home-week__d" aria-hidden>
                            {d.label}
                        </span>
                        <span className="home-week__tile" aria-hidden>
                            {d.appid !== null && <GameCover appid={d.appid} name={g?.name ?? null} headerImage={g?.header_image ?? null} variant="vertical" sizes="48px" />}
                        </span>
                        <span className="home-week__h" aria-hidden>
                            {short(d.minutes)}
                        </span>
                        <span className="sr-only">{tip}</span>
                    </li>
                )
            })}
        </ol>
    )
}

/** Continuar jugando: fichas bajas con la portada vertical, el progreso de logros y Jugar; el hueco libre ofrece el siguiente pendiente. */
function PlayingTile({ game, rarest, now }: { game: LibraryGame; rarest: number | undefined; now: number }) {
    const tier = rarityTier(rarest)
    const name = game.name ?? `App ${game.appid}`
    const pct = achievementPercent(game)
    return (
        <article className="home-play">
            <span className="home-play__art">
                <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="vertical" sizes="96px" />
            </span>
            <div className="home-play__body">
                <div>
                    <Link href={`/juego/${game.appid}`} className="home-play__name">
                        {name}
                    </Link>
                    <div className="home-play__meta" title={game.rtime_last_played ? `Última partida: ${shortDate(game.rtime_last_played)}` : undefined}>
                        {formatHours(game.playtime_forever)} jugadas, {game.rtime_last_played ? timeAgo(game.rtime_last_played, now) : 'sin jugar'}
                    </div>
                </div>
                {pct === null ? (
                    <div className="home-prog__label">Sin logros</div>
                ) : (
                    <div>
                        <div className="home-prog__label">
                            <Link href={`/juego/${game.appid}/logros`} className="home-play__ach">
                                <b>{game.achievements_unlocked ?? 0}</b> de {game.achievements_total} logros
                            </Link>
                            {tier && rarest !== undefined && (
                                <span className="home-rar" style={{ '--c': rarityColor(tier) } as CSSVars} title="Tu logro más raro">
                                    {RARITY_TIER_LABELS[tier]} {formatPercent(rarest)}
                                </span>
                            )}
                        </div>
                        <span className="home-bar" aria-hidden>
                            <span style={{ width: `${pct}%` }} />
                        </span>
                    </div>
                )}
            </div>
            <a className="home-play__go" href={steamRunUrl(game.appid)} aria-label={`Jugar a ${name}`} title="Jugar">
                <Play aria-hidden />
            </a>
        </article>
    )
}

function FreeSlot({ next }: { next: LibraryGame | undefined }) {
    if (!next)
        return (
            <div className="home-slot">
                <span className="home-slot__art" />
                <div>
                    <div className="home-slot__title">Tienes un hueco libre</div>
                    <small>Elige algo de la bandeja o busca un juego</small>
                </div>
                <OpenSearchButton size="sm" />
            </div>
        )
    return (
        <div className="home-slot">
            <span className="home-slot__art">
                <GameCover appid={next.appid} name={next.name} headerImage={next.header_image} variant="vertical" sizes="96px" />
            </span>
            <div>
                <div className="home-slot__title">Tienes un hueco libre</div>
                <b>{next.name ?? `App ${next.appid}`}</b>
                <small>Es el siguiente en Pendientes</small>
            </div>
            {next.owned ? (
                <a className="home-btn home-btn--inv" href={steamRunUrl(next.appid)}>
                    Empezar
                </a>
            ) : (
                <Link className="home-btn home-btn--inv" href={`/juego/${next.appid}`}>
                    Ver
                </Link>
            )}
        </div>
    )
}

/** Un pendiente en el carrusel: portada, posición, oferta si no lo tienes, duración, nota y cuándo llegas a él. */
function Poster({ game, index, weeks, freeSlot }: { game: LibraryGame; index: number; weeks: number | null; freeSlot: boolean }) {
    const main = gameDuration(game).main
    const mc = game.metacritic_score !== null ? metacriticScore(game.metacritic_score) : null
    const deal = !game.owned && (game.discount_percent ?? 0) > 0 ? { now: formatPrice(game.price_final), was: formatPrice(game.price_initial) } : null
    const now = weeks === 0
    const when = weeks === null ? null : now ? 'Puedes empezarlo ya' : weeks <= 1 ? 'La semana que viene' : `En unas ${weeks} semanas`
    return (
        <Link href={`/juego/${game.appid}`} className="home-poster" role="listitem">
            <span className="home-poster__art">
                <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="vertical" sizes="192px" />
                <span className={`home-pos${index === 0 ? ' home-pos--next' : ''}`}>{index === 0 ? 'Siguiente' : index + 1}</span>
                {deal && (
                    <span className="home-deal">
                        {deal.now} <s>{deal.was}</s>
                    </span>
                )}
            </span>
            <span className="home-poster__name">{game.name ?? `App ${game.appid}`}</span>
            <span className="home-poster__meta">
                <span>{game.endless ? 'Sin final' : main !== null ? `Historia ${formatHours(main)}` : 'Sin duración'}</span>
                {mc && (
                    <span className={`home-score sc-${mc.tier}`} title={`Metacritic: ${mc.label}`}>
                        {game.metacritic_score}
                    </span>
                )}
            </span>
            {when && <span className={`home-poster__when${now && freeSlot ? ' is-now' : ''}`}>{when}</span>}
        </Link>
    )
}

/** Un juego de la wishlist en su mínimo histórico. */
function Deal({ game, queued }: { game: HomeWishlistGame; queued: boolean }) {
    return (
        <Link href={`/juego/${game.appid}`} className="home-dl" role="listitem">
            <span className="home-dl__art">
                <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="384px" />
                <span className="home-dl__off">−{game.discount_percent} %</span>
            </span>
            <span className="home-dl__name">{game.name ?? `App ${game.appid}`}</span>
            <span className="home-dl__price">
                <b>{formatPrice(game.price_final)}</b>
                <s>{formatPrice(game.price_initial)}</s>
            </span>
            <span className="home-dl__meta">
                {isAtAllStoresLow(game) ? <b>Mínimo en todas las tiendas</b> : 'Mínimo en Steam'}
                {queued && '. Está en tus pendientes'}
            </span>
        </Link>
    )
}

/** Aparcado: la cabecera en gris (coge polvo) con los días sin jugar; recupera el color al pasar por encima. */
function Parked({ game, days }: { game: LibraryGame; days: number }) {
    const name = game.name ?? `App ${game.appid}`
    const pct = achievementPercent(game)
    return (
        <article className="home-park" role="listitem">
            <Link href={`/juego/${game.appid}`} className="home-park__art" aria-label={name}>
                <GameCover appid={game.appid} name={game.name} headerImage={game.header_image} variant="header" sizes="384px" />
                <span className="home-park__days">
                    <b>{days} días</b>
                    <span>sin jugar</span>
                </span>
            </Link>
            <div className="home-park__body">
                <div>
                    <Link href={`/juego/${game.appid}`} className="home-park__name">
                        {name}
                    </Link>
                    <div className="home-park__meta">
                        <b>{game.status === 'pausado' ? 'Pausado' : 'Jugando'}</b>
                        {pct !== null ? `, con el ${pct} % de los logros` : `, ${formatHours(game.playtime_forever)} jugadas`}
                    </div>
                </div>
                <ParkedActions appid={game.appid} status={game.status} name={name} />
            </div>
        </article>
    )
}

/** Fecha de una fila de «Sale pronto» («4 de diciembre»). */
function releaseDay(date: string): string {
    return RELEASE_DAY.format(new Date(`${date}T00:00:00Z`))
}

/** Sale pronto: lo de tu wishlist que tiene fecha y, debajo, lo más deseado de Steam que aún no sigues. */
async function SoonList({ data, today, tracked, pending }: { data: DashboardData; today: string; tracked: Set<number>; pending: Set<number> }) {
    // Solo con día concreto: «2027» o «Q1 2027» no dicen cuándo sale.
    const dated = data.wishlist.filter((w) => w.coming_soon !== false && /\b\d{1,2}\b/.test(w.release_date_text ?? ''))
    const mine = upcomingReleases(dated, today, 4)
    const wished = new Set(data.wishlist.map((w) => w.appid))
    const hyped = upcomingReleases(
        (await loadMostWishlisted()).filter((h) => !wished.has(h.appid) && !tracked.has(h.appid)),
        today,
        4,
    )
    if (mine.length === 0 && hyped.length === 0) return <p className="home-empty">No hay lanzamientos con fecha en tu wishlist ni entre lo más esperado de Steam.</p>
    const row = (g: { appid: number; name: string | null; header_image: string | null; release_date: string; days: number }, sub: string, wishlist: boolean) => (
        <li key={g.appid} className="home-row home-row--soon">
            <span className="home-row__media home-row__media--wide">
                <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="192px" />
            </span>
            <span className="home-row__main">
                <Link href={`/juego/${g.appid}`} className="home-row__name">
                    {g.name ?? `App ${g.appid}`}
                </Link>
                <span className="home-row__sub">
                    <b className={g.days < 14 ? 'is-close' : undefined}>{untilRelease(g.days)}</b>, {sub}
                </span>
            </span>
            <SoonActions appid={g.appid} name={g.name ?? `App ${g.appid}`} pending={pending.has(g.appid)} wishlist={wishlist} />
        </li>
    )
    return (
        <>
            {mine.length > 0 && (
                <>
                    <h3 className="home-soon__group">De tu wishlist</h3>
                    <ul className="home-rows">{mine.map((g) => row(g, releaseDay(g.release_date), true))}</ul>
                </>
            )}
            {hyped.length > 0 && (
                <>
                    <h3 className="home-soon__group">Lo más esperado en Steam</h3>
                    <ul className="home-rows">{hyped.map((g) => row(g, `${releaseDay(g.release_date)}. Nº ${g.rank} en lo más deseado`, false))}</ul>
                </>
            )}
        </>
    )
}

function SoonSkeleton() {
    return (
        <ul className="home-rows" aria-busy="true" aria-label="Cargando lo que sale pronto">
            {[0, 1, 2, 3].map((i) => (
                <li key={i} className="home-row home-row--soon is-loading">
                    <span className="home-row__media home-row__media--wide" />
                    <span className="home-row__main">
                        <span className="home-skel" style={{ width: '60%' }} />
                        <span className="home-skel" style={{ width: '35%' }} />
                    </span>
                </li>
            ))}
        </ul>
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


/**
 * Inicio con sesión: tu semana y tus listas arriba; lo que juegas, tus pendientes (lo más usado), los mínimos de la
 * wishlist y lo aparcado en carruseles; logros y lanzamientos; tu año y JUDI; y «¿Qué juego hoy?» al final.
 */
export default function Dashboard({ data, now, seed }: { data: DashboardData; now: number; seed: number }) {
    const playing = playingNow(data.games)
    const queue = nextInQueue([...data.games, ...data.unowned], Infinity)
    const activity = recentActivity(data.recentUnlocks, data.games, 6)
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

    const weekFrom = Date.parse(`${data.activity.today}T00:00:00Z`) - 6 * 86400_000
    const weekMinutes = data.activity.playtime.reduce((s, r) => s + (Date.parse(`${r.date}T00:00:00Z`) >= weekFrom ? r.minutes : 0), 0)
    const weekUnlocks = data.activity.unlockTimes.filter((t) => Date.parse(`${madridDate(t)}T00:00:00Z`) >= weekFrom).length

    const head = (
        <header className="home-top hg-enter" style={enter(0)}>
            <div className="home-top__row">
                <div>
                    <h1 className="home-hello">{data.username ? `${greeting(now)}, ${data.username}` : greeting(now)}</h1>
                    <p className="home-sub">
                        {!linked ? (
                            <span>Conecta tu cuenta de Steam para ver tu biblioteca y tus logros.</span>
                        ) : (
                            <>
                                <span>
                                    Esta semana llevas <b>{formatHours(weekMinutes)}</b> y{' '}
                                    <b>
                                        {weekUnlocks} {weekUnlocks === 1 ? 'logro' : 'logros'}
                                    </b>
                                    .
                                </span>
                                <span className="home-sub__sync" title={data.steam.lastSyncAt ? new Date(data.steam.lastSyncAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : undefined}>
                                    {data.steam.lastSyncAt ? `Sincronizado ${timeAgo(data.steam.lastSyncAt, now)}` : 'Aún no se ha sincronizado'}
                                </span>
                            </>
                        )}
                        {hidden && (
                            <span className="home-sub__warn">
                                <AlertTriangle aria-hidden /> Tu perfil de Steam oculta los detalles de juego: no se pueden leer horas ni logros.{' '}
                                <Link href="/perfil">Cómo cambiarlo</Link>
                            </span>
                        )}
                    </p>
                </div>
                {linked && (
                    <div className="home-top__end">
                        <WeekStrip data={data} />
                        <SyncButton variant="secondary" />
                    </div>
                )}
            </div>
            {linked && <ListShortcuts counts={counts} limit={data.playingLimit} style={enter(1)} />}
        </header>
    )

    if (!linked) {
        return (
            <div className="home">
                {head}
                <ConnectCard />
                <div className="home-bottom">
                    <JudiPanel data={data} index={2} now={now} />
                </div>
            </div>
        )
    }

    const free = Math.max(0, data.playingLimit - playing.length)
    const pace = weeklyPace(data.activity.playtime, data.activity.today)
    const horizon = queueHorizon(queue, pace, free > 0)
    const queueTotal = queueMinutes(queue)
    const pending = new Set(queue.map((g) => g.appid))
    const tracked = new Set([...data.games, ...data.unowned].map((g) => g.appid))
    const deals = data.wishlist.filter(isAtHistoricalLow).sort((a, b) => (b.discount_percent ?? 0) - (a.discount_percent ?? 0))
    const parked = parkedGames(data.games, now)
    const rating = year.averageRating

    return (
        <div className="home">
            {head}

            <section className="hg-enter" style={enter(2)} aria-labelledby="home-playing">
                <div className="home-head">
                    <Head
                        id="home-playing"
                        title="Continuar jugando"
                        count={`${playing.length} de ${data.playingLimit} a la vez`}
                        more={{ href: '/biblioteca?estado=jugando', label: 'Ver todos' }}
                    />
                </div>
                <div className="home-playing">
                    {playing.map((g) => (
                        <PlayingTile key={g.appid} game={g} rarest={data.rarestPercent[g.appid]} now={now} />
                    ))}
                    {free > 0 && <FreeSlot next={queue[0]} />}
                </div>
            </section>

            <section className="hg-enter" style={enter(3)} aria-labelledby="home-queue">
                {queue.length === 0 ? (
                    <>
                        <div className="home-head">
                            <Head id="home-queue" title="Pendientes" />
                        </div>
                        <p className="home-empty">
                            Tu lista de pendientes está vacía.{' '}
                            {counts.bandeja > 0 ? (
                                <Link href="/biblioteca/bandeja">
                                    <Inbox aria-hidden /> Clasifica los {counts.bandeja} de la bandeja
                                </Link>
                            ) : (
                                'Busca un juego para añadirlo.'
                            )}
                        </p>
                    </>
                ) : (
                    <>
                        <Carousel
                            label="Tus pendientes, en orden"
                            className="home-queue"
                            head={
                                <Head
                                    id="home-queue"
                                    title="Pendientes"
                                    count={`${queue.length} ${queue.length === 1 ? 'juego' : 'juegos'}${queueTotal ? `, unas ${Math.round(queueTotal / 60)} h` : ''}`}
                                    more={{ href: '/biblioteca?estado=pendiente', label: 'Ordenar' }}
                                />
                            }
                        >
                            {queue.map((g, i) => (
                                <Poster key={g.appid} game={g} index={i} weeks={horizon[i]} freeSlot={free > 0} />
                            ))}
                        </Carousel>
                        {pace > 0 && (
                            <p className="home-note">
                                Calculado a tu ritmo de los últimos 28 días, <b>{formatHours(pace)} por semana</b>.
                                {queueTotal > 0 && ` A ese ritmo acabas todos tus pendientes en unas ${Math.max(1, Math.round(queueTotal / pace))} semanas.`}
                            </p>
                        )}
                    </>
                )}
            </section>

            {deals.length > 0 && (
                <section className="hg-enter" style={enter(4)} aria-labelledby="home-deals">
                    <Carousel
                        label="Juegos de tu wishlist en su mínimo histórico"
                        className="home-deals"
                        head={
                            <Head
                                id="home-deals"
                                title="En su mínimo histórico"
                                count={`${deals.length} de los ${data.wishlist.length} de tu wishlist`}
                                more={{ href: '/wishlist?filtro=minimo', label: 'Ver en la wishlist' }}
                            />
                        }
                    >
                        {deals.map((g) => (
                            <Deal key={g.appid} game={g} queued={pending.has(g.appid)} />
                        ))}
                    </Carousel>
                </section>
            )}

            {parked.length > 0 && (
                <section className="hg-enter" style={enter(5)} aria-labelledby="home-parked">
                    <Carousel
                        label="Juegos aparcados"
                        className="home-parked"
                        head={
                            <Head
                                id="home-parked"
                                title="Aparcados"
                                count={`${parked.length} ${parked.length === 1 ? 'juego' : 'juegos'} con más de 60 días sin jugar`}
                                more={{ href: '/biblioteca?estado=pausado', label: 'Ver pausados' }}
                            />
                        }
                    >
                        {parked.map((p) => (
                            <Parked key={p.game.appid} game={p.game} days={p.days} />
                        ))}
                    </Carousel>
                </section>
            )}

            <div className="home-cols">
                <section className="home-panel hg-enter" style={enter(6)} aria-labelledby="home-activity">
                    <div className="home-head">
                        <Head id="home-activity" title="Logros recientes" more={{ href: '/logros/historial', label: 'Historial' }} />
                    </div>
                    {activity.length === 0 ? (
                        <p className="home-empty">Aparecerán aquí al sincronizar.</p>
                    ) : (
                        <ul className="hg-achs">
                            {activity.map((a, i) => (
                                <ActivityItem key={`${a.kind}-${a.appid}-${a.at}-${a.kind === 'logro' ? a.achievement.display_name : ''}`} item={a} index={i} now={now} />
                            ))}
                        </ul>
                    )}
                </section>
                <section className="home-panel hg-enter" style={enter(7)} aria-labelledby="home-soon">
                    <div className="home-head">
                        <Head id="home-soon" title="Sale pronto" more={{ href: '/wishlist', label: 'Wishlist' }} />
                    </div>
                    <Suspense fallback={<SoonSkeleton />}>
                        <SoonList data={data} today={data.activity.today} tracked={tracked} pending={pending} />
                    </Suspense>
                </section>
            </div>

            <div className="home-bottom">
                <div className="home-year hg-enter" style={enter(8)}>
                    <ActivityHeatmap
                        map={heatmap}
                        header={
                            <p className="home-year__line">
                                <b>
                                    <CountUp value={Math.round(year.minutes / 60)} suffix=" h" />
                                </b>{' '}
                                jugadas este año, <b>{formatHours(minutesInMonth(data.activity.playtime, data.goals.month))}</b> en {month}.{' '}
                                <b>{year.unlocks}</b> logros y <b>{year.completed}</b> completados
                                {rating !== null && (
                                    <>
                                        , con un{' '}
                                        <b className={`home-score sc-${ratingTier(rating)}`}>
                                            <Star aria-hidden /> {String(rating).replace('.', ',')}
                                        </b>{' '}
                                        de media
                                    </>
                                )}
                                .
                            </p>
                        }
                        footer={
                            <span className="heat__extra">
                                <Link href="/estadisticas" className="dash-link">
                                    Ver estadísticas
                                </Link>
                            </span>
                        }
                    />
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
                <JudiPanel data={data} index={9} now={now} />
            </div>

            <div className="hg-enter" style={enter(10)}>
                <WhatToPlay games={data.games} unowned={data.unowned} now={now} initialSeed={seed} />
            </div>
        </div>
    )
}
