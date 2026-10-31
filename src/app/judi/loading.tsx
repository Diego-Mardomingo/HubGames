import JudiSkeleton from './JudiSkeleton'

/** Propio: la página comprueba el mantenimiento en el servidor y, sin esto, enseñaría el esqueleto del Inicio. */
export default function Loading() {
    return <JudiSkeleton heading={false} />
}
