// Studio-Kapi — self-contained ".kapi" project file (no dependencies).
//
// Layout:  [ "KAPI" ][ u32 version ][ u32 manifestBytes ][ manifest JSON ][ audio… ]
// The manifest lists every audio part in order with its byte size; the raw
// WAV bytes follow the JSON back-to-back so we can slice them out on load.

import type { ProjectState } from './types'

const MAGIC = 'KAPI'
const VERSION = 1

export interface SavedTakeMeta {
  id: string
  name: string
  seconds: number
  cleaned?: boolean
  key: string          // -> parts[] key
}

export interface SavedAudioTrack {
  trackId: string
  key: string
}

export interface ProjectManifest {
  version: number
  savedAt: string
  project: ProjectState
  takes: SavedTakeMeta[]
  audioTracks: SavedAudioTrack[]
  parts: { key: string; size: number }[]   // ordered audio payloads
}

export interface AudioPart { key: string; blob: Blob }

export function packProject(manifest: Omit<ProjectManifest, 'parts' | 'version' | 'savedAt'>, audioParts: AudioPart[]): Blob {
  const parts = audioParts.map((p) => ({ key: p.key, size: p.blob.size }))
  const full: ProjectManifest = { version: VERSION, savedAt: new Date().toISOString(), parts, ...manifest }
  const manifestBytes = new TextEncoder().encode(JSON.stringify(full))
  const header = new ArrayBuffer(12)
  const hv = new DataView(header)
  for (let i = 0; i < 4; i++) hv.setUint8(i, MAGIC.charCodeAt(i))
  hv.setUint32(4, VERSION, true)
  hv.setUint32(8, manifestBytes.byteLength, true)
  return new Blob([header, manifestBytes, ...audioParts.map((p) => p.blob)], { type: 'application/octet-stream' })
}

export async function unpackProject(file: Blob): Promise<{ manifest: ProjectManifest; parts: Map<string, Blob> }> {
  if (file.size < 12) throw new Error('Not a Studio Kapi project file.')
  const hv = new DataView(await file.slice(0, 12).arrayBuffer())
  let magic = ''
  for (let i = 0; i < 4; i++) magic += String.fromCharCode(hv.getUint8(i))
  if (magic !== MAGIC) throw new Error('This file is not a Studio Kapi project (.kapi).')
  const manifestLen = hv.getUint32(8, true)
  const manifestBytes = await file.slice(12, 12 + manifestLen).arrayBuffer()
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as ProjectManifest
  const parts = new Map<string, Blob>()
  let off = 12 + manifestLen
  for (const pr of manifest.parts) {
    parts.set(pr.key, file.slice(off, off + pr.size, 'audio/wav'))
    off += pr.size
  }
  return { manifest, parts }
}
