import { createServerClient } from '@/lib/supabase/server'

interface CommentListProps {
    chatId: number
}

export default async function CommentList({ chatId }: CommentListProps) {
    const supabase = await createServerClient()

    const { data: comments } = await supabase
        .from('hubgames_comentarios')
        .select(`
      *,
      hubgames_usuarios (username)
    `)
        .eq('id_chat', chatId)
        .order('fecha_creacion', { ascending: true })

    if (!comments || comments.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '2em', color: '#00171F' }}>
                No hay comentarios aún. ¡Sé el primero en comentar!
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
            {comments.map((comment: any) => (
                <div
                    key={comment.id}
                    style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        padding: '1em',
                        borderRadius: '5px',
                        border: '1px solid #CCC',
                    }}
                >
                    <div style={{ fontSize: '0.9em', color: '#00A8E8', marginBottom: '0.5em' }}>
                        <strong>{comment.hubgames_usuarios?.username || 'Usuario'}</strong> •{' '}
                        {new Date(comment.fecha_creacion).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </div>
                    <p style={{ lineHeight: '1.6', color: '#00171F', margin: 0 }}>{comment.contenido}</p>
                </div>
            ))}
        </div>
    )
}
