import Link from 'next/link'
import { Home, LogIn, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function JudiMaintenance() {
    return (
        <div className="maint">
            <div className="maint__card glass animate-fade-in-up">
                <span className="maint__icon">
                    <Wrench size={24} />
                </span>
                <h1 className="page-title" style={{ fontSize: '1.6rem' }}>JUDI en mantenimiento</h1>
                <p className="page-subtitle" style={{ margin: '0.5rem auto 1.5rem' }}>
                    Estamos mejorando el Juego del día. Volveremos en breve con nuevas mejoras.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
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
