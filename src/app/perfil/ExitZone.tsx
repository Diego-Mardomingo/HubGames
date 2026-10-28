'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DoorOpen, LogOut, Unlink } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { PfSection, enter, type Notify } from './Section'

/**
 * Salir: lo que te saca o borra, junto y en rojo. «Cerrar sesión» y «Desvincular Steam» con texto rojo sobre su tinte
 * (`.hg-btn--danger-soft`); el rojo sólido solo en el botón que confirma desvincular, que se despliega dentro del panel.
 */
export default function ExitZone({ linked, onUnlinked, notify, index }: { linked: boolean; onUnlinked: () => void; notify: Notify; index: number }) {
    const router = useRouter()
    const [leaving, setLeaving] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [unlinking, setUnlinking] = useState(false)

    async function logout() {
        setLeaving(true)
        await supabase.auth.signOut()
        router.push('/')
    }

    async function unlink() {
        setUnlinking(true)
        const res = await fetch('/api/steam/unlink', { method: 'POST' })
        setUnlinking(false)
        if (!res.ok) {
            notify('error', 'No se pudo desvincular Steam. Inténtalo de nuevo.')
            return
        }
        setConfirming(false)
        onUnlinked()
        notify('ok', 'Steam desvinculado')
        router.replace('/perfil')
    }

    return (
        <PfSection id="pf-exit" tone="dash-ko" icon={<DoorOpen />} title="Salir" className="pf-exit" style={enter(index)}>
            <div className="pf-row pf-row--inline pf-row--stack-sm">
                <div className="pf-row__text">
                    <span className="pf-row__label">Cerrar sesión</span>
                    <p className="pf-row__desc">En este dispositivo. Tus datos se quedan como están.</p>
                </div>
                <div className="pf-row__control">
                    <Button variant="dangerSoft" loading={leaving} onClick={logout}>
                        <LogOut data-icon="inline-start" aria-hidden /> Cerrar sesión
                    </Button>
                </div>
            </div>
            {linked && (
                <>
                    <div className="pf-row pf-row--inline pf-row--stack-sm">
                        <div className="pf-row__text">
                            <span className="pf-row__label">Desvincular Steam</span>
                            <p className="pf-row__desc">Se borrarán tus datos de Steam en HubGames.</p>
                        </div>
                        <div className="pf-row__control">
                            <Button variant="dangerSoft" onClick={() => setConfirming(true)} aria-expanded={confirming} aria-controls="pf-unlink-confirm">
                                <Unlink data-icon="inline-start" aria-hidden /> Desvincular Steam
                            </Button>
                        </div>
                    </div>
                    <div id="pf-unlink-confirm" className={`pf-confirm${confirming ? ' is-open' : ''}`} inert={!confirming}>
                        <div>
                            <div className="pf-confirm__box" role="alertdialog" aria-labelledby="pf-unlink-q">
                                <p id="pf-unlink-q">
                                    <b>¿Desvincular Steam?</b> Se borrarán tus datos de Steam en HubGames.
                                </p>
                                <div className="pf-confirm__acts">
                                    <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={unlinking}>
                                        Cancelar
                                    </Button>
                                    <Button variant="danger" size="sm" loading={unlinking} onClick={unlink}>
                                        <Unlink data-icon="inline-start" aria-hidden /> Desvincular
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </PfSection>
    )
}
