import { LogoMark } from '@/components/brand/Logo'

export default function Loader({ label = 'Cargando' }: { label?: string }) {
    return (
        <div className="loader-container" role="status" aria-live="polite">
            <LogoMark size={56} loop />
            <span className="loader-container__label">{label}</span>
        </div>
    )
}
