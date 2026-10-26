import Loader from '@/components/Loader'

/**
 * Las páginas que se pintan en el servidor (inicio, ficha de juego...) esperan a sus datos antes de responder. Sin esta
 * frontera, Next se queda en la página anterior hasta tenerlos; con ella, navega al momento y enseña el Loader.
 */
export default function Loading() {
    return <Loader />
}
