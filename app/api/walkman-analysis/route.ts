import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

// Song analysis for the Walkman background, on demand.
//
// Shelf songs ship pre-analysed in /public/lab/walkman/analysis (the page
// fetches those directly). Anything else is analysed here the first time it's
// played, by scripts/walkman_analyse.py (needs python + numpy, yt-dlp, ffmpeg),
// and cached in .cache/. That only happens where those tools exist, i.e. while
// developing; in production this answers 404 and the page uses its auto groove.

export const maxDuration = 60

// turbopackIgnore: these paths are only used at runtime in development. Without
// it the build traces process.cwd() and bundles the whole project (every image,
// font and model) into this function, past Vercel's 250 MB limit.
const ROOT = /* turbopackIgnore: true */ process.cwd()
const CACHE = path.join(/* turbopackIgnore: true */ ROOT, '.cache', 'walkman-analysis')
const SCRIPT = path.join(/* turbopackIgnore: true */ ROOT, 'scripts', 'walkman_analyse.py')
const canAnalyse = process.env.NODE_ENV === 'development' || process.env.WALKMAN_ANALYSE === '1'
const PYTHON = process.env.WALKMAN_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')

// one analysis per song at a time, however many requests ask for it
const inflight = new Map<string, Promise<boolean>>()

function analyse(id: string): Promise<boolean> {
  let job = inflight.get(id)
  if (!job) {
    job = new Promise<boolean>((resolve) => {
      const child = spawn(PYTHON, [SCRIPT, id, '--out', CACHE], { cwd: ROOT, windowsHide: true })
      const timer = setTimeout(() => child.kill(), 55_000)
      child.on('error', () => { clearTimeout(timer); resolve(false) })
      child.on('close', (code) => { clearTimeout(timer); resolve(code === 0) })
    }).finally(() => inflight.delete(id))
    inflight.set(id, job)
  }
  return job
}

async function readCached(id: string): Promise<Buffer | null> {
  const file = path.join(/* turbopackIgnore: true */ CACHE, `${id}.wma`)
  try {
    await stat(file)
    return await readFile(file)
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? ''
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 })

  let data = await readCached(id)
  if (!data && canAnalyse && (await analyse(id))) data = await readCached(id)
  if (!data) return NextResponse.json({ error: 'not analysed' }, { status: 404 })

  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' },
  })
}
