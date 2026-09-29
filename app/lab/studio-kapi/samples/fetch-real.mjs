// Studio-Kapi — real-instrument sample fetcher
// Downloads openly licensed recordings (Freesound CC0 / CC-BY, tonejs-instruments
// CC-BY 3.0), slices single notes/strokes, tunes them to concert pitch and writes
// small mono files to public/lab/studio-kapi/samples/real/.
// Pitches and slice points were measured once (YIN + harmonic product spectrum)
// and are recorded below so the output is reproducible.
// Requires ffmpeg on PATH. Run: node app/lab/studio-kapi/samples/fetch-real.mjs
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '../../../../public/lab/studio-kapi/samples/real')
const TMP = join(tmpdir(), 'kapi-real')
mkdirSync(TMP, { recursive: true })

const FS = (id, user) => `https://cdn.freesound.org/previews/${Math.floor(id / 1000)}/${id}_${user}-hq.mp3`
const TJ = (inst, note) => `https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/master/samples/${inst}/${note.replace('#', 's')}.mp3`

async function download(url) {
  const file = join(TMP, url.replace(/[^a-z0-9]+/gi, '_').slice(-80))
  if (existsSync(file)) return file
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return file
}

function peakDb(src, base, filters) {
  const r = spawnSync('ffmpeg', [...base, '-af', [...filters, 'volumedetect'].join(','), '-f', 'null', '-'], { encoding: 'utf8' })
  const m = /max_volume: (-?[\d.]+) dB/.exec(r.stderr)
  return m ? parseFloat(m[1]) : 0
}

// start/len in seconds, cents = pitch correction, fade = fade-out seconds
function render(src, dest, { start = 0, len = 3, cents = 0, fade = 0.25, wav = false } = {}) {
  mkdirSync(dirname(dest), { recursive: true })
  const rate = Math.pow(2, cents / 1200)
  const filters = [
    'aresample=44100', `atrim=start=${start}:duration=${len}`, 'asetpts=PTS-STARTPTS',
    ...(cents ? [`asetrate=${Math.round(44100 * rate)}`, 'aresample=44100'] : []),
    'silenceremove=start_periods=1:start_threshold=-50dB',
    `afade=t=in:d=0.003`,
    `areverse,afade=t=in:d=${fade},areverse`,
  ]
  const codec = wav ? ['-c:a', 'pcm_s16le'] : ['-c:a', 'libmp3lame', '-b:a', '112k']
  const base = ['-y', '-i', src, '-ac', '1', '-ar', '44100']
  // pass 1: measure the peak of the processed slice; pass 2: normalise to -1 dBFS
  const peak = peakDb(src, base, filters)
  execFileSync('ffmpeg', [...base, '-af', [...filters, `volume=${(-1 - peak).toFixed(2)}dB`].join(','), ...codec, dest], { stdio: ['ignore', 'ignore', 'pipe'] })
}

// ─── one-shot percussion (WAV: no mp3 encoder delay on the transient) ────────
const HITS = [
  // tabla bols, ajaysm (CC-BY 4.0)
  ['tabla-dha', FS(171900, 2385996), {}], ['tabla-dhin', FS(171904, 2385996), {}],
  ['tabla-na', FS(171905, 2385996), {}], ['tabla-tin', FS(171911, 2385996), {}],
  ['tabla-tun', FS(171909, 2385996), {}], ['tabla-ge', FS(171902, 2385996), {}],
  ['tabla-ke', FS(171906, 2385996), {}], ['tabla-te', FS(171913, 2385996), {}],
  // dholak, curesforbrokenhearts (CC0)
  ['dholak-bass', FS(536872, 8738244), { len: 1.2 }], ['dholak-treble', FS(536871, 8738244), { len: 1.2 }],
  // mridangam + morsing strokes sliced from ajaysm phrases (CC0)
  ['mridangam-thom', FS(194579, 2385996), { start: 7.695, len: 0.37, fade: 0.08 }],
  ['mridangam-nam', FS(194579, 2385996), { start: 2.112, len: 0.35, fade: 0.08 }],
  ['mridangam-dheem', FS(194579, 2385996), { start: 6.245, len: 0.38, fade: 0.08 }],
  ['morsing', FS(191506, 2385996), { start: 2.582, len: 0.38, fade: 0.1 }],
]

// ─── melodic instruments: [dir, note, url, opts] ────────────────────────────
const NOTES = []
const tj = (dir, inst, notes, opts = {}) => notes.forEach((n) => NOTES.push([dir, n, TJ(inst, n), opts]))

// Indian (Freesound CC0 unless noted). Sitar notes are the main-string pitch;
// the ringing C/G partials are its sympathetic strings (tuned to Sa = C).
NOTES.push(
  ['sitar', 'C#3', FS(87435, 377011), { len: 1.35, fade: 0.3 }],
  ['sitar', 'E3', FS(87436, 377011), { len: 1.5, fade: 0.3 }],
  ['santoor', 'C4', FS(258090, 252156), { start: 0.0, len: 0.56, fade: 0.2 }],
  ['santoor', 'D#4', FS(258090, 252156), { start: 0.74, len: 0.64, fade: 0.2 }],
  ['santoor', 'G4', FS(258090, 252156), { start: 1.91, len: 0.9, fade: 0.25 }],
  ['santoor', 'F4', FS(258090, 252156), { start: 2.83, len: 1.25, fade: 0.4, cents: -7 }],
  ['sarangi', 'C4', FS(167023, 1), { len: 3.5, fade: 0.4, cents: -5 }],
  ['sarangi', 'G#4', FS(167088, 1), { len: 3.5, fade: 0.4, cents: 13 }],
  // bansuri, sankalp (CC-BY 4.0)
  ['bansuri', 'E4', FS(179695, 1859932), { start: 0.5, len: 3.2, fade: 0.4, cents: -40 }],
  ['bansuri', 'E5', FS(179696, 1859932), { start: 0.9, len: 3.2, fade: 0.4, cents: -21 }],
  ['tanpura', 'A#2', FS(416606, 2112203), { len: 5, fade: 0.8, cents: 3 }],
  ['tanpura', 'E3', FS(148850, 1558892), { start: 2, len: 6, fade: 0.8, cents: 42 }],
)
// Orchestral / band (tonejs-instruments, CC-BY 3.0)
tj('harmonium', 'harmonium', ['C2', 'E2', 'G#2', 'C3', 'E3', 'G#3', 'C4', 'E4', 'G#4', 'C5'], { len: 2.5 })
tj('violin', 'violin', ['G3', 'C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6'], { len: 2.5 })
tj('cello', 'cello', ['C2', 'E2', 'A2', 'C3', 'E3', 'A3', 'C4', 'E4'], { len: 2.5 })
tj('flute', 'flute', ['C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6'], { len: 2.5 })
tj('guitar-acoustic', 'guitar-acoustic', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'A4'], { len: 2.5 })
tj('guitar-nylon', 'guitar-nylon', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'A4', 'E5'], { len: 2.5 })
tj('guitar-electric', 'guitar-electric', ['E2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5'], { len: 2.5 })
tj('bass-electric', 'bass-electric', ['E1', 'G1', 'A#1', 'C#2', 'E2', 'G2', 'A#2', 'C#3', 'E3', 'G3'], { len: 2 })
tj('harp', 'harp', ['D2', 'F2', 'A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5'], { len: 2.5 })
tj('sax', 'saxophone', ['C#3', 'E3', 'G3', 'A#3', 'C#4', 'E4', 'G4', 'A#4', 'C#5', 'E5'], { len: 2.2 })
tj('trumpet', 'trumpet', ['F3', 'A3', 'C4', 'D#4', 'F4', 'G4', 'A#4', 'D5', 'F5'], { len: 2 })
tj('xylophone', 'xylophone', ['G4', 'C5', 'G5', 'C6', 'G6', 'C7'], { len: 1.5 })

rmSync(OUT, { recursive: true, force: true })
for (const [name, url, opts] of HITS) {
  render(await download(url), join(OUT, 'perc', `${name}.wav`), { len: 1, fade: 0.05, ...opts, wav: true })
  console.log('perc', name)
}
for (const [dir, note, url, opts] of NOTES) {
  render(await download(url), join(OUT, dir, `${note.replace('#', 's')}.mp3`), opts)
  console.log(dir, note)
}
