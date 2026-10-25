'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Award, Clock, Download, Flame, Gem, Share2, Sparkles, Trophy } from 'lucide-react'
import type { Wrapped as WrappedData } from '@/lib/stats'
import { formatPercent } from '@/lib/achievements'
import { CountUp } from '@/components/motion'
import { Button } from '@/components/ui/button'
import GameCover from '@/components/tracker/GameCover'

const EASE = [0.22, 1, 0.36, 1] as const
const DAY = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' })

function fmtDay(key: string | null): string {
    if (!key) return ''
    const [y, m, d] = key.split('-').map(Number)
    return DAY.format(new Date(y, m - 1, d, 12))
}

/** Una "diapositiva" que entra al hacer scroll. */
function Slide({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    const reduce = useReducedMotion()
    return (
        <motion.section
            className={`wrapped-slide glass ${className}`}
            initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-15% 0px' }}
            transition={{ duration: 0.7, ease: EASE }}
        >
            {children}
        </motion.section>
    )
}

/** Resumen anual (#33): una historia que se recorre con scroll y una imagen para compartir. */
export default function Wrapped({ data }: { data: WrappedData }) {
    const [message, setMessage] = useState<string | null>(null)
    const hours = Math.round(data.minutes / 60)
    const imageUrl = `/api/estadisticas/resumen/imagen?year=${data.year}`
    const fileName = `hubgames-${data.year}.png`
    const [best, ...rest] = data.top

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
            <Link href={`/estadisticas?year=${data.year}`} className="eyebrow wrapped__back">
                <ArrowLeft size={13} aria-hidden /> Estadísticas de {data.year}
            </Link>

            <motion.header
                className="wrapped-hero"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE }}
            >
                <span className="eyebrow">
                    <Sparkles size={13} aria-hidden /> Tu resumen
                </span>
                <h1 className="wrapped-hero__year text-gradient">{data.year}</h1>
                <p className="wrapped-hero__lead">
                    {data.activeGames} {data.activeGames === 1 ? 'juego' : 'juegos'} con actividad
                    {data.topGenre ? `, sobre todo ${data.topGenre.toLowerCase()}` : ''}. Esto es lo que dio de sí.
                </p>
            </motion.header>

            <Slide className="wrapped-slide--hours">
                <Clock size={22} aria-hidden className="wrapped-slide__icon" />
                <p className="wrapped-slide__kicker">Horas jugadas</p>
                <p className="wrapped-big">
                    {data.hoursMeasured ? '' : '≈ '}
                    <CountUp value={hours} duration={1.6} /> h
                </p>
                <p className="wrapped-slide__note">
                    {data.hoursMeasured
                        ? 'Medidas día a día con tu historial de horas.'
                        : 'Aproximadas: las horas de cada juego, repartidas entre los años de sus logros.'}
                </p>
            </Slide>

            {best && (
                <Slide className="wrapped-slide--best">
                    <p className="wrapped-slide__kicker">Tu juego del año</p>
                    <Link href={`/juego/${best.appid}`} className="wrapped-best__cover">
                        <GameCover appid={best.appid} name={best.name} headerImage={best.header_image} variant="header" sizes="(max-width: 640px) 90vw, 560px" />
                    </Link>
                    <p className="wrapped-best__name">{best.name ?? `App ${best.appid}`}</p>
                    <p className="wrapped-slide__note">
                        {data.hoursMeasured ? '' : '≈ '}
                        {Math.round(best.minutes / 60)} h · el {data.minutes ? Math.round((best.minutes / data.minutes) * 100) : 0} % de tu año
                    </p>
                </Slide>
            )}

            {rest.length > 0 && (
                <Slide>
                    <Trophy size={22} aria-hidden className="wrapped-slide__icon" />
                    <p className="wrapped-slide__kicker">Tu top 5</p>
                    <ol className="wrapped-top">
                        {data.top.map((g, i) => (
                            <motion.li
                                key={g.appid}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, ease: EASE, delay: 0.1 + i * 0.08 }}
                            >
                                <span className="wrapped-top__pos">{i + 1}</span>
                                <span className="wrapped-top__cover">
                                    <GameCover appid={g.appid} name={g.name} headerImage={g.header_image} variant="header" sizes="120px" />
                                </span>
                                <Link href={`/juego/${g.appid}`} className="wrapped-top__name">
                                    {g.name ?? `App ${g.appid}`}
                                </Link>
                                <span className="wrapped-top__hours">{Math.round(g.minutes / 60)} h</span>
                            </motion.li>
                        ))}
                    </ol>
                </Slide>
            )}

            {data.rarest && (
                <Slide className="wrapped-slide--rare">
                    <Gem size={22} aria-hidden className="wrapped-slide__icon" />
                    <p className="wrapped-slide__kicker">Tu logro más raro</p>
                    <div className="wrapped-rare">
                        {data.rarest.icon && (
                            // eslint-disable-next-line @next/next/no-img-element -- icono de 64 px del CDN de Steam
                            <img src={data.rarest.icon} alt="" width={72} height={72} />
                        )}
                        <div>
                            <p className="wrapped-rare__name">{data.rarest.display_name ?? 'Logro'}</p>
                            <p className="wrapped-slide__note">{data.rarest.game}</p>
                        </div>
                    </div>
                    <p className="wrapped-big wrapped-big--sm">
                        Solo el {formatPercent(data.rarest.global_percent)} de los jugadores lo tiene
                    </p>
                </Slide>
            )}

            <Slide>
                <Flame size={22} aria-hidden className="wrapped-slide__icon" />
                <p className="wrapped-slide__kicker">Tu mejor racha</p>
                <p className="wrapped-big">
                    <CountUp value={data.streak.length} /> {data.streak.length === 1 ? 'día' : 'días'}
                </p>
                <p className="wrapped-slide__note">
                    {data.streak.length > 0
                        ? `Seguidos con logros o partidas, del ${fmtDay(data.streak.start)} al ${fmtDay(data.streak.end)}.`
                        : 'Sin días con logros o partidas registradas.'}
                </p>
            </Slide>

            <Slide>
                <Award size={22} aria-hidden className="wrapped-slide__icon" />
                <p className="wrapped-slide__kicker">En números</p>
                <dl className="wrapped-numbers">
                    <div>
                        <dt>Logros</dt>
                        <dd>
                            <CountUp value={data.unlocks} />
                        </dd>
                    </div>
                    <div>
                        <dt>Completados</dt>
                        <dd>
                            <CountUp value={data.completed} />
                        </dd>
                    </div>
                    <div>
                        <dt>Al 100 %</dt>
                        <dd>
                            <CountUp value={data.perfect} />
                        </dd>
                    </div>
                </dl>
            </Slide>

            <Slide className="wrapped-slide--share">
                <p className="wrapped-slide__kicker">Compártelo</p>
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
                    <p className="wrapped-slide__note" role="status">
                        {message}
                    </p>
                )}
            </Slide>
        </div>
    )
}
