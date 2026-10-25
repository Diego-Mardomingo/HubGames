import { Download, FileJson, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Exportar tus datos (#34): biblioteca (estados, notas, reseñas y fechas) y logros en CSV, o todo junto en JSON.
 * Son enlaces normales: la descarga la sirve /api/export con tu sesión.
 */
export default function ExportSetting() {
    return (
        <div className="setting glass">
            <div className="setting__head">
                <span className="setting__icon" aria-hidden>
                    <Download size={17} />
                </span>
                <div className="setting__text">
                    <p className="setting__title">Tus datos</p>
                    <p className="setting__desc">Descarga tu biblioteca, notas, fechas y logros</p>
                </div>
            </div>
            <div className="setting__form setting__form--wrap">
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
            <p className="setting__desc">El CSV usa «;» y decimales con coma, para abrirlo directamente en Excel en español.</p>
        </div>
    )
}
