'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import type Hls from 'hls.js'
import type { Screenshot, Trailer } from '@/lib/steam-text'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

/**
 * Imagen grande de la ficha: el arte "hero" de la biblioteca de Steam (1920×620, sin logo) y, si no existe, la
 * cabecera de la tienda. Sin imagen no se pinta nada: el título va debajo, sobre la superficie.
 */
export function HeroImage({ appid, headerImage }: { appid: number; headerImage: string | null }) {
    const sources = [`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`, headerImage].filter(
        (s): s is string => !!s,
    )
    const [index, setIndex] = useState(0)
    const src = sources[index]
    if (!src) return null
    return (
        <span className={`juego__hero${index === 0 ? '' : ' juego__hero--header'}`}>
            <Image key={src} src={src} alt="" fill sizes="(max-width: 1100px) 100vw, 1040px" priority onError={() => setIndex((i) => i + 1)} />
        </span>
    )
}

/** Capturas en miniatura; al pulsar, se abren a tamaño completo y se pasan con las flechas. */
export function Screenshots({ screenshots, name }: { screenshots: Screenshot[]; name: string }) {
    const [open, setOpen] = useState<number | null>(null)
    const count = screenshots.length
    const go = (delta: number) => setOpen((i) => (i === null ? i : (i + delta + count) % count))

    function onKey(e: KeyboardEvent) {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
    }

    return (
        <>
            <ul className="juego-shots">
                {screenshots.map((s, i) => (
                    <li key={s.full}>
                        <button type="button" onClick={() => setOpen(i)} aria-label={`Ver captura ${i + 1} de ${count}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- Steam ya sirve la miniatura a 600 px */}
                            <img src={s.thumb} alt="" loading="lazy" />
                        </button>
                    </li>
                ))}
            </ul>
            <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
                <DialogContent className="juego-lightbox" onKeyDown={onKey} aria-describedby={undefined}>
                    <DialogTitle className="sr-only">
                        {name}: captura {(open ?? 0) + 1} de {count}
                    </DialogTitle>
                    {open !== null && (
                        <>
                            {/* eslint-disable-next-line @next/next/no-img-element -- imagen a tamaño completo del CDN de Steam */}
                            <img src={screenshots[open].full} alt="" />
                            {count > 1 && (
                                <div className="juego-lightbox__nav">
                                    <button type="button" onClick={() => go(-1)} aria-label="Anterior">
                                        <ChevronLeft aria-hidden />
                                    </button>
                                    <span>
                                        {open + 1} / {count}
                                    </span>
                                    <button type="button" onClick={() => go(1)} aria-label="Siguiente">
                                        <ChevronRight aria-hidden />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}

/** Tráileres: póster hasta que se pulsa. Steam sirve HLS; fuera de Safari se carga hls.js solo en ese momento. */
export function Trailers({ trailers, storeUrl }: { trailers: Trailer[]; storeUrl: string }) {
    const [current, setCurrent] = useState(0)
    const [playing, setPlaying] = useState(false)
    const trailer = trailers[current]

    return (
        <div className="juego-trailer">
            <div className="juego-trailer__stage">
                {playing ? (
                    <TrailerVideo key={current} trailer={trailer} storeUrl={storeUrl} />
                ) : (
                    <button type="button" className="juego-trailer__poster" onClick={() => setPlaying(true)} aria-label={`Reproducir ${trailer.name}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- póster del CDN de Steam */}
                        {trailer.poster && <img src={trailer.poster} alt="" />}
                        <span className="juego-trailer__play">
                            <Play aria-hidden />
                        </span>
                    </button>
                )}
            </div>
            {trailers.length > 1 && (
                <ul className="juego-trailer__list">
                    {trailers.map((t, i) => (
                        <li key={`${t.name}-${i}`}>
                            <button
                                type="button"
                                className={i === current ? 'is-active' : ''}
                                onClick={() => {
                                    setCurrent(i)
                                    setPlaying(true)
                                }}
                            >
                                {t.name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

function TrailerVideo({ trailer, storeUrl }: { trailer: Trailer; storeUrl: string }) {
    const ref = useRef<HTMLVideoElement>(null)
    const [failed, setFailed] = useState(false)
    const direct = trailer.mp4 || trailer.webm

    useEffect(() => {
        const video = ref.current
        if (!video || direct || !trailer.hls) return
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = trailer.hls
            video.play().catch(() => {})
            return
        }
        let hls: Hls | null = null
        let cancelled = false
        import('hls.js').then(({ default: HlsLib }) => {
            if (cancelled) return
            if (!HlsLib.isSupported()) {
                setFailed(true)
                return
            }
            hls = new HlsLib()
            hls.on(HlsLib.Events.ERROR, (_, data) => {
                if (data.fatal) setFailed(true)
            })
            hls.loadSource(trailer.hls!)
            hls.attachMedia(video)
            video.play().catch(() => {})
        })
        return () => {
            cancelled = true
            hls?.destroy()
        }
    }, [trailer, direct])

    if (failed) {
        return (
            <p className="juego-trailer__error">
                No se puede reproducir aquí.{' '}
                <a href={storeUrl} target="_blank" rel="noreferrer">
                    Verlo en Steam
                </a>
            </p>
        )
    }
    return (
        <video ref={ref} controls autoPlay={!!direct} playsInline poster={trailer.poster ?? undefined} onError={() => direct && setFailed(true)}>
            {trailer.webm && <source src={trailer.webm} type="video/webm" />}
            {trailer.mp4 && <source src={trailer.mp4} type="video/mp4" />}
        </video>
    )
}
