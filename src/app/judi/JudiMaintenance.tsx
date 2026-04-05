import Link from 'next/link'
import { Home, LogIn, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function JudiMaintenance() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100dvh - 160px)' }}>
            <div className="animate-fade-in-up" style={{ maxWidth: 440, width: '100%', padding: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                <Wrench size={24} style={{ color: 'var(--warning)', marginBottom: 12 }} />
                <h1 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 700 }}>JUDI &middot; En mantenimiento</h1>
                <p style={{ color: 'var(--muted)', fontSize: '0.8125rem', lineHeight: 1.6, margin: '0 0 20px' }}>
                    Estamos mejorando el Juego del día. Volveremos en breve con nuevas mejoras.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <Button asChild>
                        <Link href="/" scroll={false}><Home size={15} data-icon="inline-start" aria-hidden />Inicio</Link>
                    </Button>
                    <Button variant="secondary" asChild>
                        <Link href="/login"><LogIn size={15} data-icon="inline-start" aria-hidden />Iniciar sesión</Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
