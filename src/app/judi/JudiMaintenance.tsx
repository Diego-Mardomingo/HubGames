import Link from 'next/link'
import { Home, LogIn, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function JudiMaintenance() {
    return (
        <div className="maint">
            <div className="maint__card glass">
                <span className="maint__icon" aria-hidden>
                    <Wrench size={22} />
                </span>
                <h1 className="maint__title">JUDI está en mantenimiento</h1>
                <p className="maint__text">Estamos mejorando el juego del día. Vuelve en un rato.</p>
                <div className="maint__actions">
                    <Button asChild>
                        <Link href="/" scroll={false}>
                            <Home size={15} data-icon="inline-start" aria-hidden />
                            Ir a Inicio
                        </Link>
                    </Button>
                    <Button variant="secondary" asChild>
                        <Link href="/login">
                            <LogIn size={15} data-icon="inline-start" aria-hidden />
                            Iniciar sesión
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
