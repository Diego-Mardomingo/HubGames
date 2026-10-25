'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { dayLabel, heatmapSummary, type Heatmap } from '@/lib/activity-heatmap'

const RANGE = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' })

function rangeLabel(from: string, to: string) {
    const f = (d: string) => RANGE.format(new Date(`${d}T00:00:00Z`)).replace('.', '')
    return `${f(from)} – ${f(to)}`
}

export interface HeatStat {
    value: string
    label: string
}

interface Props {
    map: Heatmap
    /** Cifras clave de la cabecera del mapa. */
    stats: HeatStat[]
    /** Pie: a la derecha de la leyenda (notas, enlaces). */
    footer?: ReactNode
    /** Ilustración estática (portada sin sesión): sin tooltip ni teclado, oculta a lectores de pantalla. */
    preview?: boolean
}

interface Tip {
    index: number
    x: number
    y: number
}

const LEVELS = [0, 1, 2, 3, 4] as const

/**
 * Mapa de actividad anual (estilo GitHub). Las celdas no son tab-stops: el mapa entero es un único elemento
 * enfocable que se recorre con las flechas (y anuncia el día), con un resumen textual para lectores de pantalla.
 * Con el ratón, tooltip al pasar por encima.
 */
export default function ActivityHeatmap({ map, stats, footer, preview = false }: Props) {
    const id = useId()
    const scrollRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const [tip, setTip] = useState<Tip | null>(null)
    const [active, setActive] = useState<number | null>(null)
    const lastDay = map.days.findLastIndex((d) => !d.future)

    // En pantallas estrechas el mapa se desplaza en horizontal: se empieza por lo más reciente.
    useLayoutEffect(() => {
        const el = scrollRef.current
        if (el) el.scrollLeft = el.scrollWidth
    }, [])

    // El tooltip es `fixed`: si la página se desplaza, se oculta en vez de quedarse descolocado.
    useEffect(() => {
        if (!tip) return
        const hide = () => setTip(null)
        window.addEventListener('scroll', hide, { passive: true, capture: true })
        window.addEventListener('resize', hide)
        return () => {
            window.removeEventListener('scroll', hide, { capture: true })
            window.removeEventListener('resize', hide)
        }
    }, [tip])

    function tipFor(index: number): Tip | null {
        const cell = gridRef.current?.children[index] as HTMLElement | undefined
        if (!cell) return null
        const r = cell.getBoundingClientRect()
        // Sin salirse por los lados de la ventana (el texto mide ~180 px).
        const x = Math.max(100, Math.min(window.innerWidth - 100, r.left + r.width / 2))
        return { index, x, y: r.top }
    }

    function onPointerMove(e: PointerEvent<HTMLDivElement>) {
        if (e.pointerType !== 'mouse') return
        const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
        const index = cell ? Number(cell.dataset.i) : null
        if (index === null || map.days[index].future) return setTip(null)
        if (tip?.index !== index) setTip(tipFor(index))
    }

    function move(index: number) {
        const next = Math.max(0, Math.min(lastDay, index))
        setActive(next)
        setTip(tipFor(next))
        // Que el día activo se vea si el mapa se desplaza en horizontal.
        ;(gridRef.current?.children[next] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        const current = active ?? lastDay
        const step: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }
        if (e.key in step) move(current + step[e.key])
        else if (e.key === 'Home') move(0)
        else if (e.key === 'End') move(lastDay)
        else if (e.key === 'Escape') setTip(null)
        else return
        e.preventDefault()
    }

    const style = { '--weeks': map.weeks } as CSSProperties
    const shown = tip ? map.days[tip.index] : null
    const announced = active !== null ? dayLabel(map.days[active]) : ''

    return (
        <section className={`heat glass${preview ? ' heat--preview' : ''}`} aria-labelledby={preview ? undefined : `${id}-title`} aria-hidden={preview || undefined}>
            {!preview && (
                <h2 id={`${id}-title`} className="sr-only">
                    Actividad del último año
                </h2>
            )}
            <div className="heat__meta">
                {stats.map((s) => (
                    <p key={s.label}>
                        <b>{s.value}</b> {s.label}
                    </p>
                ))}
                <p className="heat__range">{rangeLabel(map.from, map.to)}</p>
            </div>

            <div className="heat__scroll" ref={scrollRef}>
                <div className="heat__body" style={style}>
                    <div
                        ref={gridRef}
                        className="heat__grid"
                        {...(preview
                            ? {}
                            : {
                                  tabIndex: 0,
                                  role: 'group',
                                  'aria-roledescription': 'mapa de actividad',
                                  'aria-label': 'Días del último año. Usa las flechas para recorrerlos.',
                                  'aria-describedby': `${id}-summary`,
                                  onKeyDown,
                                  onFocus: () => setActive((a) => a ?? lastDay),
                                  onBlur: () => {
                                      setActive(null)
                                      setTip(null)
                                  },
                                  onPointerMove,
                                  onPointerLeave: () => active === null && setTip(null),
                              })}
                    >
                        {map.days.map((d, i) => (
                            <i
                                key={d.date}
                                data-i={i}
                                data-l={d.level}
                                aria-hidden
                                className={d.future ? 'is-future' : i === active ? 'is-active' : undefined}
                            />
                        ))}
                    </div>
                    <div className="heat__months" aria-hidden>
                        {map.months.map((m) => (
                            <span key={m.week} style={{ gridColumnStart: m.week + 1 }}>
                                {m.label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="heat__foot">
                <span className="heat__legend" aria-hidden>
                    menos
                    {LEVELS.map((l) => (
                        <i key={l} data-l={l} />
                    ))}
                    más
                </span>
                {footer}
            </div>

            {!preview && (
                <>
                    <p id={`${id}-summary`} className="sr-only">
                        {heatmapSummary(map)}
                    </p>
                    <p className="sr-only" aria-live="polite">
                        {announced}
                    </p>
                </>
            )}
            {shown && tip && (
                <div className="heat__tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
                    {dayLabel(shown)}
                </div>
            )}
        </section>
    )
}
