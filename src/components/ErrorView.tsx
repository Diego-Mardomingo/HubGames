'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import StatusPage from '@/components/StatusPage'
import { CopyCode } from '@/components/StatusExtras'

/**
 * Cuándo se pulsó «Reintentar» por última vez. Si el fallo se repite, Next vuelve a montar la página de error: a nivel de
 * módulo sobrevive y así sabemos que es un «sigue fallando» y no un fallo nuevo.
 */
let retriedAt = 0
const AGAIN_WINDOW_MS = 15_000
/** Si `retry()` no termina (ni bien ni mal), el botón deja de girar. */
const BUSY_TIMEOUT_MS = 10_000

const hhmm = (d: Date) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
const stamp = (d: Date) => `${d.toLocaleDateString('sv-SE')} ${hhmm(d)}`

/**
 * Página de error (`error.tsx` dentro de la app y `global-error.tsx` sin layout). «Reintentar» llama a `retry()` (vuelve
 * a pedir los datos y a pintar); si vuelve a fallar, la tarjeta se sacude y ofrece recargar la página entera. Debajo, el
 * `digest` de Next (el mismo de los logs de Vercel) para copiar; los fallos del navegador no lo tienen y se enseña la ruta y
 * la hora. El mensaje y la traza, solo en desarrollo.
 */
export default function ErrorView({
    error,
    retry,
    global = false,
}: {
    error: Error & { digest?: string }
    retry: () => void
    global?: boolean
}) {
    const pathname = usePathname() ?? '/'
    const [at] = useState(() => new Date())
    const [busy, setBusy] = useState(false)
    // Se acaba de reintentar y Next ha vuelto a montar la página de error: sigue fallando
    const [again, setAgain] = useState(() => retriedAt !== 0 && Date.now() - retriedAt < AGAIN_WINDOW_MS)
    // O la misma página de error recibe el fallo nuevo mientras el botón gira
    const [seen, setSeen] = useState(error)
    if (seen !== error) {
        setSeen(error)
        if (busy) {
            setBusy(false)
            setAgain(true)
        }
    }

    useEffect(() => {
        console.error(error)
        retriedAt = 0
    }, [error])

    useEffect(() => {
        if (!busy) return
        const t = setTimeout(() => setBusy(false), BUSY_TIMEOUT_MS)
        return () => clearTimeout(t)
    }, [busy])

    function onRetry() {
        retriedAt = Date.now()
        setBusy(true)
        retry()
    }

    const digest = error.digest
    const code = digest
        ? { label: 'Código del error', value: digest, copyText: `digest ${digest} · ${pathname} · ${stamp(at)}` }
        : {
              label: 'Ruta y hora',
              value: `${pathname} · hoy a las ${hhmm(at)}`,
              copyText: `${pathname} · ${stamp(at)} · ${typeof navigator === 'undefined' ? '' : navigator.userAgent}`,
          }

    const text = global
        ? 'HubGames no ha podido arrancar. Prueba otra vez; si se repite, copia el código y avisa: con él se encuentra el fallo en los logs.'
        : digest
          ? 'No es cosa tuya. Prueba otra vez; si se repite, copia el código y avisa: con él se encuentra el fallo en los logs.'
          : 'Algo se ha roto al pintar esta página en tu navegador. Prueba otra vez; si se repite, copia estos datos y avisa.'

    const home = global ? (
        // Recarga entera a propósito: el router de Next puede ser lo que ha fallado
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a href="/">
            <Home aria-hidden /> Ir a Inicio
        </a>
    ) : (
        <Link href="/">
            <Home aria-hidden /> Ir a Inicio
        </Link>
    )

    return (
        <StatusPage
            wrap={!global}
            className={again ? 'hg-shake' : undefined}
            tone="danger"
            chipIcon={<TriangleAlert aria-hidden />}
            chip="Algo ha fallado"
            title={global ? 'No se ha podido abrir HubGames' : 'No se ha podido cargar esta página'}
            text={text}
            actions={
                <>
                    <Button onClick={onRetry} loading={busy}>
                        {!busy && <RotateCw aria-hidden />} {busy ? 'Reintentando…' : 'Reintentar'}
                    </Button>
                    <Button variant="secondary" asChild>
                        {home}
                    </Button>
                </>
            }
            footer={
                <>
                    {again && (
                        <p className="hg-status-again" role="alert">
                            <TriangleAlert aria-hidden />
                            <span>
                                Sigue fallando. Prueba a{' '}
                                <button type="button" onClick={() => window.location.reload()}>
                                    recargar la página
                                </button>{' '}
                                o vuelve en un rato.
                            </span>
                        </p>
                    )}
                    <CopyCode {...code} />
                    {process.env.NODE_ENV === 'development' && (
                        <details className="hg-status-dev" open>
                            <summary>Detalle (solo en desarrollo)</summary>
                            <pre>{error.stack ?? error.message}</pre>
                        </details>
                    )}
                </>
            }
        />
    )
}
