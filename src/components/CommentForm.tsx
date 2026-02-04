'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface CommentFormProps {
    chatId: number
    userId: string
}

export default function CommentForm({ chatId, userId }: CommentFormProps) {
    const router = useRouter()
    const [contenido, setContenido] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const { error: insertError } = await supabase.from('hubgames_comentarios').insert({
                id_usuario: userId,
                id_chat: chatId,
                contenido,
                fecha_creacion: new Date().toISOString(),
            })

            if (insertError) {
                setError('Error al crear el comentario')
                console.error(insertError)
                return
            }

            // Reset form
            setContenido('')

            // Refresh to show new comment
            router.refresh()
        } catch (err) {
            setError('Error al crear el comentario')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '1.5em',
                borderRadius: '5px',
                marginBottom: '2em',
                border: '2px solid #00171F',
            }}
        >
            <h3 style={{ marginBottom: '1em', color: '#00171F' }}>Añadir comentario</h3>

            <div style={{ marginBottom: '1em' }}>
                <textarea
                    placeholder="Escribe tu comentario..."
                    value={contenido}
                    onChange={(e) => setContenido(e.target.value)}
                    required
                    rows={4}
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

            {error && <div style={{ color: '#FF0000', marginBottom: '1em' }}>{error}</div>}

            <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Publicando...' : 'Publicar comentario'}
            </button>
        </form>
    )
}
