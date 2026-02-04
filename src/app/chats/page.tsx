import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ChatForm from '@/components/ChatForm'

export default async function ChatsPage() {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: chats } = await supabase
        .from('hubgames_chats')
        .select(`
      *,
      hubgames_usuarios (username)
    `)
        .order('fecha_creacion', { ascending: false })

    return (
        <div className="cuerpo">
            <h1 style={{ color: '#00171F', marginBottom: '1em' }}>Chats de la Comunidad</h1>

            {user && <ChatForm userId={user.id} />}

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
                    para crear un nuevo chat.
                </div>
            )}

            {!chats || chats.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#00171F', padding: '2em' }}>
                    No hay chats aún. ¡Sé el primero en crear uno!
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5em' }}>
                    {chats.map((chat: any) => (
                        <Link
                            key={chat.id}
                            href={`/chats/${chat.id}`}
                            style={{
                                textDecoration: 'none',
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                padding: '1.5em',
                                borderRadius: '5px',
                                border: '2px solid #00171F',
                                transition: 'transform 0.2s',
                            }}
                            className="chat-card"
                        >
                            <h3 style={{ color: '#00171F', marginBottom: '0.5em' }}>{chat.titulo}</h3>
                            <p style={{ color: '#666', marginBottom: '0.5em', lineHeight: '1.6' }}>
                                {chat.contenido.substring(0, 200)}
                                {chat.contenido.length > 200 ? '...' : ''}
                            </p>
                            <div style={{ fontSize: '0.9em', color: '#00A8E8' }}>
                                Por <strong>{chat.hubgames_usuarios?.username || 'Usuario'}</strong> •{' '}
                                {new Date(chat.fecha_creacion).toLocaleDateString('es-ES')}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
