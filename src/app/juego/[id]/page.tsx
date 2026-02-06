import { getGameDetails, getGameScreenshots } from '@/lib/rawg'
import { createServerClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
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
        <div className="juego_detalles_container">
            <div className="juego_name">
                <div style={{ marginBottom: '1em' }}>
                    <Link href="/" style={{ color: '#00A8E8', fontWeight: 600, textDecoration: 'none' }}>
                        ← Volver al inicio
                    </Link>
                </div>
                <h1>{gameData.name}</h1>
            </div>

            <div className="juego_imagen">
                {gameData.background_image && (
                    <Image
                        src={gameData.background_image}
                        alt={gameData.name}
                        width={600}
                        height={400}
                        priority
                    />
                )}
            </div>

            <div className="juego_description">
                <h2>Descripción</h2>
                <p>{gameData.description_raw}</p>
            </div>

            <div className="juego_plataformas">
                <div className="titulo_plataformas">Plataformas</div>
                {gameData.platforms?.map((p: any) => (
                    <div key={p.platform.id} className="plataforma">{p.platform.name}</div>
                )) || <div className="plataforma">N/A</div>}
            </div>

            <div className="juego_generos">
                <div className="titulo_generos">Géneros</div>
                {gameData.genres?.map((g: any) => (
                    <div key={g.id} className="genero">{g.name}</div>
                )) || <div className="genero">N/A</div>}
            </div>

            <div className={`juego_edades ${gameData.esrb_rating ? 'fondo_azul' : 'fondo_transparente'}`} style={{ border: 'none' }}>
                {gameData.esrb_rating?.name || '?'}
            </div>

            <div className="juego_metacritic" style={{
                backgroundColor: gameData.metacritic > 80 ? '#99ca3b' : gameData.metacritic > 50 ? '#f9a11c' : '#e1011a',
                color: '#fff'
            }}>
                {gameData.metacritic || 'N/A'}
            </div>

            <div className="juego_playtime">
                <div>Media de juego</div>
                <div className="horas">{gameData.playtime || 0}h</div>
            </div>

            <div className="juego_fechas">
                <div className="released">
                    <div>Lanzamiento</div>
                    <div>{new Date(gameData.released).toLocaleDateString('es-ES')}</div>
                </div>
            </div>

            <div className="juego_developers">
                <div className="titulo_developers">Desarrollador</div>
                {gameData.developers?.map((d: any) => (
                    <div key={d.id} className="developer">{d.name}</div>
                )) || <div className="developer">N/A</div>}
            </div>

            <div className="juego_publis">
                <div className="titulo_publis">Editor</div>
                {gameData.publishers?.map((p: any) => (
                    <div key={p.id} className="publisher">{p.name}</div>
                )) || <div className="publisher">N/A</div>}
            </div>

            <div className="juego_tags">
                <div className="titulo_tags">Etiquetas</div>
                {gameData.tags?.slice(0, 15).map((t: any) => (
                    <div key={t.id} className="tag">{t.name}</div>
                )) || <div className="tag">N/A</div>}
            </div>
        </div>
    )
}
