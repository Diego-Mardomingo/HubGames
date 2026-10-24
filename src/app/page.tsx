import type { Metadata } from 'next'
import Link from 'next/link'
import { Gamepad2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
    title: 'HubGames — Tu centro de control gamer',
    description: 'Tu biblioteca, tus logros y el juego del día en un solo sitio.',
}

/** Placeholder del dashboard hasta #29. */
export default function HomePage() {
    return (
        <div className="maint">
            <div className="maint__card glass animate-fade-in-up">
                <span className="maint__icon">
                    <Gamepad2 size={24} />
                </span>
                <h1 className="page-title" style={{ fontSize: '1.6rem' }}>HubGames</h1>
                <p className="page-subtitle" style={{ margin: '0.5rem auto 1.5rem' }}>
                    Tu centro de control gamer. Muy pronto verás aquí tu biblioteca y tus logros.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button asChild>
                        <Link href="/judi"><Gamepad2 size={15} data-icon="inline-start" aria-hidden />Jugar a JUDI</Link>
                    </Button>
                    <Button variant="secondary" asChild>
                        <Link href="/ranking"><Trophy size={15} data-icon="inline-start" aria-hidden />Ranking</Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
