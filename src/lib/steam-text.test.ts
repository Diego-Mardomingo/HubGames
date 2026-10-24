import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { htmlToParagraphs, parseScreenshots, parseTrailers } from './steam-text'

describe('htmlToParagraphs', () => {
    it('separa párrafos, respeta los saltos de línea y quita etiquetas', () => {
        const html = '<h2 class="bb_tag">Sobre el juego</h2><p>Primera línea<br>segunda <b>línea</b></p><ul><li>Uno</li><li>Dos</li></ul>'
        assert.deepEqual(htmlToParagraphs(html), ['Sobre el juego', 'Primera línea\nsegunda línea', '• Uno', '• Dos'])
    })

    it('decodifica entidades con nombre y numéricas', () => {
        assert.deepEqual(htmlToParagraphs('Tom &amp; Jerry&nbsp;&#8212; &#x2603; &quot;hola&quot; &bogus;'), [
            'Tom & Jerry — ☃ "hola" &bogus;',
        ])
    })

    it('no deja pasar scripts ni estilos', () => {
        assert.deepEqual(htmlToParagraphs('<script>alert(1)</script><style>p{}</style>Texto'), ['Texto'])
    })

    it('vacío o null', () => {
        assert.deepEqual(htmlToParagraphs(null), [])
        assert.deepEqual(htmlToParagraphs('<p> </p>'), [])
    })
})

describe('medios de la ficha', () => {
    it('capturas con miniatura y tamaño completo', () => {
        assert.deepEqual(parseScreenshots([{ id: 0, path_full: 'f.jpg', path_thumbnail: 't.jpg' }, { id: 1 }, 'x']), [
            { thumb: 't.jpg', full: 'f.jpg' },
        ])
        assert.deepEqual(parseScreenshots(null), [])
    })

    it('tráileres: destacado primero, HLS o mp4, y fuera los que no tienen vídeo', () => {
        const trailers = parseTrailers([
            { name: 'Viejo', thumbnail: 'a.jpg', mp4: { '480': 'a480.mp4', max: 'amax.mp4' }, webm: { '480': 'a.webm' } },
            { name: 'Sin vídeo', thumbnail: 'b.jpg' },
            { name: 'Lanzamiento', thumbnail: 'c.jpg', hls_h264: 'c.m3u8', highlight: true },
        ])
        assert.deepEqual(
            trailers.map((t) => [t.name, t.mp4, t.webm, t.hls]),
            [
                ['Lanzamiento', null, null, 'c.m3u8'],
                ['Viejo', 'amax.mp4', 'a.webm', null],
            ],
        )
    })
})
