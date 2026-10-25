'use client'

import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { supabase } from '@/lib/supabase/client'
import { ALERT_MODES, ALERT_MODE_LABELS, DEFAULT_ALERT, alertLabel, parseEuros, type AlertMode, type PriceAlert } from '@/lib/price-alerts'
import './wishlist.css'

const HINTS: Record<AlertMode, string> = {
    minimo: 'Cuando iguale o mejore su precio más bajo en Steam.',
    precio: 'Cuando el precio baje de la cantidad que pongas.',
    descuento: 'Cuando tenga al menos este descuento.',
    off: 'No avisar de este juego.',
}

/**
 * Criterio del aviso push de precio de un juego (#37). Se guarda en hubgames_price_alerts; sin fila, mínimo histórico.
 * Los avisos llegan si tienes las notificaciones activadas en tu perfil.
 */
export default function PriceAlertControl({
    appid,
    userId,
    name,
    alert,
    onSaved,
}: {
    appid: number
    userId: string
    name: string
    alert: PriceAlert | null
    onSaved: (alert: PriceAlert) => void
}) {
    const current = alert ?? DEFAULT_ALERT
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<AlertMode>(current.mode)
    const [price, setPrice] = useState(current.target_price !== null ? (current.target_price / 100).toFixed(2).replace('.', ',') : '')
    const [discount, setDiscount] = useState(current.target_discount !== null ? String(current.target_discount) : '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    function reset(next: boolean) {
        setOpen(next)
        if (next) {
            setMode(current.mode)
            setPrice(current.target_price !== null ? (current.target_price / 100).toFixed(2).replace('.', ',') : '')
            setDiscount(current.target_discount !== null ? String(current.target_discount) : '')
            setError('')
        }
    }

    async function save() {
        const targetPrice = mode === 'precio' ? parseEuros(price) : null
        const targetDiscount = mode === 'descuento' ? Number(discount) : null
        if (mode === 'precio' && targetPrice === null) return setError('Escribe un precio, por ejemplo 9,99')
        if (mode === 'descuento' && !(Number.isInteger(targetDiscount) && targetDiscount! >= 1 && targetDiscount! <= 100)) {
            return setError('El descuento va de 1 a 100')
        }
        setSaving(true)
        setError('')
        const { error: e } = await supabase
            .from('hubgames_price_alerts')
            .upsert(
                { user_id: userId, appid, mode, target_price: targetPrice, target_discount: targetDiscount },
                { onConflict: 'user_id,appid' },
            )
        setSaving(false)
        if (e) return setError('No se pudo guardar')
        onSaved({ ...current, mode, target_price: targetPrice, target_discount: targetDiscount })
        setOpen(false)
    }

    const off = current.mode === 'off'
    return (
        <Popover open={open} onOpenChange={reset}>
            <PopoverTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className={off ? 'price-alert__trigger is-off' : 'price-alert__trigger'}
                    aria-label={`Aviso de precio de ${name}: ${alertLabel(alert)}`}
                    title={alertLabel(alert)}
                >
                    {off ? <BellOff aria-hidden /> : <Bell aria-hidden />}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="price-alert">
                <p className="price-alert__title">Avisarme de {name}</p>
                <div className="price-alert__modes" role="radiogroup" aria-label="Cuándo avisar">
                    {ALERT_MODES.map((m) => (
                        <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={mode === m}
                            className={`price-alert__mode ${mode === m ? 'is-active' : ''}`}
                            onClick={() => setMode(m)}
                        >
                            <span className="price-alert__mode-label">{ALERT_MODE_LABELS[m]}</span>
                            <span className="price-alert__mode-hint">{HINTS[m]}</span>
                        </button>
                    ))}
                </div>
                {mode === 'precio' && (
                    <label className="price-alert__field">
                        Precio máximo
                        <span className="price-alert__input">
                            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="9,99" autoFocus />€
                        </span>
                    </label>
                )}
                {mode === 'descuento' && (
                    <label className="price-alert__field">
                        Descuento mínimo
                        <span className="price-alert__input">
                            <input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="75" autoFocus />%
                        </span>
                    </label>
                )}
                {error && (
                    <p className="price-alert__error" role="alert">
                        {error}
                    </p>
                )}
                <div className="price-alert__actions">
                    <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button size="sm" onClick={() => void save()} disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
