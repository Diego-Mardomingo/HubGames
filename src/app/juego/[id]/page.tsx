import { getGameDetails, getGameScreenshots } from '@/lib/rawg'
import { createServerClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
import ReviewForm from '@/components/ReviewForm'
import ReviewList from '@/components/ReviewList'

interface PageProps {
    params: Promise<{ id: string }>
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
        <div className="cuerpo">
            <div style={{ marginBottom: '2em' }}>
                <Link href="/" style={{ color: '#00A8E8', fontWeight: 600, textDecoration: 'none' }}>
                    ← Volver al inicio
                </Link>
            </div>

            <h1 style={{ color: '#00171F', marginBottom: '1em' }}>{gameData.name}</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2em', marginBottom: '2em' }}>
                <div>
                    {gameData.background_image && (
                        <Image
                            src={gameData.background_image}
                            alt={gameData.name}
                            width={600}
                            height={400}
                            style={{ width: '100%', height: 'auto', borderRadius: '5px' }}
                        />
                    )}
                </div>

                <div>
                    <div style={{ marginBottom: '1em' }}>
                        <strong>Fecha de lanzamiento:</strong> {gameData.released}
                    </div>
                    <div style={{ marginBottom: '1em' }}>
                        <strong>Desarrollador:</strong>{' '}
                        {gameData.developers?.map((d: any) => d.name).join(', ') || 'N/A'}
                    </div>
                    <div style={{ marginBottom: '1em' }}>
                        <strong>Géneros:</strong>{' '}
                        {gameData.genres?.map((g: any) => g.name).join(', ') || 'N/A'}
                    </div>
                    <div style={{ marginBottom: '1em' }}>
                        <strong>Plataformas:</strong>{' '}
                        {gameData.platforms?.map((p: any) => p.platform.name).join(', ') || 'N/A'}
                    </div>
                    {gameData.metacritic && (
                        <div style={{ marginBottom: '1em' }}>
                            <strong>Metacritic:</strong>{' '}
                            <span
                                style={{
                                    padding: '0.25em 0.5em',
                                    borderRadius: '5px',
                                    backgroundColor:
                                        gameData.metacritic > 80
                                            ? '#00FF00'
                                            : gameData.metacritic > 50
                                                ? 'rgb(255, 167, 4)'
                                                : '#FF0000',
                                    color: '#00171F',
                                    fontWeight: 700,
                                }}
                            >
                                {gameData.metacritic}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {gameData.description_raw && (
                <div style={{ marginBottom: '2em' }}>
                    <h2 style={{ color: '#00171F', marginBottom: '0.5em' }}>Descripción</h2>
                    <p style={{ lineHeight: '1.6' }}>{gameData.description_raw}</p>
                </div>
            )}

            {screenshotsData.results && screenshotsData.results.length > 0 && (
                <div style={{ marginBottom: '2em' }}>
                    <h2 style={{ color: '#00171F', marginBottom: '0.5em' }}>Capturas</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1em' }}>
                        {screenshotsData.results.slice(0, 6).map((screenshot: any, index: number) => (
                            <Image
                                key={index}
                                src={screenshot.image}
                                alt={`Screenshot ${index + 1}`}
                                width={300}
                                height={200}
                                style={{ width: '100%', height: 'auto', borderRadius: '5px' }}
                            />
                        ))}
                    </div>
                </div>
            )}

            <div style={{ marginTop: '3em' }}>
                <h2 style={{ color: '#00171F', marginBottom: '1em' }}>Reseñas</h2>

                {user && <ReviewForm gameId={gameId} userId={user.id} />}

                <ReviewList gameId={gameId} />
            </div>
        </div>
    )
}
