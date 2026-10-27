import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    batchFinished,
    batchLeft,
    batchStep,
    batchSummary,
    completeRest,
    dotFill,
    newlyLitDots,
    ratingAtFraction,
    ratingForKey,
    ratingTap,
    startBatch,
} from './completion'

describe('nota con el teclado', () => {
    it('flechas y +/- suman o restan medio punto, sin salirse de 0–10', () => {
        assert.deepEqual(ratingForKey(7, 'ArrowRight'), { rating: 7.5 })
        assert.deepEqual(ratingForKey(7, 'ArrowUp'), { rating: 7.5 })
        assert.deepEqual(ratingForKey(7, '+'), { rating: 7.5 })
        assert.deepEqual(ratingForKey(7, 'ArrowLeft'), { rating: 6.5 })
        assert.deepEqual(ratingForKey(7, '-'), { rating: 6.5 })
        assert.deepEqual(ratingForKey(10, 'ArrowRight'), { rating: 10 })
        assert.deepEqual(ratingForKey(0, 'ArrowDown'), { rating: 0 })
    })

    it('sin nota, las flechas empiezan en 5', () => {
        assert.deepEqual(ratingForKey(null, 'ArrowRight'), { rating: 5 })
        assert.deepEqual(ratingForKey(null, '-'), { rating: 5 })
    })

    it('una cifra pone esa nota; Inicio y Fin, 0 y 10', () => {
        assert.deepEqual(ratingForKey(null, '8'), { rating: 8 })
        assert.deepEqual(ratingForKey(3.5, '0'), { rating: 0 })
        assert.deepEqual(ratingForKey(3, 'Home'), { rating: 0 })
        assert.deepEqual(ratingForKey(3, 'End'), { rating: 10 })
    })

    it('Supr y Retroceso la quitan, Intro guarda y el resto no es suyo', () => {
        assert.deepEqual(ratingForKey(8, 'Delete'), { rating: null })
        assert.deepEqual(ratingForKey(8, 'Backspace'), { rating: null })
        assert.equal(ratingForKey(8, 'Enter'), 'submit')
        assert.equal(ratingForKey(8, 'a'), null)
        assert.equal(ratingForKey(8, 'Tab'), null)
    })
})

describe('nota con el puntero', () => {
    it('la mitad izquierda de cada punto es su ,5', () => {
        assert.equal(ratingAtFraction(0.76), 8)
        assert.equal(ratingAtFraction(0.72), 7.5)
        assert.equal(ratingAtFraction(1), 10)
        assert.equal(ratingAtFraction(1.4), 10)
    })

    it('nunca baja de 0,5', () => {
        assert.equal(ratingAtFraction(0), 0.5)
        assert.equal(ratingAtFraction(-0.2), 0.5)
    })

    it('tocar pone la cifra entera y tocar otra vez el mismo punto le quita medio', () => {
        assert.equal(ratingTap(null, 7.5), 8)
        assert.equal(ratingTap(6, 8), 8)
        assert.equal(ratingTap(8, 7.5), 7.5)
        assert.equal(ratingTap(8, 8), 7.5)
        assert.equal(ratingTap(1, 1), 0.5)
    })
})

describe('puntos de la nota', () => {
    it('enteros, medios y apagados', () => {
        assert.deepEqual(
            [1, 8, 9, 10].map((p) => dotFill(8.5, p)),
            ['full', 'full', 'half', 'off'],
        )
        assert.equal(dotFill(null, 1), 'off')
        assert.equal(dotFill(0, 1), 'off')
    })

    it('al subir se encienden en cadena los nuevos; al bajar, ninguno', () => {
        assert.deepEqual([...newlyLitDots(6, 8.5)], [
            [7, 0],
            [8, 22],
            [9, 44],
        ])
        assert.deepEqual([...newlyLitDots(null, 2)], [
            [1, 0],
            [2, 22],
        ])
        assert.equal(newlyLitDots(8.5, 6).size, 0)
        assert.equal(newlyLitDots(7.5, 8).size, 0)
        assert.equal(newlyLitDots(8, null).size, 0)
    })
})

describe('lote desde la bandeja', () => {
    it('avanza juego a juego marcando completados y saltados', () => {
        let s = startBatch(3)
        assert.deepEqual(s, { marks: ['todo', 'todo', 'todo'], index: 0 })
        assert.equal(batchLeft(s), 2)
        s = batchStep(s, 'done')
        s = batchStep(s, 'skip')
        assert.equal(batchLeft(s), 0)
        assert.equal(batchFinished(s), false)
        s = batchStep(s, 'done')
        assert.equal(batchFinished(s), true)
        assert.deepEqual(s.marks, ['done', 'skip', 'done'])
        assert.deepEqual(batchSummary(s), { done: 2, skipped: 1 })
        assert.equal(batchStep(s, 'done'), s)
    })

    it('«Completar los restantes» completa el actual y los que faltan', () => {
        let s = batchStep(startBatch(4), 'skip')
        s = completeRest(s)
        assert.deepEqual(s.marks, ['skip', 'done', 'done', 'done'])
        assert.equal(batchFinished(s), true)
        assert.deepEqual(batchSummary(s), { done: 3, skipped: 1 })
    })
})
