'use client'

import ErrorView from '@/components/ErrorView'

/** Fallo al pintar una página: dentro de la app (barra lateral a la vista), con «Reintentar» y el código del error. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
    return <ErrorView error={error} retry={retry} />
}
