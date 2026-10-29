import HomeSkeleton from '@/components/dashboard/HomeSkeleton'

/**
 * Las páginas que se pintan en el servidor esperan a sus datos antes de responder. Sin esta frontera, Next se queda en
 * la página anterior hasta tenerlos; con ella, navega al momento y enseña el esqueleto. Solo la usa el Inicio: el resto
 * de páginas de servidor (ficha, logros de un juego, JUDI, estadísticas, resumen) tienen su propio `loading.tsx`.
 */
export default function Loading() {
    return <HomeSkeleton />
}
