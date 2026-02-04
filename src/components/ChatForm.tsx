'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ChatFormProps {
    userId: string
}

export default function ChatForm({ userId }: ChatFormProps) {
    const router = useRouter()
    const [titulo, setTitulo] = useState('')
    const [contenido, setContenido] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showForm, setShowForm] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const { error: insertError } = await supabase.from('hubgames_chats').insert({
                id_usuario: userId,
                titulo,
                contenido,
                fecha_creacion: new Date().toISOString(),
            })

            if (insertError) {
                setError('Error al crear el chat')
                console.error(insertError)
                return
            }

            // Reset form
            setTitulo('')
            setContenido('')
            setShowForm(false)

            // Refresh to show new chat
            router.refresh()
        } catch (err) {
            setError('Error al crear el chat')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    if (!showForm) {
        return (
            <button
                onClick={() => setShowForm(true)}
                className="btn-secondary"
                style={{ marginBottom: '1.5em' }}
            >
                + Crear nuevo chat
            </button>
        )
    }

    return (
        <form
            onSubmit={handleSubmit}
            style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '1.5em',
                borderRadius: '5px',
                marginBottom: '1.5em',
                border: '2px solid #00171F',
            }}
        >
            <h3 style={{ marginBottom: '1em', color: '#00171F' }}>Crear nuevo chat</h3>

            <div style={{ marginBottom: '1em' }}>
                <input
                    type="text"
                    placeholder="Título del chat"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
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
                    placeholder="Contenido del chat"
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

            {error && <div style={{ color: '#FF0000', marginBottom: '1em' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '1em' }}>
                <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Creando...' : 'Crear chat'}
                </button>
                <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-secondary"
                    style={{ backgroundColor: '#CCC', color: '#00171F' }}
                >
                    Cancelar
                </button>
            </div>
        </form>
    )
}
