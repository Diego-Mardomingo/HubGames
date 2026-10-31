import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, ExternalLink, Hourglass, ThumbsUp } from 'lucide-react'
import { getCatalogGame, getHltb, parseAppid, type CatalogGame } from '@/lib/catalog'
import { gameDuration } from '@/lib/library'
import { formatHours } from '@/lib/format'
import { metacriticScore, steamReviewScore } from '@/lib/scores'
import { htmlToParagraphs, parseGenres, parseScreenshots, parseTrailers } from '@/lib/steam-text'
import { Button } from '@/components/ui/button'
import GamePanel from './GamePanel'
import GameAchievementsSummary from './GameAchievementsSummary'
import { GameHeaderActions, GameProvider } from './GameContext'
import { storePrice } from '@/lib/store-price'
import { jsonLd, SITE_NAME, SITE_URL } from '@/lib/seo'
import { HeroImage, Screenshots, Trailers } from './Media'
import '@/styles/lists.css'
import './juego.css'

interface Props {
    params: Promise<{ appid: string }>
}

/** Texto plano de la descripción corta de Steam, recortado a ~160 caracteres para buscadores y tarjetas. */
function metaDescription(game: CatalogGame): string {
    const text = htmlToParagraphs(game.short_description).join(' ').trim()
    if (!text) return `${game.name}: logros, duración, notas, tráiler y capturas en HubGames.`
    return text.length <= 160 ? text : `${text.slice(0, 157).replace(/\s+\S*$/, '')}…`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const appid = parseAppid((await params).appid)
    const game = appid ? await getCatalogGame(appid) : null
    if (!game) return { title: 'Juego no encontrado', robots: { index: false, follow: true } }
    const description = metaDescription(game)
    const url = `/juego/${game.steam_appid}`
    const images = game.header_image ? [{ url: game.header_image, width: 460, height: 215, alt: game.name }] : undefined
    return {
        title: game.name,
        description,
        alternates: { canonical: url },
        // openGraph y twitter sustituyen enteros a los del layout raíz: van completos (sin portada, la de HubGames).
        openGraph: {
            type: 'website',
            locale: 'es_ES',
            siteName: SITE_NAME,
            url,
            title: game.name,
            description,
            ...(images && { images }),
        },
        twitter: { card: 'summary_large_image', title: game.name, description, ...(images && { images: [images[0].url] }) },
    }
}

/** Datos estructurados del juego (schema.org/VideoGame). Sin `aggregateRating`: no guardamos el número de reseñas. */
function gameJsonLd(game: CatalogGame, genres: string[], description: string): string {
    const org = (name: string) => ({ '@type': 'Organization', name })
    return jsonLd({
        '@type': 'VideoGame',
        '@id': `${SITE_URL}/juego/${game.steam_appid}#game`,
        name: game.name,
        url: `${SITE_URL}/juego/${game.steam_appid}`,
        description,
        ...(game.header_image && { image: game.header_image }),
        ...(genres.length > 0 && { genre: genres }),
        gamePlatform: 'PC',
        operatingSystem: 'Windows',
        applicationCategory: 'Game',
        ...(game.release_date && { datePublished: game.release_date }),
        ...(game.developers?.length && { author: game.developers.map(org) }),
        ...(game.publishers?.length && { publisher: game.publishers.map(org) }),
        sameAs: `https://store.steampowered.com/app/${game.steam_appid}/`,
    })
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
    const metacritic = game.metacritic_score !== null ? metacriticScore(game.metacritic_score) : null
    const reviews = game.steamspy_userscore !== null ? steamReviewScore(game.steamspy_userscore) : null

    return (
        <GameProvider appid={appid} name={game.name} store={storePrice(game.price_overview)} isFree={game.is_free ?? false} comingSoon={game.coming_soon ?? false}>
            <div className="juego">
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: gameJsonLd(game, genres, metaDescription(game)) }} />
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
                            <div className="juego__actions">
                                <GameHeaderActions />
                                <Button variant="secondary" asChild>
                                    <a href={storeUrl} target="_blank" rel="noreferrer">
                                        <ExternalLink aria-hidden /> Ver en Steam
                                    </a>
                                </Button>
                            </div>
                        </div>
                        <ul className="juego__facts">
                            {(game.release_date_text || game.release_date) && (
                                <li className="juego-fact">
                                    <CalendarDays size={14} aria-hidden />
                                    {game.coming_soon ? 'Próximamente: ' : ''}
                                    {game.release_date_text ?? game.release_date}
                                </li>
                            )}
                            {metacritic && (
                                <li className={`juego-fact juego-fact--score sc-${metacritic.tier}`}>
                                    <span className="juego-fact__num hg-tint">{game.metacritic_score}</span>
                                    {game.metacritic_url ? (
                                        <a className="juego__metacritic" href={game.metacritic_url} target="_blank" rel="noreferrer">
                                            <b>Metacritic</b> · {metacritic.label}
                                        </a>
                                    ) : (
                                        <span>
                                            <b>Metacritic</b> · {metacritic.label}
                                        </span>
                                    )}
                                </li>
                            )}
                            {reviews && (
                                <li className={`juego-fact juego-fact--score sc-${reviews.tier}`} title="Reseñas positivas en Steam (SteamSpy)">
                                    <span className="juego-fact__num hg-tint">
                                        <ThumbsUp size={14} aria-hidden />
                                    </span>
                                    <span>
                                        <b>{game.steamspy_userscore} %</b> · {reviews.label}
                                    </span>
                                </li>
                            )}
                            {duration.main !== null && (
                                <li className="juego-fact" title="Duración de la historia">
                                    <Hourglass size={14} aria-hidden /> Historia <b>{formatHours(duration.main)}</b>
                                </li>
                            )}
                            {game.is_free && <li className="juego-fact">Gratis</li>}
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

                <GamePanel duration={duration} achievementsTotal={game.achievements_total} storeUrl={storeUrl} />

                <GameAchievementsSummary catalogTotal={game.achievements_total} />

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
        </GameProvider>
    )
}
