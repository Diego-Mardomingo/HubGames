import { createServerClient } from '@/lib/supabase/server'

interface ReviewListProps {
    gameId: number
}

export default async function ReviewList({ gameId }: ReviewListProps) {
    const supabase = await createServerClient()

    const { data: reviews } = await supabase
        .from('hubgames_reviews')
        .select(`
      *,
      hubgames_usuarios (username)
    `)
        .eq('id_videojuego', gameId)
        .order('fecha_creacion', { ascending: false })

    if (!reviews || reviews.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '2em', color: '#00171F' }}>
                No hay reseñas aún. ¡Sé el primero en escribir una!
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5em' }}>
            {reviews.map((review: any) => (
                <div
                    key={review.id}
                    style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        padding: '1.5em',
                        borderRadius: '5px',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5em' }}>
                        <h4 style={{ color: '#00171F', margin: 0 }}>{review.encabezado}</h4>
                        <div style={{ display: 'flex', gap: '0.25em' }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                                <i
                                    key={i}
                                    className={`fa-solid fa-star`}
                                    style={{ color: i < review.valoracion ? '#FFD700' : '#CCC' }}
                                ></i>
                            ))}
                        </div>
                    </div>

                    <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '1em' }}>
                        Por <strong>{review.hubgames_usuarios?.username || 'Usuario'}</strong> •{' '}
                        {new Date(review.fecha_creacion).toLocaleDateString('es-ES')}
                    </div>

                    <p style={{ lineHeight: '1.6', color: '#00171F' }}>{review.contenido}</p>
                </div>
            ))}
        </div>
    )
}
