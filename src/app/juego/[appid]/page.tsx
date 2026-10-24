import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, ExternalLink, ThumbsUp } from 'lucide-react'
import { getCatalogGame, parseAppid } from '@/lib/catalog'
import { htmlToParagraphs, parseGenres, parseScreenshots, parseTrailers } from '@/lib/steam-text'
import { Reveal } from '@/components/motion'
import GamePanel from './GamePanel'
import { Screenshots, Trailers } from './Media'
import './juego.css'

interface Props {
    params: Promise<{ appid: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const appid = parseAppid((await params).appid)
    const game = appid ? await getCatalogGame(appid) : null
    if (!game) return { title: 'Juego no encontrado' }
    return { title: game.name, description: game.short_description ?? undefined }
}

/** Ficha de un juego (#22): datos de Steam en el servidor y, en el cliente, los tuyos (estado, horas, logros). */
export default async function JuegoPage({ params }: Props) {
    const appid = parseAppid((await params).appid)
    if (!appid) notFound()
    const game = await getCatalogGame(appid)
    if (!game) notFound()

    const genres = parseGenres(game.genres)
    const screenshots = parseScreenshots(game.screenshots)
    const trailers = parseTrailers(game.movies)
    const about = htmlToParagraphs(game.about_the_game)
    const studios = [...new Set([...(game.developers ?? []), ...(game.publishers ?? [])])]
    const storeUrl = `https://store.steampowered.com/app/${appid}/`

    return (
        <div className="juego">
            {game.background_raw && (
                <div className="juego__backdrop" aria-hidden style={{ backgroundImage: `url(${JSON.stringify(game.background_raw)})` }} />
            )}

            <Link href="/biblioteca" className="eyebrow juego__back">
                <ArrowLeft size={13} aria-hidden /> Biblioteca
            </Link>

            <header className="juego__hero">
                {game.header_image && (
                    <span className="juego__header-image">
                        <Image src={game.header_image} alt="" fill sizes="(max-width: 768px) 100vw, 460px" priority />
                    </span>
                )}
                <div className="juego__heading">
                    <Reveal>
                        <h1 className="page-title">{game.name}</h1>
                    </Reveal>
                    {studios.length > 0 && <p className="juego__studios">{studios.join(' · ')}</p>}
                    <ul className="juego__facts">
                        {(game.release_date_text || game.release_date) && (
                            <li>
                                <CalendarDays size={13} aria-hidden />
                                {game.coming_soon ? 'Próximamente: ' : ''}
                                {game.release_date_text ?? game.release_date}
                            </li>
                        )}
                        {game.metacritic_score !== null && (
                            <li>
                                {game.metacritic_url ? (
                                    <a className="juego__metacritic" href={game.metacritic_url} target="_blank" rel="noreferrer">
                                        Metacritic {game.metacritic_score}
                                    </a>
                                ) : (
                                    <span className="juego__metacritic">Metacritic {game.metacritic_score}</span>
                                )}
                            </li>
                        )}
                        {game.steamspy_userscore !== null && (
                            <li title="Reseñas positivas en Steam (SteamSpy)">
                                <ThumbsUp size={13} aria-hidden /> {game.steamspy_userscore}% positivas
                            </li>
                        )}
                        {game.is_free && <li>Gratis</li>}
                    </ul>
                    {genres.length > 0 && (
                        <ul className="juego__genres" aria-label="Géneros">
                            {genres.map((g) => (
                                <li key={g}>{g}</li>
                            ))}
                        </ul>
                    )}
                    <a className="juego__store" href={storeUrl} target="_blank" rel="noreferrer">
                        Ver en la tienda de Steam <ExternalLink size={12} aria-hidden />
                    </a>
                </div>
            </header>

            <GamePanel
                appid={appid}
                name={game.name}
                medianMinutes={game.steamspy_median_forever && game.steamspy_median_forever > 0 ? game.steamspy_median_forever : null}
                storeUrl={storeUrl}
            />

            {trailers.length > 0 && (
                <section className="juego__section" aria-labelledby="juego-trailer">
                    <h2 id="juego-trailer" className="juego__section-title">
                        Tráiler
                    </h2>
                    <Trailers trailers={trailers.slice(0, 4)} storeUrl={storeUrl} />
                </section>
            )}

            {screenshots.length > 0 && (
                <section className="juego__section" aria-labelledby="juego-capturas">
                    <h2 id="juego-capturas" className="juego__section-title">
                        Capturas
                    </h2>
                    <Screenshots screenshots={screenshots} name={game.name} />
                </section>
            )}

            {(game.short_description || about.length > 0) && (
                <section className="juego__section juego__about glass" aria-labelledby="juego-about">
                    <h2 id="juego-about" className="juego__section-title">
                        Acerca del juego
                    </h2>
                    {game.short_description && <p className="juego__lead">{htmlToParagraphs(game.short_description).join(' ')}</p>}
                    {about.length > 0 && (
                        <details>
                            <summary>Descripción completa</summary>
                            {about.map((p, i) => (
                                <p key={i}>{p}</p>
                            ))}
                        </details>
                    )}
                </section>
            )}
        </div>
    )
}
