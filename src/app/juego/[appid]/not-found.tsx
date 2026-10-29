import Link from 'next/link'
import { Home, Library, LogIn, Unlink } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import StatusPage from '@/components/StatusPage'
import { GameIdText, SearchGameButton } from '@/components/StatusExtras'

/**
 * 404 de la ficha y de sus logros (`notFound()` si el número no es válido o no está en el catálogo). El buscador es la
 * salida principal; sin sesión (no hay buscador), Iniciar sesión.
 */
export default async function GameNotFound() {
    const supabase = await createServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    return (
        <StatusPage
            tone="neutral"
            chipIcon={<Unlink aria-hidden />}
            chip="Error 404"
            title="No encontramos este juego"
            text={<GameIdText />}
            actions={
                user ? (
                    <>
                        <SearchGameButton variant="default" />
                        <Button variant="secondary" asChild>
                            <Link href="/biblioteca">
                                <Library aria-hidden /> Ir a la Biblioteca
                            </Link>
                        </Button>
                    </>
                ) : (
                    <>
                        <Button asChild>
                            <Link href="/">
                                <Home aria-hidden /> Ir a Inicio
                            </Link>
                        </Button>
                        <Button variant="secondary" asChild>
                            <Link href="/login">
                                <LogIn aria-hidden /> Iniciar sesión
                            </Link>
                        </Button>
                    </>
                )
            }
        />
    )
}
