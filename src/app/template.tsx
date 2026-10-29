/**
 * Transición entre rutas: solo un fundido de 200 ms en CSS (`.hg-page` en globals.css). El movimiento lo pone la entrada
 * de cada página (`.hg-enter`). Sin JavaScript: se ve desde el primer pintado, antes de hidratar.
 */
export default function Template({ children }: { children: React.ReactNode }) {
    return <div className="hg-page">{children}</div>
}
