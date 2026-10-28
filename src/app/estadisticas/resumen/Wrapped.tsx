'use client'

import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Award, BarChart3, Calendar, Check, Clock, Crown, Download, Flag, Flame, Share2, Star, Trophy, CircleAlert, type LucideIcon } from 'lucide-react'
import { madridDay } from '@/lib/stats'
import { formatHours } from '@/lib/format'
import { formatPercent } from '@/lib/achievements'
import { RARITY_TIER_LABELS, rarityColor, rarityTier } from '@/lib/rarity'
import { metacriticScore, ratingLabel, ratingTier } from '@/lib/scores'
import { achievementIconUrl } from '@/lib/steam-icon'
import { dayLong, formatRating, hoursEquivalents, shareOfYear, streakSquares, type WrappedGame, type WrappedView } from '@/lib/wrapped'
import { Button } from '@/components/ui/button'
import CountUp from '@/components/CountUp'
import Tile from '@/components/Tile'
import GameCover from '@/components/tracker/GameCover'
import { MarkFlags, StatusChip } from '@/components/tracker/status'
import { HeroImage } from '@/app/juego/[appid]/Media'
import Reveal, { useRevealed } from './Reveal'
import YearPicker from './YearPicker'

type CSSVars = CSSProperties & Record<`--${string}`, string | number>

const NUMBER = new Intl.NumberFormat('es-ES')
const DAY_SHORT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** «Lo que completaste»: cuántas cápsulas a la vista; el resto, en las estadísticas. */
const DONE_SHOWN = 12

function dayShort(iso: string): string {
    const [y, m, d] = madridDay(iso).split('-').map(Number)
    return DAY_SHORT.format(new Date(Date.UTC(y, m - 1, d))).replace('.', '')
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Head({ icon: Icon, tone = 'st-todos', color, title, count, end }: { icon: LucideIcon; tone?: string; color?: string; title: string; count?: ReactNode; end?: ReactNode }) {
    return (
        <div className="wr-head">
            <span className={`wr-head__icon hg-tint ${color ? 'rar-ink' : tone}`} style={color ? ({ '--c': color } as CSSVars) : undefined}>
                <Icon aria-hidden />
            </span>
            <h2>{title}</h2>
            {count !== undefined && <span className="wr-head__count">{count}</span>}
            {end && <span className="wr-head__end">{end}</span>}
        </div>
    )
}

/** Tu nota con su color y su palabra; «—» si no tiene. `compact`: la palabra solo para lectores de pantalla. */
function Score({ rating, compact = false }: { rating: number | null; compact?: boolean }) {
    if (rating === null) {
        return (
            <span className="wr-score is-none" title="Sin nota">
                <Star aria-hidden />—<span className="sr-only">Sin nota</span>
            </span>
        )
    }
    const label = ratingLabel(rating)
    return (
        <span className={`wr-score hg-tint sc-${ratingTier(rating)}`} title={compact ? `Tu nota: ${label}` : undefined}>
            <Star aria-hidden />
            <b>{formatRating(rating)}</b>
            {compact ? <span className="sr-only"> {label}</span> : ` ${label}`}
        </span>
    )
}

const gameName = (g: { appid: number; name: string | null }) => g.name ?? `App ${g.appid}`

/** Resumen anual (#33): la página «de celebración». Bloques que se revelan al llegar con el scroll, una vez. */
export default function Wrapped({ data, years }: { data: WrappedView; years: number[] }) {
    const shareRef = useRef<HTMLElement>(null)
    const [busy, setBusy] = useState<'share' | 'download' | null>(null)
    const [message, setMessage] = useState<{ text: string; error?: boolean; n: number } | null>(null)
    const hours = Math.round(data.minutes / 60)
    const approx = data.hoursMeasured ? '' : '≈ '
    const imageUrl = `/api/estadisticas/resumen/imagen?year=${data.year}`
    const fileName = `hubgames-${data.year}.png`
    const [best] = data.top

    async function run(kind: 'share' | 'download', fromHero = false) {
        setBusy(kind)
        setMessage(null)
        const say = (text: string, error = false) => {
            setMessage((m) => ({ text, error, n: (m?.n ?? 0) + 1 }))
            if (fromHero) shareRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
        }
        try {
            const res = await fetch(imageUrl)
            if (!res.ok) throw new Error(String(res.status))
            const blob = await res.blob()
            const file = new File([blob], fileName, { type: 'image/png' })
            if (kind === 'share' && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], text: `Mi ${data.year} en HubGames` })
                return
            }
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = fileName
            a.click()
            URL.revokeObjectURL(a.href)
            say(`Imagen descargada · ${fileName}`)
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return
            say('No se pudo preparar la imagen', true)
        } finally {
            setBusy(null)
        }
    }

    const shareButton = (fromHero: boolean) => (
        <Button onClick={() => void run('share', fromHero)} loading={busy === 'share'} disabled={busy !== null}>
            {busy === 'share' ? (
                'Preparando…'
            ) : (
                <>
                    <Share2 aria-hidden /> Compartir imagen
                </>
            )}
        </Button>
    )

    return (
        <div className="wr anim">
            <Link href={`/estadisticas?year=${data.year}`} className="wr-back">
                <ArrowLeft aria-hidden /> Estadísticas de {data.year}
            </Link>

            <Reveal as="header" className="wr-hero" initial>
                <div>
                    <p className="wr-hero__kicker">
                        Tu resumen del año{data.through && <span> · hasta hoy, {dayLong(data.through)}</span>}
                    </p>
                    <h1 className="wr-hero__year" aria-label={String(data.year)}>
                        {String(data.year)
                            .split('')
                            .map((c, k) => (
                                <span key={k} className="d" style={{ '--k': k } as CSSVars} aria-hidden>
                                    {c}
                                </span>
                            ))}
                    </h1>
                    <p className="wr-hero__lead">
                        <b>
                            {NUMBER.format(data.activeGames)} {data.activeGames === 1 ? 'juego' : 'juegos'}
                        </b>{' '}
                        con actividad
                        {data.topGenre && (
                            <>
                                , sobre todo <b>{data.topGenre.toLowerCase()}</b>
                            </>
                        )}
                        . Esto es lo que dio de sí.
                    </p>
                </div>
                <div className="wr-hero__side">
                    <YearPicker years={years} year={data.year} />
                    {shareButton(true)}
                </div>
            </Reveal>

            {data.minutes > 0 && <HoursBlock data={data} hours={hours} approx={approx} />}
            {best && <GotyBlock data={data} game={best} approx={approx} />}
            {data.top.length >= 2 && <TopBlock top={data.top} approx={approx} />}
            {data.rarest && <RareBlock data={data} />}

            <div className="wr-pair">
                {data.streak.length >= 2 && <StreakBlock data={data} />}
                <NumbersBlock data={data} />
            </div>

            {data.completedGames.length > 0 && <DoneBlock data={data} />}

            <Reveal className="wr-block">
                <Head icon={Share2} title="Compártelo" />
                <div className="wr-share" ref={shareRef as never}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- PNG generado con next/og */}
                    <img className="wr-share__img" src={imageUrl} alt={`Resumen de ${data.year} en HubGames`} width={1200} height={630} loading="lazy" />
                    <div className="wr-share__side">
                        <p>Una imagen de 1200 × 630 con tu año. Solo la puedes generar tú: son tus datos.</p>
                        {shareButton(false)}
                        <Button variant="secondary" onClick={() => void run('download')} loading={busy === 'download'} disabled={busy !== null}>
                            {busy === 'download' ? (
                                'Preparando…'
                            ) : (
                                <>
                                    <Download aria-hidden /> Descargar
                                </>
                            )}
                        </Button>
                        <div role="status" aria-live="polite">
                            {message && (
                                <p key={message.n} className={`wr-toast${message.error ? ' is-error' : ''}`}>
                                    {message.error ? <CircleAlert aria-hidden /> : <Check className="hg-draw" aria-hidden />} {message.text}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </Reveal>
        </div>
    )
}

function HoursBlock({ data, hours, approx }: { data: WrappedView; hours: number; approx: string }) {
    const eq = hoursEquivalents(data.minutes, data.days)
    return (
        <Reveal className="wr-block">
            <Head icon={Clock} title="Horas jugadas" />
            <div className={`wr-hours${data.months ? '' : ' wr-hours--solo'}`}>
                <div>
                    <HoursFigure hours={hours} approx={approx} />
                    <ul className="wr-facts">
                        <li className="wr-fact" style={{ '--k': 0 } as CSSVars}>
                            <Clock aria-hidden />
                            <span>
                                <b>≈ {eq.perDay}</b> al día
                            </span>
                        </li>
                        {eq.wholeDays >= 1 && (
                            <li className="wr-fact" style={{ '--k': 1 } as CSSVars}>
                                <Calendar aria-hidden />
                                <span>
                                    <b>{NUMBER.format(eq.wholeDays)}</b> {eq.wholeDays === 1 ? 'día entero' : 'días enteros'}
                                </span>
                            </li>
                        )}
                    </ul>
                    <p className="wr-note">
                        {data.hoursMeasured
                            ? 'Medidas día a día con tu historial de horas.'
                            : 'Aproximadas: las horas de cada juego, repartidas entre los años de sus logros. Sin historial de ese año no hay reparto por meses.'}
                    </p>
                </div>
                {data.months && <MonthBars months={data.months} />}
            </div>
        </Reveal>
    )
}

function HoursFigure({ hours, approx }: { hours: number; approx: string }) {
    const run = useRevealed()
    return (
        <p className="wr-big">
            {approx}
            <CountUp value={hours} duration={1100} run={run} />
            <small>h</small>
        </p>
    )
}

/** Horas mes a mes: forma «énfasis» (dataviz), columnas grises y el mes más fuerte en cobalto con su cifra. */
function MonthBars({ months }: { months: number[] }) {
    const max = Math.max(...months)
    const peak = max > 0 ? months.indexOf(max) : -1
    return (
        <div>
            <div className="wr-months" role="img" aria-label={peak >= 0 ? `Horas por mes; el mes más fuerte, ${MONTHS[peak]}, con ${formatHours(max)}` : 'Horas por mes'}>
                {months.map((m, k) => {
                    const h = max > 0 ? Math.round((m / max) * 100) : 0
                    return (
                        <div key={k} className={`wr-m${k === peak ? ' is-peak' : ''}`} tabIndex={0} style={{ '--k': k, '--h': `${h}%` } as CSSVars} aria-label={`${cap(MONTHS[k])}: ${formatHours(m)}`}>
                            <div className="wr-m__track">
                                <div className="wr-m__bar" />
                                {k === peak && <span className="wr-m__peak">{formatHours(m)}</span>}
                                <span className="wr-tip" aria-hidden>
                                    {cap(MONTHS[k])} · {formatHours(m)}
                                </span>
                            </div>
                            <span className="wr-m__lbl" aria-hidden>
                                {MONTH_SHORT[k]}
                            </span>
                        </div>
                    )
                })}
            </div>
            {peak >= 0 && <p className="wr-months-cap">Horas por mes · {MONTHS[peak]} fue tu mes más fuerte</p>}
        </div>
    )
}

function GotyBlock({ data, game, approx }: { data: WrappedView; game: WrappedGame; approx: string }) {
    const share = shareOfYear(game.minutes, data.minutes)
    const mc = game.metacritic !== null ? metacriticScore(game.metacritic) : null
    const href = `/juego/${game.appid}`
    return (
        <Reveal className="wr-block">
            <Head icon={Crown} title="Tu juego del año" />
            <div className="wr-goty">
                <Link href={href} className="wr-goty__hero" tabIndex={-1} aria-hidden>
                    <HeroImage appid={game.appid} headerImage={game.header_image} />
                </Link>
                <div className="wr-goty__body">
                    <div>
                        <h3 className="wr-goty__name">
                            <Link href={href}>{gameName(game)}</Link>
                        </h3>
                        {(game.status || game.favorite || game.endless) && (
                            <div className="wr-goty__chips">
                                {game.status && (
                                    <span style={{ '--k': 0 } as CSSVars}>
                                        <StatusChip status={game.status} />
                                    </span>
                                )}
                                {(game.favorite || game.endless) && (
                                    <span style={{ '--k': 1 } as CSSVars}>
                                        <MarkFlags favorite={game.favorite} endless={game.endless} />
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="wr-goty__share">
                        <p>
                            <span>Tu año en este juego</span>
                            <b>
                                {approx}
                                {NUMBER.format(Math.round(game.minutes / 60))} h
                            </b>
                        </p>
                        <span className="hg-bar" aria-hidden>
                            <span style={{ width: `${share}%` }} />
                        </span>
                        <p>
                            <span>
                                el <strong>{share} %</strong> de tus horas de {data.year}
                            </span>
                        </p>
                    </div>
                    <ul className="wr-facts">
                        <li style={{ '--k': 0 } as CSSVars}>
                            <Score rating={game.rating} />
                        </li>
                        {mc && (
                            <li className={`wr-fact hg-tint sc-${mc.tier}`} style={{ '--k': 1 } as CSSVars}>
                                <b>{game.metacritic}</b> Metacritic · {mc.label}
                            </li>
                        )}
                        {game.unlocks > 0 && (
                            <li className="wr-fact" style={{ '--k': 2 } as CSSVars}>
                                <Award aria-hidden />
                                <span>
                                    <b>{NUMBER.format(game.unlocks)}</b> {game.unlocks === 1 ? 'logro' : 'logros'} este año
                                </span>
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </Reveal>
    )
}

/** Top 5 (o los que haya) por horas, que aparece del 5 al 1; el 1 llega el último con un pop. */
function TopBlock({ top, approx }: { top: WrappedGame[]; approx: string }) {
    const n = top.length
    const max = top[0].minutes || 1
    return (
        <Reveal className="wr-block">
            <Head icon={Trophy} title={n >= 5 ? 'Tu top 5' : `Tus ${n} más jugados`} count="por horas" />
            <ol className="wr-top" style={{ '--n': n } as CSSVars}>
                {top.map((g, k) => (
                    <li key={g.appid} className={k === 0 ? 'is-first' : undefined} style={{ '--k': k } as CSSVars}>
                        <span className="wr-top__pos" aria-hidden>
                            {k + 1}
                        </span>
                        <span className="wr-top__cover">
                            <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="112px" />
                        </span>
                        <span className="wr-top__main">
                            <span className="wr-top__line">
                                <Link href={`/juego/${g.appid}`} className="wr-top__name" title={gameName(g)}>
                                    <span className="sr-only">{k + 1}. </span>
                                    {gameName(g)}
                                </Link>
                                {g.status && <StatusChip status={g.status} />}
                                <MarkFlags favorite={g.favorite} endless={g.endless} />
                            </span>
                            <span className="wr-top__barline">
                                <span className="hg-bar" aria-hidden>
                                    <span style={{ width: `${Math.max(2, Math.round((g.minutes / max) * 100))}%` }} />
                                </span>
                                <b>
                                    {approx}
                                    {NUMBER.format(Math.round(g.minutes / 60))} h
                                </b>
                            </span>
                        </span>
                        <Score rating={g.rating} />
                    </li>
                ))}
            </ol>
        </Reveal>
    )
}

const SPARKS = Array.from({ length: 12 }, (_, k) => ({ a: `${k * 30 + (k % 2 ? 12 : 0)}deg`, d: `${k % 2 ? 70 : 92}px` }))

/** Logro más raro a lo grande, teñido de su rareza (destello, anillo y chispas si es épico o legendario), y los logros del año por rareza. */
function RareBlock({ data }: { data: WrappedView }) {
    const r = data.rarest!
    const tier = rarityTier(r.global_percent)
    const flash = tier === 'epica' || tier === 'leg'
    const icon = achievementIconUrl(r.icon)
    const vars = tier ? ({ '--c': rarityColor(tier) } as CSSVars) : undefined
    const total = data.rarity.reduce((s, t) => s + t.count, 0)
    return (
        <Reveal className="wr-block">
            <Head icon={Trophy} color={tier ? rarityColor(tier) : undefined} title="Tu logro más raro" />
            <div className={`wr-rare${flash ? ' is-flash' : ''}`} style={vars}>
                <span className="wr-rare__icon">
                    {icon ? (
                        // eslint-disable-next-line @next/next/no-img-element -- icono de 64 px del CDN de Steam
                        <img src={icon} alt="" width={64} height={64} />
                    ) : (
                        <Trophy aria-hidden />
                    )}
                    {flash && (
                        <>
                            <span className="wr-rare__ring" aria-hidden />
                            {SPARKS.map((s, k) => (
                                <span key={k} className="wr-spark" style={{ '--a': s.a, '--d': s.d } as CSSVars} aria-hidden />
                            ))}
                        </>
                    )}
                </span>
                <div className="wr-rare__text">
                    <p className="wr-rare__name">{r.display_name ?? 'Logro'}</p>
                    {r.description && <p className="wr-rare__desc">{r.description}</p>}
                    <p className="wr-rare__ctx">
                        <span className="wr-rare__cover">
                            <GameCover appid={r.appid} name={r.game} headerImage={data.rarestHeader} variant="header" sizes="96px" />
                        </span>
                        <Link href={`/juego/${r.appid}`}>{r.game ?? `App ${r.appid}`}</Link>
                        <span>· el {dayLong(madridDay(r.unlocktime))}</span>
                    </p>
                </div>
                <div className="wr-rare__pct">
                    <strong className="rar-ink">{formatPercent(r.global_percent)}</strong>
                    {tier && (
                        <span className="hg-chip hg-tint rar-ink">
                            <Trophy aria-hidden />
                            {RARITY_TIER_LABELS[tier]}
                        </span>
                    )}
                    <span className="wr-rare__of">de los jugadores lo tiene</span>
                </div>
            </div>
            {total > 0 && (
                <div className="wr-tiers">
                    <p className="wr-tiers__head">
                        Tus logros de {data.year} por rareza <span>{NUMBER.format(total)} logros</span>
                    </p>
                    <div className="wr-stack" role="img" aria-label={data.rarity.map((t) => `${RARITY_TIER_LABELS[t.tier]}: ${t.count}`).join(', ')}>
                        {data.rarity.map((t) => (
                            <span key={t.tier} style={{ flex: t.count, '--c': rarityColor(t.tier) } as CSSVars} title={`${RARITY_TIER_LABELS[t.tier]}: ${NUMBER.format(t.count)}`} />
                        ))}
                    </div>
                    <ul className="wr-legend">
                        {data.rarity.map((t) => (
                            <li key={t.tier} style={{ '--c': rarityColor(t.tier) } as CSSVars}>
                                {RARITY_TIER_LABELS[t.tier]} <b>{NUMBER.format(t.count)}</b>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Reveal>
    )
}

function StreakBlock({ data }: { data: WrappedView }) {
    const s = data.streak
    const { shown, extra } = streakSquares(s.length)
    return (
        <Reveal className="wr-block">
            <Head icon={Flame} title="Tu mejor racha" />
            <StreakFigure length={s.length} />
            <p className="wr-note">
                Seguidos con logros o partidas, del {s.start ? dayLong(s.start) : ''} al {s.end ? dayLong(s.end) : ''}.
            </p>
            <div className="wr-streak" aria-hidden>
                {Array.from({ length: shown }, (_, k) => (
                    <span key={k} className={k === 0 || k === shown - 1 ? 'is-edge' : undefined} style={{ '--k': k } as CSSVars} />
                ))}
                {extra > 0 && <em>+{extra}</em>}
            </div>
        </Reveal>
    )
}

function StreakFigure({ length }: { length: number }) {
    const run = useRevealed()
    return (
        <p className="wr-big wr-big--md">
            <CountUp value={length} run={run} />
            <small>días</small>
        </p>
    )
}

function NumbersBlock({ data }: { data: WrappedView }) {
    return (
        <Reveal className="wr-block">
            <Head icon={BarChart3} title="En números" />
            <NumbersTiles data={data} />
        </Reveal>
    )
}

function NumbersTiles({ data }: { data: WrappedView }) {
    const run = useRevealed()
    const avg = data.averageRating
    const tiles = [
        { icon: <Award aria-hidden />, tone: 'st-sin_final', label: 'Logros', value: data.unlocks },
        { icon: <Flag aria-hidden />, tone: 'st-completado', label: 'Completados', value: data.completed },
        { icon: <Check aria-hidden />, tone: 'st-completado', label: 'Al 100 %', value: data.perfect },
    ]
    return (
        <dl className="hg-tiles wr-tiles">
            {tiles.map((t) => (
                <Tile key={t.label} icon={t.icon} tone={t.tone} label={t.label}>
                    <dd className="hg-tile__value">
                        <CountUp value={t.value} run={run} />
                    </dd>
                </Tile>
            ))}
            <Tile icon={<Star aria-hidden />} tone={avg !== null ? `sc-${ratingTier(avg)}` : 'st-todos'} label="Nota media">
                <dd className={`hg-tile__value${avg !== null ? ' wr-tile__score' : ''}`}>{avg !== null ? formatRating(avg) : '—'}</dd>
                <dd className="hg-tile__note">{avg !== null ? ratingLabel(avg) : 'Sin notas este año'}</dd>
            </Tile>
        </dl>
    )
}

function DoneBlock({ data }: { data: WrappedView }) {
    const all = data.completedGames
    const shown = all.slice(0, DONE_SHOWN)
    return (
        <Reveal className="wr-block">
            <Head
                icon={Flag}
                tone="st-completado"
                title="Lo que completaste"
                count={NUMBER.format(all.length)}
                end={
                    all.length > DONE_SHOWN ? (
                        <Link href={`/estadisticas?year=${data.year}`} className="link">
                            Ver los {NUMBER.format(all.length)}
                        </Link>
                    ) : undefined
                }
            />
            <ul className="wr-done">
                {shown.map((g, k) => (
                    <li key={g.appid} style={{ '--k': k } as CSSVars}>
                        <span className="wr-done__cover">
                            <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="192px" />
                        </span>
                        <Link href={`/juego/${g.appid}`} title={gameName(g)}>
                            {gameName(g)}
                        </Link>
                        <Score rating={g.rating} compact />
                        <time dateTime={madridDay(g.completed_at)}>{dayShort(g.completed_at)}</time>
                    </li>
                ))}
            </ul>
        </Reveal>
    )
}
