import { FileJson, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Exportar tus datos (#34): biblioteca (estados, notas, reseñas y fechas) y logros en CSV, o todo junto en JSON.
 * Son enlaces normales: la descarga la sirve /api/export con tu sesión.
 */
export default function ExportSetting() {
    return (
        <section className="pf-section" aria-labelledby="pf-data">
            <h2 id="pf-data" className="pf-section__title">
                Tus datos
            </h2>
            <div className="pf-rows">
                <div className="pf-row">
                    <div className="pf-row__text">
                        <span className="pf-row__label">Exportar</span>
                        <p className="pf-row__desc">
                            Tu biblioteca (estados, notas, reseñas y fechas) y tus logros. El CSV usa «;» y decimales con coma, para
                            abrirlo directamente en Excel en español.
                        </p>
                    </div>
                    <div className="pf-row__control pf-row__control--wrap">
                        <Button variant="secondary" size="sm" asChild>
                            <a href="/api/export?tipo=biblioteca" download>
                                <FileSpreadsheet aria-hidden /> Biblioteca (CSV)
                            </a>
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                            <a href="/api/export?tipo=logros" download>
                                <FileSpreadsheet aria-hidden /> Logros (CSV)
                            </a>
                        </Button>
                        <Button variant="secondary" size="sm" asChild>
                            <a href="/api/export?tipo=todo" download>
                                <FileJson aria-hidden /> Todo (JSON)
                            </a>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}
