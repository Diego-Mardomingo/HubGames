import { Skeleton, SkeletonZone } from '@/components/ui/skeleton'
import '@/styles/lists.css'
import '@/components/dashboard/dashboard.css'
import './perfil.css'

function SectionSkeleton({ rows, className = 'pf-sec' }: { rows: number; className?: string }) {
    return (
        <section className={className} aria-hidden>
            <header className="dash-sec__head pf-sec__head">
                <Skeleton className="dash-sec__icon" />
                <h2 className="dash-sec__title">
                    <Skeleton shape="text" w="10ch" />
                </h2>
            </header>
            <div style={{ display: 'grid', gap: 14, padding: '0.75rem 1.25rem 1.25rem' }}>
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} style={{ display: 'grid', gap: 8 }}>
                        <Skeleton shape="text" w={`${[12, 18, 15, 20][i % 4]}ch`} />
                        <Skeleton h={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                    </div>
                ))}
            </div>
        </section>
    )
}

/** Esqueleto del perfil: tarjeta de usuario, secciones de ajustes y el panel de JUDI en el lateral. */
export default function ProfileSkeleton() {
    return (
        <SkeletonZone label="Cargando tu perfil">
            <div className="pf">
                <header className="pf-card">
                    <Skeleton shape="circle" className="pf-avatar-skel" />
                    <div className="pf-who">
                        <h1 className="page-title pf-who__name">
                            <Skeleton shape="text" w="9ch" />
                        </h1>
                        <p className="pf-who__meta">
                            <Skeleton shape="text" w="26ch" />
                        </p>
                    </div>
                    <Skeleton h={56} className="pf-steamid-skel" style={{ borderRadius: 'var(--radius)' }} />
                </header>
                <div className="pf-grid">
                    <div className="pf-main">
                        <SectionSkeleton rows={2} />
                        <SectionSkeleton rows={1} />
                        <SectionSkeleton rows={2} />
                    </div>
                    <aside className="pf-aside">
                        <section className="pf-panel" aria-hidden>
                            <header className="dash-sec__head">
                                <Skeleton className="dash-sec__icon" />
                                <h2 className="dash-sec__title">JUDI</h2>
                            </header>
                            <Skeleton h={64} style={{ borderRadius: 'var(--radius)' }} />
                            <Skeleton h={8} style={{ borderRadius: 999 }} />
                            {[0, 1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} h={36} style={{ borderRadius: 'var(--radius-sm)' }} />
                            ))}
                        </section>
                    </aside>
                </div>
            </div>
        </SkeletonZone>
    )
}
