'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Percent, Tag, TrendingDown, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { supabase } from '@/lib/supabase/client'
import {
    ALERT_MODES,
    ALERT_MODE_LABELS,
    DEFAULT_ALERT,
    alertLabel,
    meetsAlert,
    parseEuros,
    type AlertGame,
    type AlertMode,
    type PriceAlert,
} from '@/lib/price-alerts'
import { formatPrice } from '@/lib/wishlist'
import './wishlist.css'

const HINTS: Record<AlertMode, string> = {
    minimo: 'Cuando iguale o mejore su precio más bajo en Steam.',
    precio: 'Cuando el precio baje de la cantidad que pongas.',
    descuento: 'Cuando tenga al menos este descuento.',
    off: 'No avisar de este juego.',
}

const ICONS: Record<AlertMode, LucideIcon> = { minimo: TrendingDown, precio: Tag, descuento: Percent, off: BellOff }

/** Precio de hoy para la cabecera del aviso: «Hoy 20,99 € (-65 %) · mínimo en Steam 20,99 €». */
function todayLine(game: AlertGame): string {
    if (game.price_final === null) return 'Aún sin precio en Steam'
    const cut = (game.discount_percent ?? 0) > 0 ? ` (-${game.discount_percent} %)` : ''
    const low = game.steam_low !== null ? ` · mínimo en Steam ${formatPrice(game.steam_low)}` : ''
    return `Hoy ${formatPrice(game.price_final)}${cut}${low}`
}

/**
 * Criterio del aviso push de precio de un juego (#37). Se guarda en hubgames_price_alerts; sin fila, mínimo histórico.
 * Los avisos llegan si tienes las notificaciones activadas en tu perfil. La campana va en cobalto con un punto si el
 * aviso es propio (en verde si el precio de hoy ya lo cumple) y se balancea al guardarlo.
 */
export default function PriceAlertControl({
    game,
    userId,
    name,
    alert,
    onSaved,
}: {
    game: AlertGame
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
    const [swing, setSwing] = useState(0)

    useEffect(() => {
        if (!swing) return
        const t = setTimeout(() => setSwing(0), 800)
        return () => clearTimeout(t)
    }, [swing])

    function reset(next: boolean) {
        setOpen(next)
        if (next) {
            setMode(current.mode)
            setPrice(current.target_price !== null ? (current.target_price / 100).toFixed(2).replace('.', ',') : '')
            setDiscount(current.target_discount !== null ? String(current.target_discount) : '')
            setError('')
        }
    }

    const targetPrice = mode === 'precio' ? parseEuros(price) : null
    const targetDiscount = mode === 'descuento' ? Number(discount) : null
    const validDiscount = Number.isInteger(targetDiscount) && targetDiscount! >= 1 && targetDiscount! <= 100

    async function save() {
        if (mode === 'precio' && targetPrice === null) return setError('Escribe un precio, por ejemplo 9,99')
        if (mode === 'descuento' && !validDiscount) return setError('El descuento va de 1 a 100')
        setSaving(true)
        setError('')
        const { error: e } = await supabase
            .from('hubgames_price_alerts')
            .upsert(
                { user_id: userId, appid: game.appid, mode, target_price: targetPrice, target_discount: targetDiscount },
                { onConflict: 'user_id,appid' },
            )
        setSaving(false)
        if (e) return setError('No se pudo guardar')
        onSaved({ ...current, mode, target_price: targetPrice, target_discount: targetDiscount })
        setOpen(false)
        if (mode !== 'off') setSwing((n) => n + 1)
    }

    const onEnter = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            void save()
        }
    }

    // ¿El precio de hoy cumpliría el aviso que estás escribiendo?
    const draftReady = mode !== 'off' && game.price_final !== null && (mode !== 'precio' || targetPrice !== null) && (mode !== 'descuento' || validDiscount)
    const draftHit = draftReady ? meetsAlert(game, { ...current, mode, target_price: targetPrice, target_discount: targetDiscount }) : null

    const off = current.mode === 'off'
    const own = current.mode === 'precio' || current.mode === 'descuento'
    const met = own && meetsAlert(game, current)
    const cls = ['price-alert__trigger', off && 'is-off', own && (met ? 'is-met' : 'is-set'), swing > 0 && 'is-swing'].filter(Boolean).join(' ')
    return (
        <Popover open={open} onOpenChange={reset}>
            <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className={cls} aria-label={`Aviso de precio de ${name}: ${alertLabel(alert)}`} title={alertLabel(alert)}>
                    {off ? <BellOff aria-hidden /> : <Bell aria-hidden />}
                    {own && <span key={swing} className="price-alert__dot" aria-hidden />}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="price-alert">
                <p className="price-alert__title">Avisarme de {name}</p>
                <p className="price-alert__now">{todayLine(game)}</p>
                <div className="price-alert__modes" role="radiogroup" aria-label="Cuándo avisar">
                    {ALERT_MODES.map((m) => {
                        const Icon = ICONS[m]
                        return (
                            <button
                                key={m}
                                type="button"
                                role="radio"
                                aria-checked={mode === m}
                                className={`price-alert__mode ${mode === m ? 'is-active' : ''}`}
                                onClick={() => setMode(m)}
                            >
                                <Icon className="price-alert__mode-icon" aria-hidden />
                                <span className="price-alert__mode-label">{ALERT_MODE_LABELS[m]}</span>
                                <span className="price-alert__mode-hint">{HINTS[m]}</span>
                            </button>
                        )
                    })}
                </div>
                {mode === 'precio' && (
                    <label className="price-alert__field">
                        Precio máximo
                        <span className="price-alert__input">
                            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="9,99" autoFocus onKeyDown={onEnter} />€
                        </span>
                    </label>
                )}
                {mode === 'descuento' && (
                    <label className="price-alert__field">
                        Descuento mínimo
                        <span className="price-alert__input">
                            <input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="75" autoFocus onKeyDown={onEnter} />%
                        </span>
                    </label>
                )}
                {error ? (
                    <p className="price-alert__error" role="alert">
                        {error}
                    </p>
                ) : (
                    draftHit !== null && (
                        <p className={`price-alert__hit${draftHit ? ' is-yes' : ''}`} aria-live="polite">
                            {draftHit ? 'El precio de hoy ya lo cumple: te avisaremos hoy mismo.' : 'Hoy no lo cumple.'}
                        </p>
                    )
                )}
                <div className="price-alert__actions">
                    <Button size="sm" variant="secondary" disabled={saving} onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button size="sm" onClick={() => void save()} loading={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
