// Genera public/music.wav: un loop synthwave a 120 BPM (La menor) sintetizado desde cero,
// sin muestras externas ni licencias. Uso: node scripts/music.mjs [segundos]
import { writeFileSync } from 'node:fs'

const SR = 44100
const DUR = Number(process.argv[2] ?? 45)
const N = Math.floor(SR * DUR)
const BPM = 120
const BEAT = 60 / BPM
const BAR = BEAT * 4
const L = new Float32Array(N)
const R = new Float32Array(N)

const midi = (m) => 440 * 2 ** ((m - 69) / 12)
// Am, F, C, G (raíz, tercera, quinta)
const CHORDS = [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
]
const DRUMS_FROM = 2 * BAR
const ARP_FROM = 4 * BAR
// la batería para y queda el acorde final (unos 2 s antes del final)
const END_AT = Math.max(4, Math.min(23, Math.floor((DUR - 2) / BAR))) * BAR

let seed = 1
const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 31 - 1
}

const chordAt = (t) => CHORDS[Math.floor(t / BAR) % CHORDS.length]

// ── Pad: sierra limitada en banda, 3 voces desafinadas por nota, filtro paso bajo que se abre ──
{
    const state = [0, 0]
    for (let i = 0; i < N; i++) {
        const t = i / SR
        const chord = t >= END_AT ? CHORDS[0] : chordAt(t)
        let l = 0
        let r = 0
        chord.forEach((m, n) => {
            for (let v = -1; v <= 1; v++) {
                const f = midi(m) * 2 ** ((v * 8) / 1200)
                let s = 0
                for (let k = 1; k <= 7; k++) s += Math.sin(2 * Math.PI * f * k * t + v + n) / k
                const pan = 0.5 + v * 0.35
                l += s * (1 - pan)
                r += s * pan
            }
        })
        const cutoff = 600 + 1400 * Math.min(1, t / (2 * BAR)) + 300 * Math.sin(t * 0.7)
        const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR)
        state[0] += a * (l - state[0])
        state[1] += a * (r - state[1])
        const tb = t >= DRUMS_FROM && t < END_AT ? t % BEAT : 1
        const duck = 1 - 0.55 * Math.exp(-tb * 9)
        const fadeIn = Math.min(1, t / 1.5)
        L[i] += state[0] * 0.022 * duck * fadeIn
        R[i] += state[1] * 0.022 * duck * fadeIn
    }
}

// ── Bajo: corcheas con la raíz una octava abajo ──
{
    let lp = 0
    for (let i = Math.floor(DRUMS_FROM * SR); i < Math.floor(END_AT * SR); i++) {
        const t = i / SR
        const root = chordAt(t)[0] - 24
        const te = t % (BEAT / 2)
        const f = midi(root)
        let s = 0
        for (let k = 1; k <= 6; k++) s += Math.sin(2 * Math.PI * f * k * t) / k
        const env = Math.exp(-te * 7)
        const a = 1 - Math.exp((-2 * Math.PI * (300 + 900 * env)) / SR)
        lp += a * (s * env - lp)
        L[i] += lp * 0.16
        R[i] += lp * 0.16
    }
}

// ── Arpegio: semicorcheas sobre el acorde, con eco ping-pong ──
{
    const arpL = new Float32Array(N)
    for (let i = Math.floor(ARP_FROM * SR); i < Math.floor(END_AT * SR); i++) {
        const t = i / SR
        const step = Math.floor(t / (BEAT / 4))
        const chord = chordAt(t)
        const notes = [chord[0], chord[1], chord[2], chord[0] + 12, chord[2], chord[1]]
        const f = midi(notes[step % notes.length] + 12)
        const te = t % (BEAT / 4)
        let s = 0
        for (let k = 1; k <= 7; k += 2) s += Math.sin(2 * Math.PI * f * k * t) / k
        arpL[i] = s * Math.exp(-te * 16) * 0.05
    }
    const d = Math.floor(BEAT * 0.75 * SR)
    const echoL = new Float32Array(N)
    const echoR = new Float32Array(N)
    for (let i = 0; i < N; i++) {
        const fromR = i >= d ? echoR[i - d] : 0
        const fromL = i >= d ? echoL[i - d] : 0
        echoL[i] = arpL[i] + fromR * 0.4
        echoR[i] = fromL * 0.4
        L[i] += echoL[i]
        R[i] += arpL[i] + echoR[i]
    }
}

// ── Batería ──
const addHit = (start, len, fn, gain = 1, pan = 0.5) => {
    const s0 = Math.floor(start * SR)
    const n = Math.floor(len * SR)
    for (let j = 0; j < n && s0 + j < N; j++) {
        const v = fn(j / SR) * gain
        L[s0 + j] += v * (1 - pan) * 2
        R[s0 + j] += v * pan * 2
    }
}

const kick = () => {
    let ph = 0
    return (t) => {
        ph += (2 * Math.PI * (48 + 110 * Math.exp(-t * 28))) / SR
        return Math.sin(ph) * Math.exp(-t * 6.5) + (t < 0.004 ? noise() * 0.3 : 0)
    }
}
const clap = () => {
    let lp1 = 0
    let lp2 = 0
    return (t) => {
        const x = noise()
        lp1 += 0.35 * (x - lp1)
        lp2 += 0.08 * (x - lp2)
        const burst = t < 0.03 ? 0.6 + 0.4 * Math.sin(t * 900) : 1
        return (lp1 - lp2) * Math.exp(-t * 16) * burst
    }
}
const hat = () => {
    let lp = 0
    return (t) => {
        const x = noise()
        lp += 0.6 * (x - lp)
        return (x - lp) * Math.exp(-t * 55)
    }
}

for (let t = DRUMS_FROM; t < END_AT - 0.01; t += BEAT) {
    const beatInBar = Math.round((t % BAR) / BEAT)
    addHit(t, 0.45, kick(), 0.42)
    if (beatInBar === 1 || beatInBar === 3) addHit(t, 0.35, clap(), 0.3, 0.45)
    addHit(t + BEAT / 2, 0.08, hat(), 0.12, 0.65)
    addHit(t + BEAT / 4, 0.04, hat(), 0.04, 0.35)
    addHit(t + (3 * BEAT) / 4, 0.04, hat(), 0.04, 0.35)
}

// Subida de ruido antes de que entre la batería y "crash" al entrar
{
    const rs = DRUMS_FROM - BAR
    let lp = 0
    addHit(
        rs,
        BAR,
        (t) => {
            const x = noise()
            const a = 0.02 + 0.5 * (t / BAR) ** 2
            lp += a * (x - lp)
            return (x - lp) * (t / BAR) ** 2 * 0.25
        },
        1
    )
    for (const at of [DRUMS_FROM, END_AT]) addHit(at, 2.5, hat(), 0.18)
    for (const at of [DRUMS_FROM, END_AT]) {
        let lp2 = 0
        addHit(
            at,
            2.5,
            (t) => {
                const x = noise()
                lp2 += 0.5 * (x - lp2)
                return (x - lp2) * Math.exp(-t * 1.6) * 0.12
            },
            1
        )
    }
}

// ── Master: saturación suave y normalización ──
let peak = 0
for (let i = 0; i < N; i++) {
    L[i] = Math.tanh(L[i] * 1.4)
    R[i] = Math.tanh(R[i] * 1.4)
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
}
const norm = 0.89 / peak
const buf = Buffer.alloc(44 + N * 4)
buf.write('RIFF', 0)
buf.writeUInt32LE(36 + N * 4, 4)
buf.write('WAVEfmt ', 8)
buf.writeUInt32LE(16, 16)
buf.writeUInt16LE(1, 20)
buf.writeUInt16LE(2, 22)
buf.writeUInt32LE(SR, 24)
buf.writeUInt32LE(SR * 4, 28)
buf.writeUInt16LE(4, 32)
buf.writeUInt16LE(16, 34)
buf.write('data', 36)
buf.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) {
    const fade = Math.min(1, (N - i) / (SR * 2))
    buf.writeInt16LE(Math.round(L[i] * norm * fade * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(R[i] * norm * fade * 32767), 46 + i * 4)
}
writeFileSync(new URL('../public/music.wav', import.meta.url), buf)
console.log(`music.wav: ${DUR}s, pico ${peak.toFixed(2)}`)
