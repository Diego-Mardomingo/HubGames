'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Share2, Trophy } from 'lucide-react'
import type { Wrapped as WrappedData } from '@/lib/stats'
import { formatPercent } from '@/lib/achievements'
import { RARITY_TIER_LABELS, rarityColor, rarityTier } from '@/lib/rarity'
import { Button } from '@/components/ui/button'
import GameCover from '@/components/tracker/GameCover'
import { achievementIconUrl } from '@/lib/steam-icon'

const DAY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' })
const NUMBER = new Intl.NumberFormat('es-ES')

type CSSVars = React.CSSProperties & Record<`--${string}`, string>

function fmtDay(key: string | null): string {
    if (!key) return ''
    const [y, m, d] = key.split('-').map(Number)
    return DAY.format(new Date(y, m - 1, d, 12))
}

function Block({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
    return (
        <section className={`wrapped-block glass ${className}`}>
            <h2 className="wrapped-block__title">{title}</h2>
            {children}
        </section>
    )
}

/** Resumen anual (#33): el año en cifras grandes, de arriba abajo, y una imagen para compartir. */
export default function Wrapped({ data }: { data: WrappedData }) {
    const [message, setMessage] = useState<string | null>(null)
    const hours = Math.round(data.minutes / 60)
    const approx = data.hoursMeasured ? '' : '≈ '
    const imageUrl = `/api/estadisticas/resumen/imagen?year=${data.year}`
    const fileName = `hubgames-${data.year}.png`
    const [best, ...rest] = data.top
    const rareTier = data.rarest ? rarityTier(data.rarest.global_percent) : null

    async function share() {
        setMessage(null)
        try {
            const blob = await (await fetch(imageUrl)).blob()
            const file = new File([blob], fileName, { type: 'image/png' })
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], text: `Mi ${data.year} en HubGames` })
                return
            }
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = fileName
            a.click()
            URL.revokeObjectURL(a.href)
            setMessage('Imagen descargada')
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return
            setMessage('No se pudo compartir la imagen')
        }
    }

    return (
        <div className="wrapped">
            <Link href={`/estadisticas?year=${data.year}`} className="wrapped__back">
                <ArrowLeft size={14} aria-hidden /> Estadísticas de {data.year}
            </Link>

            <header className="wrapped-hero">
                <p className="wrapped-hero__kicker">Tu resumen del año</p>
                <h1 className="wrapped-hero__year">{data.year}</h1>
                <p className="wrapped-hero__lead">
                    {data.activeGames} {data.activeGames === 1 ? 'juego' : 'juegos'} con actividad
                    {data.topGenre ? `, sobre todo ${data.topGenre.toLowerCase()}` : ''}. Esto es lo que dio de sí.
                </p>
            </header>

            <Block title="Horas jugadas">
                <p className="wrapped-big">
                    {approx}
                    {NUMBER.format(hours)} h
                </p>
                <p className="wrapped-note">
                    {data.hoursMeasured
                        ? 'Medidas día a día con tu historial de horas.'
                        : 'Aproximadas: las horas de cada juego, repartidas entre los años de sus logros.'}
                </p>
            </Block>

            {best && (
                <Block title="Tu juego del año" className="wrapped-best">
                    <div className="wrapped-best__row">
                        <span className="wrapped-best__cover">
                            <GameCover appid={best.appid} name={best.name} headerImage={best.header_image} variant="header" sizes="240px" />
                        </span>
                        <div className="wrapped-best__text">
                            <Link href={`/juego/${best.appid}`} className="wrapped-best__name">
                                {best.name ?? `App ${best.appid}`}
                            </Link>
                            <p className="wrapped-note">
                                {approx}
                                {Math.round(best.minutes / 60)} h · el {data.minutes ? Math.round((best.minutes / data.minutes) * 100) : 0} % de tu año
                            </p>
                        </div>
                    </div>
                </Block>
            )}

            {rest.length > 0 && (
                <Block title="Tu top 5">
                    <ol className="wrapped-top">
                        {data.top.map((g, i) => (
                            <li key={g.appid}>
                                <span className="wrapped-top__pos">{i + 1}</span>
                                <span className="wrapped-top__cover">
                                    <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="96px" />
                                </span>
                                <span className="wrapped-top__main">
                                    <span className="wrapped-top__label">
                                        <Link href={`/juego/${g.appid}`} className="wrapped-top__name">
                                            {g.name ?? `App ${g.appid}`}
                                        </Link>
                                        <span className="wrapped-top__hours">
                                            {approx}
                                            {Math.round(g.minutes / 60)} h
                                        </span>
                                    </span>
                                    <span className="wrapped-top__bar" style={{ width: `${(g.minutes / best.minutes) * 100}%` }} aria-hidden />
                                </span>
                            </li>
                        ))}
                    </ol>
                </Block>
            )}

            {data.rarest && (
                <Block title="Tu logro más raro">
                    <div className="wrapped-rare" style={rareTier ? ({ '--c': rarityColor(rareTier) } as CSSVars) : undefined}>
                        <span className="wrapped-rare__icon">
                            {data.rarest.icon ? (
                                // eslint-disable-next-line @next/next/no-img-element -- icono de 64 px del CDN de Steam
                                <img src={achievementIconUrl(data.rarest.icon) ?? undefined} alt="" width={56} height={56} />
                            ) : (
                                <Trophy size={28} aria-hidden />
                            )}
                        </span>
                        <div className="wrapped-rare__text">
                            <p className="wrapped-rare__name">{data.rarest.display_name ?? 'Logro'}</p>
                            {data.rarest.game && <p className="wrapped-note">{data.rarest.game}</p>}
                        </div>
                    </div>
                    <p className="wrapped-rare__pct">
                        Solo el <b>{formatPercent(data.rarest.global_percent)}</b> de los jugadores lo tiene
                        {rareTier && (
                            <span className="wrapped-rare__tier" style={{ '--c': rarityColor(rareTier) } as CSSVars}>
                                {RARITY_TIER_LABELS[rareTier]}
                            </span>
                        )}
                    </p>
                </Block>
            )}

            <div className="wrapped-pair">
                <Block title="Tu mejor racha">
                    <p className="wrapped-big wrapped-big--md">
                        {data.streak.length} {data.streak.length === 1 ? 'día' : 'días'}
                    </p>
                    <p className="wrapped-note">
                        {data.streak.length > 0
                            ? `Seguidos con logros o partidas, del ${fmtDay(data.streak.start)} al ${fmtDay(data.streak.end)}.`
                            : 'Sin días con logros o partidas registradas.'}
                    </p>
                </Block>

                <Block title="En números">
                    <dl className="wrapped-numbers">
                        <div>
                            <dt>Logros</dt>
                            <dd>{NUMBER.format(data.unlocks)}</dd>
                        </div>
                        <div>
                            <dt>Completados</dt>
                            <dd>{NUMBER.format(data.completed)}</dd>
                        </div>
                        <div>
                            <dt>Al 100 %</dt>
                            <dd>{NUMBER.format(data.perfect)}</dd>
                        </div>
                    </dl>
                </Block>
            </div>

            <Block title="Compártelo" className="wrapped-share">
                {/* eslint-disable-next-line @next/next/no-img-element -- PNG generado con next/og */}
                <img className="wrapped-share__img" src={imageUrl} alt={`Resumen de ${data.year} en HubGames`} width={1200} height={630} />
                <div className="wrapped-share__actions">
                    <Button onClick={() => void share()}>
                        <Share2 aria-hidden /> Compartir imagen
                    </Button>
                    <Button variant="secondary" asChild>
                        <a href={imageUrl} download={fileName}>
                            <Download aria-hidden /> Descargar
                        </a>
                    </Button>
                </div>
                {message && (
                    <p className="wrapped-note" role="status">
                        {message}
                    </p>
                )}
            </Block>
        </div>
    )
}
