'use client'

import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { yearChoices } from '@/lib/wrapped'

const href = (y: number) => `/estadisticas/resumen?year=${y}`

/** Selector de año de la cabecera: los 5 más recientes y el resto en «Más». */
export default function YearPicker({ years, year }: { years: number[]; year: number }) {
    const { shown, more } = yearChoices(years, year)
    if (shown.length < 2 && more.length === 0) return null
    return (
        <nav className="wr-years" aria-label="Año del resumen">
            {shown.map((y) => (
                <Link key={y} href={href(y)} className={y === year ? 'on' : undefined} aria-current={y === year ? 'page' : undefined}>
                    {y}
                </Link>
            ))}
            {more.length > 0 && (
                <Popover>
                    <PopoverTrigger className="wr-years__more">
                        Más <ChevronDown aria-hidden />
                    </PopoverTrigger>
                    <PopoverContent align="end" className="wr-years__pop">
                        <ul>
                            {more.map((y) => (
                                <li key={y}>
                                    <Link href={href(y)}>{y}</Link>
                                </li>
                            ))}
                        </ul>
                    </PopoverContent>
                </Popover>
            )}
        </nav>
    )
}
