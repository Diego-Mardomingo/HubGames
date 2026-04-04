import { CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateRangePickerProps {
    value: DateRange | undefined
    onChange: (range: DateRange | undefined) => void
    className?: string
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
    return (
        <div className={cn('grid gap-2', className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            'h-auto min-h-10 w-full justify-start py-2.5 text-left font-normal',
                            !value && 'text-[var(--muted)]'
                        )}
                    >
                        <CalendarDays size={16} data-icon="inline-start" aria-hidden />
                        {value?.from ? (
                            value.to ? (
                                <>
                                    {format(value.from, 'dd/MM/yyyy')} - {format(value.to, 'dd/MM/yyyy')}
                                </>
                            ) : (
                                format(value.from, 'dd/MM/yyyy')
                            )
                        ) : (
                            <span>Seleccionar rango de fecha</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={value?.from}
                        selected={value}
                        onSelect={onChange}
                        numberOfMonths={1}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
