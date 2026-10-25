import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, ThumbsUp } from 'lucide-react'
import { getCatalogGame, getHltb, parseAppid } from '@/lib/catalog'
import { gameDuration } from '@/lib/library'
import { htmlToParagraphs, parseGenres, parseScreenshots, parseTrailers } from '@/lib/steam-text'
import { Button } from '@/components/ui/button'
import GamePanel from './GamePanel'
import { HeroImage, Screenshots, Trailers } from './Media'
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
    const [game, hltb] = await Promise.all([getCatalogGame(appid), getHltb(appid)])
    if (!game) notFound()
    const duration = gameDuration({
        hltb_main: hltb?.main ?? null,
        hltb_main_extra: hltb?.main_extra ?? null,
        hltb_completionist: hltb?.completionist ?? null,
        steamspy_median_forever: game.steamspy_median_forever,
    })

    const genres = parseGenres(game.genres)
    const screenshots = parseScreenshots(game.screenshots)
    const trailers = parseTrailers(game.movies)
    const about = htmlToParagraphs(game.about_the_game)
    const studios = [...new Set([...(game.developers ?? []), ...(game.publishers ?? [])])]
    const storeUrl = `https://store.steampowered.com/app/${appid}/`

    return (
        <div className="juego">
            <Link href="/biblioteca" className="juego__back">
                <ArrowLeft size={14} aria-hidden /> Biblioteca
            </Link>

            <header className="juego__head">
                <HeroImage appid={appid} headerImage={game.header_image} />
                <div className="juego__heading">
                    <div className="juego__title-row">
                        <div className="juego__title">
                            <h1 className="page-title">{game.name}</h1>
                            {studios.length > 0 && <p className="juego__studios">{studios.join(' · ')}</p>}
                        </div>
                        <Button variant="secondary" asChild>
                            <a href={storeUrl} target="_blank" rel="noreferrer">
                                <ExternalLink aria-hidden /> Ver en Steam
                            </a>
                        </Button>
                    </div>
                    <ul className="juego__facts">
                        {(game.release_date_text || game.release_date) && (
                            <li>
                                {game.coming_soon ? 'Próximamente: ' : ''}
                                {game.release_date_text ?? game.release_date}
                            </li>
                        )}
                        {game.metacritic_score !== null && (
                            <li>
                                {game.metacritic_url ? (
                                    <a className="juego__metacritic" href={game.metacritic_url} target="_blank" rel="noreferrer">
                                        Metacritic <b>{game.metacritic_score}</b>
                                    </a>
                                ) : (
                                    <span className="juego__metacritic">
                                        Metacritic <b>{game.metacritic_score}</b>
                                    </span>
                                )}
                            </li>
                        )}
                        {game.steamspy_userscore !== null && (
                            <li title="Reseñas positivas en Steam (SteamSpy)">
                                <ThumbsUp size={13} aria-hidden /> {game.steamspy_userscore} % positivas
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
                </div>
            </header>

            <GamePanel
                appid={appid}
                name={game.name}
                duration={duration}
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
