import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CommentForm from '@/components/CommentForm'
import CommentList from '@/components/CommentList'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function ChatDetailsPage({ params }: PageProps) {
    const { id } = await params
    const chatId = parseInt(id)

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: chat } = await supabase
        .from('hubgames_chats')
        .select(`
      *,
      hubgames_usuarios (username)
    `)
        .eq('id', chatId)
        .single()

    if (!chat) {
        return (
            <div className="cuerpo">
                <div style={{ textAlign: 'center', color: '#00171F' }}>Chat no encontrado</div>
            </div>
        )
    }

    return (
        <div className="cuerpo">
            <div style={{ marginBottom: '2em' }}>
                <Link href="/chats" style={{ color: '#00A8E8', fontWeight: 600, textDecoration: 'none' }}>
                    ← Volver a chats
                </Link>
            </div>

            <div
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    padding: '2em',
                    borderRadius: '5px',
                    marginBottom: '2em',
                }}
            >
                <h1 style={{ color: '#00171F', marginBottom: '0.5em' }}>{chat.titulo}</h1>
                <div style={{ fontSize: '0.9em', color: '#00A8E8', marginBottom: '1.5em' }}>
                    Por <strong>{chat.hubgames_usuarios?.username || 'Usuario'}</strong> •{' '}
                    {new Date(chat.fecha_creacion).toLocaleDateString('es-ES')}
                </div>
                <p style={{ lineHeight: '1.6', color: '#00171F' }}>{chat.contenido}</p>
            </div>

            <h2 style={{ color: '#00171F', marginBottom: '1em' }}>Comentarios</h2>

            {user && <CommentForm chatId={chatId} userId={user.id} />}

            {!user && (
                <div
                    style={{
                        backgroundColor: 'rgba(255, 167, 4, 0.2)',
                        padding: '1em',
                        borderRadius: '5px',
                        marginBottom: '1.5em',
                        border: '2px solid rgb(255, 167, 4)',
                    }}
                >
                    <Link href="/login" style={{ color: '#00A8E8', fontWeight: 700 }}>
                        Inicia sesión
                    </Link>{' '}
                    para comentar.
                </div>
            )}

            <CommentList chatId={chatId} />
        </div>
    )
}
