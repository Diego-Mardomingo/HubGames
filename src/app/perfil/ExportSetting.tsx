import { Award, Download, FileJson, Library } from 'lucide-react'
import { PfSection, enter } from './Section'

/** Cada descarga con el color de lo que exporta: la Biblioteca en cobalto (el de «Todos» en su raíl), los Logros en el violeta de sus tiles y «Todo» neutro. */
const FILES = [
    { tipo: 'biblioteca', label: 'Biblioteca', format: 'CSV', tone: 'st-todos', icon: Library },
    { tipo: 'logros', label: 'Logros', format: 'CSV', tone: 'st-sin_final', icon: Award },
    { tipo: 'todo', label: 'Todo', format: 'JSON', tone: 'neutral', icon: FileJson },
] as const

/**
 * Exportar tus datos (#34): biblioteca (estados, notas, reseñas y fechas) y logros en CSV, o todo junto en JSON.
 * Son enlaces normales: la descarga la sirve /api/export con tu sesión.
 */
export default function ExportSetting({ index }: { index: number }) {
    return (
        <PfSection id="pf-data" tone="st-todos" icon={<Download />} title="Tus datos" style={enter(index)}>
            <div className="pf-row pf-row--full">
                <p className="pf-row__desc">
                    Descarga tu biblioteca (estados, notas, reseñas y fechas) y tus logros. El CSV usa «;» y decimales con coma, para abrirlo
                    directamente en Excel en español.
                </p>
                <div className="pf-export">
                    {FILES.map(({ tipo, label, format, tone, icon: Icon }) => (
                        <a key={tipo} href={`/api/export?tipo=${tipo}`} download className="pf-dl">
                            <span className={`pf-dl__icon hg-tint ${tone}`} aria-hidden>
                                <Icon />
                            </span>
                            <span className="pf-dl__text">
                                <b>{label}</b>
                                <small>{format}</small>
                            </span>
                            <Download className="pf-dl__go" aria-hidden />
                        </a>
                    ))}
                </div>
            </div>
        </PfSection>
    )
}
