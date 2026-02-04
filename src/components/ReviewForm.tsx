'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ReviewFormProps {
    gameId: number
    userId: string
}

export default function ReviewForm({ gameId, userId }: ReviewFormProps) {
    const router = useRouter()
    const [encabezado, setEncabezado] = useState('')
    const [contenido, setContenido] = useState('')
    const [valoracion, setValoracion] = useState(5)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const { error: insertError } = await supabase.from('hubgames_reviews').insert({
                id_usuario: userId,
                encabezado,
                contenido,
                valoracion,
                id_videojuego: gameId,
                fecha_creacion: new Date().toISOString(),
            })

            if (insertError) {
                setError('Error al crear la reseña')
                console.error(insertError)
                return
            }

            // Reset form
            setEncabezado('')
            setContenido('')
            setValoracion(5)

            // Refresh to show new review
            router.refresh()
        } catch (err) {
            setError('Error al crear la reseña')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                padding: '1.5em',
                borderRadius: '5px',
                marginBottom: '2em',
            }}
        >
            <h3 style={{ marginBottom: '1em', color: '#00171F' }}>Escribe una reseña</h3>

            <div style={{ marginBottom: '1em' }}>
                <input
                    type="text"
                    placeholder="Título de la reseña"
                    value={encabezado}
                    onChange={(e) => setEncabezado(e.target.value)}
                    required
                    style={{
                        width: '100%',
                        padding: '0.75em',
                        borderRadius: '5px',
                        border: '2px solid #00171F',
                        fontSize: '1em',
                    }}
                />
            </div>

            <div style={{ marginBottom: '1em' }}>
                <textarea
                    placeholder="Contenido de la reseña"
                    value={contenido}
                    onChange={(e) => setContenido(e.target.value)}
                    required
                    rows={5}
                    style={{
                        width: '100%',
                        padding: '0.75em',
                        borderRadius: '5px',
                        border: '2px solid #00171F',
                        fontSize: '1em',
                        fontFamily: 'Montserrat, sans-serif',
                    }}
                />
            </div>

            <div style={{ marginBottom: '1em', display: 'flex', alignItems: 'center', gap: '1em' }}>
                <label style={{ fontWeight: 600 }}>Valoración:</label>
                <select
                    value={valoracion}
                    onChange={(e) => setValoracion(parseInt(e.target.value))}
                    style={{
                        padding: '0.5em',
                        borderRadius: '5px',
                        border: '2px solid #00171F',
                        fontSize: '1em',
                    }}
                >
                    {[1, 2, 3, 4, 5].map((val) => (
                        <option key={val} value={val}>
                            {val} estrella{val > 1 ? 's' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {error && <div style={{ color: '#FF0000', marginBottom: '1em' }}>{error}</div>}

            <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Publicando...' : 'Publicar reseña'}
            </button>
        </form>
    )
}
