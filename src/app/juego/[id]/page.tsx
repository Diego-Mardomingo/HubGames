import { getGameDetails, getGameScreenshots } from '@/lib/rawg'
import { createServerClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
import BackToCatalogButton from '@/components/BackToCatalogButton'
import type { Metadata } from 'next'

interface PageProps {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params
    const game = await getGameDetails(parseInt(id))

    return {
        title: game.name,
        description: `Detalles completos sobre ${game.name}. Lanzado el ${new Date(game.released).toLocaleDateString()}.`,
        openGraph: {
            title: `${game.name} - HubGames`,
            description: `Toda la información sobre ${game.name}`,
            images: [game.background_image],
        },
    }
}

export default async function GameDetailsPage({ params }: PageProps) {
    const { id } = await params
    const gameId = parseInt(id)

    const [gameData, screenshotsData] = await Promise.all([
        getGameDetails(gameId),
        getGameScreenshots(gameId),
    ])

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    return (
        <div className="juego_detalles_wrapper" style={{
            backgroundImage: `linear-gradient(rgba(0, 10, 15, 0.85), rgba(0, 10, 15, 0.95)), url(${gameData.background_image_additional || gameData.background_image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            minHeight: '100vh'
        }}>
            <div className="juego_detalles_content">
                <div style={{ padding: '1em 0' }}>
                    <BackToCatalogButton />
                </div>

                <div className="juego_header_section">
                    <div className="juego_main_info">
                        <h1 className="juego_titulo_premium">{gameData.name}</h1>
                        <div className="juego_badges">
                            {gameData.metacritic && (
                                <div className="badge_metacritic" style={{
                                    backgroundColor: gameData.metacritic > 80 ? '#99ca3b' : gameData.metacritic > 50 ? '#f9a11c' : '#e1011a'
                                }}>
                                    <span>Metascore</span>
                                    <strong>{gameData.metacritic}</strong>
                                </div>
                            )}
                            {gameData.esrb_rating && (
                                <div className="badge_esrb">
                                    {gameData.esrb_rating.name}
                                </div>
                            )}
                            <div className="badge_playtime">
                                <i className="fa-regular fa-clock"></i> {gameData.playtime || 0}h media
                            </div>
                        </div>
                    </div>
                </div>

                <div className="juego_grid_principal">
                    {/* Left Column: Image and Description */}
                    <div className="columna_izq">
                        <div className="hero_image_container">
                            <Image
                                src={gameData.background_image}
                                alt={gameData.name}
                                width={800}
                                height={450}
                                className="hero_image_main"
                                priority
                            />
                        </div>

                        <div className="juego_card_dark description_card">
                            <h2 className="titulo_seccion_cyan"><i className="fa-solid fa-align-left"></i> Sobre este juego</h2>
                            <div className="description_text">
                                {gameData.description_raw}
                            </div>
                        </div>

                        {screenshotsData.results && screenshotsData.results.length > 0 && (
                            <div className="juego_card_dark screenshots_card">
                                <h2 className="titulo_seccion_cyan"><i className="fa-solid fa-images"></i> Galería</h2>
                                <div className="screenshots_grid">
                                    {screenshotsData.results.slice(0, 4).map((s: any) => (
                                        <div key={s.id} className="screenshot_item">
                                            <Image
                                                src={s.image}
                                                alt="Screenshot"
                                                width={400}
                                                height={225}
                                                className="img_rounded"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Info Grid */}
                    <div className="columna_der">
                        <div className="juego_card_dark info_card_compact">
                            <div className="info_row">
                                <span className="label">Lanzamiento</span>
                                <span className="value_highlight">{new Date(gameData.released).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            </div>
                        </div>

                        <div className="juego_card_dark section_card">
                            <h3 className="titulo_subseccion"><i className="fa-solid fa-gamepad"></i> Plataformas</h3>
                            <div className="tag_list">
                                {gameData.platforms?.map((p: any) => (
                                    <span key={p.platform.id} className="tag_item_outline">{p.platform.name}</span>
                                )) || 'No disponible'}
                            </div>
                        </div>

                        <div className="juego_card_dark section_card">
                            <h3 className="titulo_subseccion"><i className="fa-solid fa-tags"></i> Géneros</h3>
                            <div className="tag_list">
                                {gameData.genres?.map((g: any) => (
                                    <span key={g.id} className="tag_item_cyan">{g.name}</span>
                                )) || 'N/A'}
                            </div>
                        </div>

                        <div className="juego_card_dark section_card">
                            <h3 className="titulo_subseccion"><i className="fa-solid fa-code"></i> Desarrollo</h3>
                            <div className="dev_info">
                                <div><small>Desarrollado por:</small> {gameData.developers?.map((d: any) => d.name).join(', ') || 'N/A'}</div>
                                <div style={{ marginTop: '0.5em' }}><small>Editado por:</small> {gameData.publishers?.map((p: any) => p.name).join(', ') || 'N/A'}</div>
                            </div>
                        </div>

                        <div className="juego_card_dark section_card">
                            <h3 className="titulo_subseccion"><i className="fa-solid fa-list-ul"></i> Etiquetas populares</h3>
                            <div className="tag_list_mini">
                                {gameData.tags?.slice(0, 12).map((t: any) => (
                                    <span key={t.id} className="tag_mini">{t.name}</span>
                                )) || 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
