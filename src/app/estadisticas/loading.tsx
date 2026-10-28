import '@/styles/lists.css'
import './stats.css'

/** Primera carga de /estadisticas: esqueleto con la forma de la página (al cambiar de año no hace falta: ya está todo). */
export default function Loading() {
    return (
        <div className="stats" aria-busy="true" aria-label="Cargando estadísticas">
            <header className="page-head">
                <div>
                    <span className="st-sk st-sk--title" />
                    <span className="st-sk st-sk--line" />
                </div>
            </header>
            <div className="hg-tiles st-tiles">
                {Array.from({ length: 5 }, (_, i) => (
                    <span key={i} className="st-sk st-sk--tile" />
                ))}
            </div>
            <div className="st-grid">
                <span className="st-sk st-sk--panel st-panel--wide" />
                <span className="st-sk st-sk--panel" />
                <span className="st-sk st-sk--panel" />
            </div>
        </div>
    )
}
