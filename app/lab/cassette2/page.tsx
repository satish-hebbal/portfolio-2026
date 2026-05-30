'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
    ytPlayer: any
  }
}

function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=|youtube\.com\/embed\/)([^&\n?#]+)/
  )
  return match ? match[1] : null
}

// ─── dev params ───────────────────────────────────────────────────────────────

interface DevParams {
  texRotation: number
  texOffsetX: number
  texOffsetY: number
  texRepeatX: number
  texRepeatY: number
  canvasRotation: number
  canvasW: number
  canvasH: number
  fontSize: number
  textX: number
  textY: number
  flipY: boolean
  mirrorX: boolean
  emissiveIntensity: number
  showBorder: boolean
}

const defaultDevParams: DevParams = {
  texRotation: -1.576,
  texOffsetX: -0.33,
  texOffsetY: 0.275,
  texRepeatX: 2,
  texRepeatY: 1,
  canvasRotation: 3.138,
  canvasW: 204,
  canvasH: 64,
  fontSize: 4,
  textX: 1,
  textY: -2,
  flipY: true,
  mirrorX: false,
  emissiveIntensity: 1.6,
  showBorder: false,
}

// ─── canvas texture display ───────────────────────────────────────────────────

function createDisplayUpdater(mesh: THREE.Mesh, devParamsRef: { current: DevParams }) {
  const canvas = document.createElement('canvas')
  canvas.width = defaultDevParams.canvasW
  canvas.height = defaultDevParams.canvasH
  const ctx = canvas.getContext('2d')!

  let interval: ReturnType<typeof setInterval> | null = null
  let cursorOn = true
  let lastText = 'PASTE URL'
  let lastBlinking = true

  let isScrolling = false
  let scrollText = ''
  let scrollOffset = 0
  let lastTextWidth = 100

  function draw(text: string, showCursor: boolean, scrollX?: number) {
    const p = devParamsRef.current
    const cw = Math.max(1, Math.round(p.canvasW))
    const ch = Math.max(1, Math.round(p.canvasH))

    if (canvas.width !== cw) canvas.width = cw
    if (canvas.height !== ch) canvas.height = ch

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, cw, ch)

    if (p.showBorder) {
      ctx.strokeStyle = '#ff00ff'
      ctx.lineWidth = Math.max(2, Math.round(cw / 64))
      ctx.strokeRect(1, 1, cw - 2, ch - 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch)
      ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2)
      ctx.stroke()
      const ms = Math.max(4, Math.round(cw / 20))
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, ms, ms)
      const tx = cw / 2 + p.textX
      const ty = ch / 2 + p.textY
      ctx.strokeStyle = '#00ffff'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(tx - 8, ty); ctx.lineTo(tx + 8, ty)
      ctx.moveTo(tx, ty - 8); ctx.lineTo(tx, ty + 8)
      ctx.stroke()
      ctx.fillStyle = '#00ffff'
      ctx.fillRect(tx - 2, ty - 2, 4, 4)
    }

    ctx.save()
    const fs = Math.max(1, Math.round(p.fontSize))
    const xCenter = scrollX !== undefined ? scrollX : (cw / 2 + p.textX)
    ctx.translate(xCenter, ch / 2 + p.textY)
    ctx.rotate(p.canvasRotation)
    if (p.mirrorX) ctx.scale(-1, 1)
    ctx.imageSmoothingEnabled = false
    ctx.font = `${fs}px "Press Start 2P", monospace`
    ctx.fillStyle = '#00ff88'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    const displayChars = (scrollX !== undefined ? text : text.slice(0, 14)).split('')
    const charW = ctx.measureText('W').width || fs * 0.6
    const spacing = charW * 1.2
    lastTextWidth = displayChars.length * spacing

    const xStart = scrollX !== undefined ? 0 : -lastTextWidth / 2
    displayChars.forEach((ch, i) => {
      ctx.fillText(ch, xStart + i * spacing, 0)
    })

    if (showCursor && scrollX === undefined) {
      const curH = Math.round(fs * 1.2)
      ctx.fillRect(xStart + lastTextWidth + 2, -curH / 2, 2, curH)
    }
    ctx.restore()

    tex.flipY = p.flipY
    tex.rotation = p.texRotation
    tex.center.set(0.5, 0.5)
    tex.offset.set(p.texOffsetX, p.texOffsetY)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(p.texRepeatX, p.texRepeatY)
    tex.needsUpdate = true

    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.emissiveIntensity = p.emissiveIntensity
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.flipY = defaultDevParams.flipY
  tex.rotation = defaultDevParams.texRotation
  tex.center.set(0.5, 0.5)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping

  mesh.material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x000000),
    emissiveMap: tex,
    emissive: new THREE.Color(1, 1, 1),
    emissiveIntensity: defaultDevParams.emissiveIntensity,
    roughness: 0,
    metalness: 0,
  })
  ;(mesh.material as THREE.Material).needsUpdate = true

  function updateDisplay(text: string, blinking = false) {
    lastText = text
    lastBlinking = blinking
    isScrolling = false
    if (interval) { clearInterval(interval); interval = null }
    if (blinking) {
      cursorOn = true
      draw(text, true)
      interval = setInterval(() => {
        cursorOn = !cursorOn
        draw(text, cursorOn)
      }, 500)
    } else {
      draw(text, false)
    }
  }

  function redrawCurrent() {
    if (isScrolling) return
    updateDisplay(lastText, lastBlinking)
  }

  function startScroll(text: string) {
    if (interval) { clearInterval(interval); interval = null }
    isScrolling = true
    scrollText = text
    const p = devParamsRef.current
    scrollOffset = Math.max(1, Math.round(p.canvasW))
  }

  function stopScroll() {
    isScrolling = false
  }

  function tickScroll() {
    if (!isScrolling) return
    const p = devParamsRef.current
    const cw = Math.max(1, Math.round(p.canvasW))
    scrollOffset -= 0.5
    if (scrollOffset < -(lastTextWidth + 50)) scrollOffset = cw
    draw(scrollText, false, scrollOffset)
  }

  function dispose() {
    if (interval) clearInterval(interval)
    tex.dispose()
    ;(mesh.material as THREE.MeshStandardMaterial).dispose()
  }

  return { updateDisplay, redrawCurrent, startScroll, stopScroll, tickScroll, dispose }
}

// ─── dev panel ────────────────────────────────────────────────────────────────

function DevPanel({
  devParamsRef,
  onParamsChange,
}: {
  devParamsRef: { current: DevParams }
  onParamsChange: () => void
}) {
  if (process.env.NODE_ENV !== 'development') return null

  const [params, setParams] = useState<DevParams>({ ...devParamsRef.current })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [pos, setPos] = useState({ x: 16, y: 16 })
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  type SliderKey = Exclude<keyof DevParams, 'flipY' | 'showBorder'>
  const sliders: { key: SliderKey; min: number; max: number; step: number; label: string }[] = [
    { key: 'texRotation',       min: -Math.PI, max: Math.PI, step: 0.001, label: 'tex rotation'    },
    { key: 'texOffsetX',        min: -1,       max: 1,       step: 0.005, label: 'tex offset X'    },
    { key: 'texOffsetY',        min: -1,       max: 1,       step: 0.005, label: 'tex offset Y'    },
    { key: 'texRepeatX',        min: 0.1,      max: 4,       step: 0.05,  label: 'tex repeat X'    },
    { key: 'texRepeatY',        min: 0.1,      max: 4,       step: 0.05,  label: 'tex repeat Y'    },
    { key: 'canvasRotation',    min: -Math.PI, max: Math.PI, step: 0.001, label: 'canvas rotation' },
    { key: 'canvasW',           min: 16,       max: 1024,    step: 1,     label: 'canvas W'        },
    { key: 'canvasH',           min: 16,       max: 1024,    step: 1,     label: 'canvas H'        },
    { key: 'emissiveIntensity', min: 0,        max: 10,      step: 0.1,   label: 'emissive'        },
    { key: 'fontSize',          min: 0,        max: 120,     step: 1,     label: 'font size'       },
    { key: 'textX',             min: -512,     max: 512,     step: 1,     label: 'text X'          },
    { key: 'textY',             min: -512,     max: 512,     step: 1,     label: 'text Y'          },
  ]

  const isInt = (k: SliderKey) => k === 'fontSize' || k === 'textX' || k === 'textY' || k === 'canvasW' || k === 'canvasH'
  const fmt = (k: SliderKey, v: number) => isInt(k) ? String(v) : v.toFixed(3)

  const applyValue = (key: SliderKey, raw: string) => {
    const val = parseFloat(raw)
    if (isNaN(val)) return
    const cfg = sliders.find(s => s.key === key)!
    const clamped = Math.max(cfg.min, Math.min(cfg.max, val))
    const next = { ...params, [key]: clamped }
    setParams(next)
    devParamsRef.current = next
    onParamsChange()
  }

  const update = (key: SliderKey, val: number) => {
    const next = { ...params, [key]: val }
    setParams(next)
    setDrafts(d => ({ ...d, [key]: fmt(key, val) }))
    devParamsRef.current = next
    onParamsChange()
  }

  const toggleBool = (key: 'flipY' | 'mirrorX' | 'showBorder') => {
    const next = { ...params, [key]: !params[key] }
    setParams(next)
    devParamsRef.current = next
    onParamsChange()
  }

  const reset = () => {
    setParams({ ...defaultDevParams })
    setDrafts({})
    devParamsRef.current = { ...defaultDevParams }
    onParamsChange()
  }

  const copyValues = () => {
    const out = JSON.stringify(devParamsRef.current, null, 2)
    navigator.clipboard?.writeText(out).catch(() => {})
    console.log('Dev params:', out)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setPos({ x: dragStart.current.px + ev.clientX - dragStart.current.mx, y: dragStart.current.py + ev.clientY - dragStart.current.my })
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const btn = (accent?: boolean): React.CSSProperties => ({
    background: accent ? '#00ff88' : 'rgba(255,255,255,0.08)',
    color: accent ? '#000' : '#ccc',
    border: accent ? 'none' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: 5, padding: '4px 10px', fontSize: 10,
    cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700,
    letterSpacing: '0.04em', whiteSpace: 'nowrap' as const,
  })

  const toggleStyle = (on: boolean): React.CSSProperties => ({
    background: on ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${on ? 'rgba(0,255,136,0.4)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 5, padding: '5px 10px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  })

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, width: 310,
      background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      fontFamily: 'monospace', fontSize: 11, color: '#ddd',
      userSelect: 'none', overflow: 'hidden',
    }}>
      {/* Header */}
      <div onMouseDown={onMouseDown} style={{
        padding: '9px 12px', background: 'rgba(255,255,255,0.05)',
        borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.07)',
        cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff88', display: 'inline-block' }} />
          <span style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff' }}>
            Texture Debug
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5 }} onMouseDown={e => e.stopPropagation()}>
          <button onClick={reset} style={btn()}>Reset</button>
          <button onClick={copyValues} style={btn(true)}>{copied ? 'Copied!' : 'Copy'}</button>
          <button onClick={() => setCollapsed(c => !c)} style={{ ...btn(), padding: '4px 8px', color: '#666' }}>
            {collapsed ? '▾' : '▴'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Sliders */}
          {sliders.map(({ key, min, max, step, label }) => {
            const val = params[key] as number
            const draft = drafts[key] ?? fmt(key, val)
            return (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: '#777', fontSize: 10 }}>{label}</span>
                  <input
                    type="text" value={draft}
                    onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                    onBlur={e => { applyValue(key, e.target.value); setDrafts(d => { const n = { ...d }; delete n[key]; return n }) }}
                    onKeyDown={e => { if (e.key === 'Enter') { applyValue(key, (e.target as HTMLInputElement).value); setDrafts(d => { const n = { ...d }; delete n[key]; return n }); (e.target as HTMLInputElement).blur() } }}
                    style={{ width: 64, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, color: '#00ff88', fontSize: 10, fontFamily: 'monospace', padding: '2px 5px', textAlign: 'right', outline: 'none' }}
                  />
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={e => update(key, parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#00ff88', cursor: 'pointer', margin: 0 }}
                />
                {key === 'canvasRotation' && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                    {([
                      { label: '↺ -90°', act: (c: number) => c - Math.PI / 2 },
                      { label: '↻ +90°', act: (c: number) => c + Math.PI / 2 },
                      { label: '↕ 180°', act: (c: number) => c + Math.PI },
                      { label: '⇄ flip', act: (c: number) => -c },
                      { label: '0',      act: () => 0 },
                    ] as { label: string; act: (c: number) => number }[]).map(({ label, act }) => (
                      <button key={label} onClick={() => update('canvasRotation', Math.max(-Math.PI, Math.min(Math.PI, act(params.canvasRotation))))}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#aaa', fontSize: 9, fontFamily: 'monospace', cursor: 'pointer', padding: '3px 0' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            <button onClick={() => toggleBool('flipY')} style={toggleStyle(params.flipY)}>
              <span style={{ color: '#777', fontSize: 10 }}>tex flipY</span>
              <span style={{ color: params.flipY ? '#00ff88' : '#555', fontSize: 10, fontWeight: 700 }}>{params.flipY ? 'true' : 'false'}</span>
            </button>
            <button onClick={() => toggleBool('mirrorX')} style={toggleStyle(params.mirrorX)}>
              <span style={{ color: '#777', fontSize: 10 }}>canvas mirror X</span>
              <span style={{ color: params.mirrorX ? '#00ff88' : '#555', fontSize: 10, fontWeight: 700 }}>{params.mirrorX ? 'ON' : 'OFF'}</span>
            </button>
            <button onClick={() => toggleBool('showBorder')} style={toggleStyle(params.showBorder)}>
              <span style={{ color: '#777', fontSize: 10 }}>show canvas border</span>
              <span style={{ color: params.showBorder ? '#00ff88' : '#555', fontSize: 10, fontWeight: 700 }}>{params.showBorder ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Border legend */}
          {params.showBorder && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '7px 9px', fontSize: 9, color: '#666', lineHeight: 1.8 }}>
              <div><span style={{ color: '#ff00ff' }}>■</span> magenta border = canvas edge</div>
              <div><span style={{ color: '#ff0000' }}>■</span> red square = canvas origin (0,0)</div>
              <div><span style={{ color: '#00ffff' }}>+</span> cyan crosshair = text anchor point</div>
              <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>+</span> white cross = canvas center (256,256)</div>
            </div>
          )}

          {/* Defaults reference */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8, color: '#444', fontSize: 9, lineHeight: 1.7 }}>
            {sliders.map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{label}</span>
                <span style={{ color: '#555' }}>{fmt(key, defaultDevParams[key] as number)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── walkman model ────────────────────────────────────────────────────────────

interface WalkmanProps {
  onPasteClick: () => void
  onPlayPause: () => void
  onMuteToggle: () => void
  onStop: () => void
  onForward: () => void
  onRewind: () => void
  onVolumeChange: (vol: number) => void
  onVolumeEnd: () => void
  onReady: (fn: (text: string, blinking?: boolean) => void, redraw: () => void, startScroll: (text: string) => void) => void
  devParamsRef: { current: DevParams }
}

function WalkmanModel({ onPasteClick, onPlayPause, onMuteToggle, onStop, onForward, onRewind, onVolumeChange, onVolumeEnd, onReady, devParamsRef }: WalkmanProps) {
  const { scene } = useGLTF('/models/walkman/walkman.glb')

  const disposeRef = useRef<(() => void) | null>(null)
  const onPasteClickRef = useRef(onPasteClick)
  const onPlayPauseRef = useRef<(() => void) | null>(null)
  const onMuteToggleRef = useRef<(() => void) | null>(null)
  const onStopRef = useRef<(() => void) | null>(null)
  const onForwardRef = useRef<(() => void) | null>(null)
  const onRewindRef = useRef<(() => void) | null>(null)
  const onVolumeChangeRef = useRef(onVolumeChange)
  const onVolumeEndRef = useRef(onVolumeEnd)
  useEffect(() => { onPasteClickRef.current = onPasteClick }, [onPasteClick])
  useEffect(() => {
    onPlayPauseRef.current = onPlayPause
    onMuteToggleRef.current = onMuteToggle
    onStopRef.current = onStop
    onForwardRef.current = onForward
    onRewindRef.current = onRewind
  }, [onPlayPause, onMuteToggle, onStop, onForward, onRewind])
  useEffect(() => { onVolumeChangeRef.current = onVolumeChange }, [onVolumeChange])
  useEffect(() => { onVolumeEndRef.current = onVolumeEnd }, [onVolumeEnd])

  const btnGroups = useRef<Record<string, THREE.Object3D[]>>({ paste: [], play: [], stop: [], forward: [], rewind: [] })
  const btnOriginals = useRef<Map<THREE.Object3D, { scale: THREE.Vector3; pos: THREE.Vector3 }>>(new Map())
  const animatingGroup = useRef<THREE.Object3D[]>([])
  const btnPress = useRef(0)

  const isDraggingSlider = useRef(false)
  const sliderStartY = useRef(0)
  const sliderStartVol = useRef(50)

  const tickScrollRef = useRef<() => void>(() => {})
  const stopScrollRef = useRef<() => void>(() => {})
  const wasPlayingRef = useRef(false)
  const isHovered = useRef(false)

  useEffect(() => {
    scene.rotation.y = 4.4
    scene.rotation.x = 0.9084
    scene.scale.setScalar(2.35)

    const box = new THREE.Box3().setFromObject(scene)
    const center = new THREE.Vector3()
    box.getCenter(center)
    scene.position.set(0.03 - center.x, -1.07, -center.z)

    let screenMesh: THREE.Mesh | null = null
    btnGroups.current = { paste: [], play: [], stop: [], forward: [], rewind: [] }
    btnOriginals.current = new Map()
    animatingGroup.current = []

    scene.traverse((obj) => {
      const n = obj.name

      if ((obj as THREE.Mesh).isMesh && /button|slider/i.test(n)) {
        console.log('control:', n)
      }

      const addToGroup = (group: string) => {
        btnGroups.current[group].push(obj)
        btnOriginals.current.set(obj, { scale: obj.scale.clone(), pos: obj.position.clone() })
      }
      if (n === 'Paste_click_button' || n === 'Cube003' || n === 'Cube003_1') addToGroup('paste')
      else if (n.includes('Button1_low001')) addToGroup('play')
      else if (n.includes('Button2_low001')) addToGroup('stop')
      else if (n.includes('Button3_low001')) addToGroup('forward')
      else if (n.includes('Button4_low001')) addToGroup('rewind')

      if (n === '8Bit_screen') screenMesh = obj as THREE.Mesh

      if (n !== '8Bit_screen' && (obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        const solidify = (m: THREE.Material) => {
          m.side = THREE.DoubleSide
          m.transparent = false
          m.depthWrite = true
          if (m instanceof THREE.MeshStandardMaterial) { m.opacity = 1; m.alphaTest = 0 }
          m.needsUpdate = true
        }
        if (Array.isArray(mesh.material)) mesh.material.forEach(solidify)
        else if (mesh.material) solidify(mesh.material)
      }
    })

    if (screenMesh) {
      const { updateDisplay, redrawCurrent, startScroll, stopScroll, tickScroll, dispose } = createDisplayUpdater(screenMesh as THREE.Mesh, devParamsRef)
      disposeRef.current = dispose
      tickScrollRef.current = tickScroll
      stopScrollRef.current = stopScroll
      onReady(updateDisplay, redrawCurrent, startScroll)
      updateDisplay('PASTE URL', true)
      document.fonts.load('4px "Press Start 2P"').then(() => {
        updateDisplay('PASTE URL', true)
      })
    }

    return () => { disposeRef.current?.() }
  }, [scene])

  useFrame((_, delta) => {
    const playing = window.ytPlayer?.getPlayerState?.() === 1
    if (playing) {
      tickScrollRef.current()
    }
    if (!playing && wasPlayingRef.current) stopScrollRef.current()
    wasPlayingRef.current = playing

    if (btnPress.current > 0) {
      btnPress.current = Math.max(0, btnPress.current - delta * 9)
      const t = Math.sin(btnPress.current * Math.PI)
      animatingGroup.current.forEach((mesh) => {
        const orig = btnOriginals.current.get(mesh)
        if (!orig) return
        mesh.scale.set(orig.scale.x * (1 - t * 0.08), orig.scale.y * (1 - t * 0.05), orig.scale.z * (1 - t * 0.08))
        mesh.position.copy(orig.pos)
        mesh.position.y -= t * 0.008
      })
      if (btnPress.current === 0) {
        animatingGroup.current.forEach((mesh) => {
          const orig = btnOriginals.current.get(mesh)
          if (orig) { mesh.scale.copy(orig.scale); mesh.position.copy(orig.pos) }
        })
        animatingGroup.current = []
      }
    }
  })

  const isBtn = (name: string) =>
    name === 'Paste_click_button' || name === 'Cube003' || name === 'Cube003_1' ||
    name.includes('Button1_low001') || name.includes('Button2_low001') ||
    name.includes('Button3_low001') || name.includes('Button4_low001') ||
    name.includes('Slider1_low001') || name.includes('Slider2_low001')

  const isSliderMesh = (name: string) =>
    name.includes('Slider1_low001') || name.includes('Slider2_low001')

  const pressGroup = (n: string) => {
    btnPress.current = 1
    if (n === 'Paste_click_button' || n === 'Cube003' || n === 'Cube003_1')
      animatingGroup.current = btnGroups.current.paste
    else if (n.includes('Button1_low001')) animatingGroup.current = btnGroups.current.play
    else if (n.includes('Button2_low001')) animatingGroup.current = btnGroups.current.stop
    else if (n.includes('Button3_low001')) animatingGroup.current = btnGroups.current.forward
    else if (n.includes('Button4_low001')) animatingGroup.current = btnGroups.current.rewind
  }

  const handlePointerOver = useCallback((e: any) => {
    if (isBtn(e.object?.name ?? '')) { document.body.style.cursor = 'pointer'; isHovered.current = true }
  }, [])

  const handlePointerOut = useCallback((e: any) => {
    if (isBtn(e.object?.name ?? '')) { document.body.style.cursor = 'default'; isHovered.current = false }
  }, [])

  const handlePointerDown = useCallback((e: any) => {
    const n = e.object?.name ?? ''
    if (isSliderMesh(n)) {
      e.stopPropagation()
      isDraggingSlider.current = true
      sliderStartY.current = e.clientY ?? 0
      sliderStartVol.current = window.ytPlayer?.getVolume?.() ?? 50
    } else if (isBtn(n)) {
      e.stopPropagation()
      pressGroup(n)
    }
  }, [])

  const handlePointerMove = useCallback((e: any) => {
    if (!isDraggingSlider.current) return
    const dy = sliderStartY.current - (e.clientY ?? 0)
    const newVol = Math.max(0, Math.min(100, sliderStartVol.current + dy))
    onVolumeChangeRef.current(Math.round(newVol))
  }, [])

  const handlePointerUp = useCallback(() => {
    if (isDraggingSlider.current) {
      isDraggingSlider.current = false
      onVolumeEndRef.current()
    }
  }, [])

  const handleClick = useCallback((e: any) => {
    e.stopPropagation()
    const name = e.object?.name ?? ''
    if (name === 'Paste_click_button' || name === 'Cube003' || name === 'Cube003_1') {
      pressGroup(name); onPasteClickRef.current()
    } else if (name.includes('Button1_low001')) {
      pressGroup(name); onMuteToggleRef.current?.()
    } else if (name.includes('Button2_low001')) {
      pressGroup(name); onForwardRef.current?.()
    } else if (name.includes('Button3_low001')) {
      pressGroup(name); onRewindRef.current?.()
    } else if (name.includes('Button4_low001')) {
      pressGroup(name); onPlayPauseRef.current?.()
    }
  }, [])

  return (
    <primitive
      object={scene}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  )
}

useGLTF.preload('/models/walkman/walkman.glb')

// ─── retro status display ─────────────────────────────────────────────────────

function RetroStatus({ status }: { status: string }) {
  const [dotCount, setDotCount] = useState(0)

  useEffect(() => {
    if (status !== 'PLAYING') { setDotCount(0); return }
    const id = setInterval(() => setDotCount(n => (n + 1) % 4), 380)
    return () => clearInterval(id)
  }, [status])

  if (!status) return null

  const map: Record<string, { icon: string; color: string }> = {
    PLAYING:  { icon: '►',   color: 'rgba(0,160,75,1)'     },
    PAUSED:   { icon: '❚❚',  color: 'rgba(160,110,0,0.85)' },
    MUTED:    { icon: '⊘',   color: 'rgba(200,50,50,0.9)'  },
    UNMUTED:  { icon: '♪',   color: 'rgba(0,150,120,0.9)'  },
    '+10s':   { icon: '▶▶',  color: 'rgba(40,100,210,0.9)' },
    '-10s':   { icon: '◀◀',  color: 'rgba(40,100,210,0.9)' },
    LOADING:  { icon: '○',   color: 'rgba(0,0,0,0.38)'     },
  }

  const { icon, color } = map[status] ?? { icon: '·', color: 'rgba(0,0,0,0.38)' }
  const trail = status === 'PLAYING' ? '.'.repeat(dotCount).padEnd(3, ' ') : ''

  return (
    <span style={{
      fontFamily: '"Courier New", monospace',
      fontSize: 11, letterSpacing: '0.14em', color,
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {icon}&nbsp;{status}{trail}
    </span>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Cassette2() {
  const [url, setUrl] = useState('')
  const [displayStatus, setDisplayStatus] = useState('')
  const [apiReady, setApiReady] = useState(false)
  const updateDisplayRef = useRef<((text: string, blinking?: boolean) => void) | null>(null)
  const redrawCurrentRef = useRef<(() => void) | null>(null)
  const startScrollRef = useRef<((text: string) => void) | null>(null)
  const currentUrlRef = useRef('')
  const devParamsRef = useRef<DevParams>({ ...defaultDevParams })
  const urlRef = useRef(url)
  useEffect(() => { urlRef.current = url }, [url])

  useEffect(() => {
    if (!document.querySelector('link[href*="Press+Start+2P"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    if ((window as any).YT?.Player) { setApiReady(true); return }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { setApiReady(true); prev?.() }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  }, [])

  const apiReadyRef = useRef(apiReady)
  useEffect(() => { apiReadyRef.current = apiReady }, [apiReady])

  const handlePlayPause = useCallback(() => {
    if (!window.ytPlayer) return
    const state = window.ytPlayer.getPlayerState?.()
    if (state === 1) {
      window.ytPlayer.pauseVideo()
      updateDisplayRef.current?.('PAUSED', false)
      setDisplayStatus('PAUSED')
    } else {
      window.ytPlayer.playVideo()
      updateDisplayRef.current?.(urlRef.current, false)
    }
  }, [setDisplayStatus])

  const handleMuteToggle = useCallback(() => {
    if (!window.ytPlayer) return
    if (window.ytPlayer.isMuted?.()) {
      window.ytPlayer.unMute()
      updateDisplayRef.current?.('UNMUTED', false)
      setDisplayStatus('UNMUTED')
    } else {
      window.ytPlayer.mute()
      updateDisplayRef.current?.('MUTED', false)
      setDisplayStatus('MUTED')
    }
    setTimeout(() => {
      const st = window.ytPlayer?.getPlayerState?.()
      if (st === 1) { startScrollRef.current?.(currentUrlRef.current); setDisplayStatus('PLAYING') }
      else if (st === 2) { updateDisplayRef.current?.('PAUSED', false); setDisplayStatus('PAUSED') }
      else { updateDisplayRef.current?.('PASTE URL', true); setDisplayStatus('') }
    }, 1000)
  }, [setDisplayStatus])

  const handleStop = useCallback(() => {
    window.ytPlayer?.stopVideo?.()
    updateDisplayRef.current?.('PASTE URL', true)
    setDisplayStatus('')
  }, [setDisplayStatus])

  const handleForward = useCallback(() => {
    const t = window.ytPlayer?.getCurrentTime?.() ?? 0
    window.ytPlayer?.seekTo?.(t + 10, true)
    updateDisplayRef.current?.('+10s', false)
    setDisplayStatus('+10s')
    setTimeout(() => {
      updateDisplayRef.current?.(urlRef.current || 'PASTE URL', !urlRef.current)
      const st = window.ytPlayer?.getPlayerState?.()
      setDisplayStatus(st === 1 ? 'PLAYING' : st === 2 ? 'PAUSED' : '')
    }, 1000)
  }, [setDisplayStatus])

  const handleRewind = useCallback(() => {
    const t = window.ytPlayer?.getCurrentTime?.() ?? 0
    window.ytPlayer?.seekTo?.(Math.max(0, t - 10), true)
    updateDisplayRef.current?.('-10s', false)
    setDisplayStatus('-10s')
    setTimeout(() => {
      updateDisplayRef.current?.(urlRef.current || 'PASTE URL', !urlRef.current)
      const st = window.ytPlayer?.getPlayerState?.()
      setDisplayStatus(st === 1 ? 'PLAYING' : st === 2 ? 'PAUSED' : '')
    }, 1000)
  }, [setDisplayStatus])

  const handleVolumeChange = useCallback((vol: number) => {
    window.ytPlayer?.setVolume?.(vol)
    updateDisplayRef.current?.(`VOL: ${vol}`, false)
  }, [])

  const handleVolumeEnd = useCallback(() => {
    const state = window.ytPlayer?.getPlayerState?.()
    if (state === 1) {
      startScrollRef.current?.(currentUrlRef.current)
    } else if (state === 2) {
      updateDisplayRef.current?.('PAUSED', false)
    } else {
      updateDisplayRef.current?.('PASTE URL', true)
    }
  }, [])

  const stableHandlePasteClick = useCallback(async () => {
    let trimmed = urlRef.current.trim()
    if (!trimmed) {
      try {
        const clip = await navigator.clipboard.readText()
        trimmed = clip.trim()
        if (trimmed) setUrl(trimmed)
      } catch { /* clipboard permission denied */ }
    }
    if (!trimmed) {
      updateDisplayRef.current?.('NO INPUT', true)
      setTimeout(() => updateDisplayRef.current?.('PASTE URL', true), 1500)
      return
    }
    const id = extractVideoId(trimmed)
    if (!id) {
      updateDisplayRef.current?.('BAD URL', true)
      setTimeout(() => updateDisplayRef.current?.('PASTE URL', true), 1500)
      return
    }
    currentUrlRef.current = trimmed
    updateDisplayRef.current?.('LOADING..', false)
    const run = () => {
      if (window.ytPlayer?.loadVideoById) {
        window.ytPlayer.loadVideoById(id)
        setTimeout(() => window.ytPlayer?.playVideo?.(), 2000)
        return
      }
      window.ytPlayer = new window.YT.Player('yt-player', {
        height: '113', width: '200', videoId: id,
        playerVars: { autoplay: 0, controls: 0, rel: 0 },
        events: {
          onReady: () => setTimeout(() => window.ytPlayer?.playVideo?.(), 2000),
          onStateChange: (e: any) => {
            const st = e.data
            if (st === 1) {
              startScrollRef.current?.(currentUrlRef.current)
              setDisplayStatus('PLAYING')
            } else if (st === 2) {
              updateDisplayRef.current?.('PAUSED', false)
              setDisplayStatus('PAUSED')
            } else {
              updateDisplayRef.current?.('PASTE URL', true)
              setDisplayStatus('')
            }
          },
        },
      })
    }
    if (apiReadyRef.current) run()
    else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => { setApiReady(true); prev?.(); run() }
    }
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#ffffff', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'fixed', left: -9999, top: -9999, width: 200, height: 113, pointerEvents: 'none' }}>
        <div id="yt-player" />
      </div>

      <Canvas
        camera={{ position: [0, 0.88, 11.32], fov: 43 }}
        gl={{ antialias: true }}
        shadows
        style={{ background: '#ffffff' }}
      >
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[6.99, 20, -3.2]} intensity={3.06} castShadow shadow-mapSize={[1024, 1024]} />
        <pointLight position={[-5, 4, -3]} intensity={1.13} color="#3355ff" />
        <pointLight position={[3, -2, 5]} intensity={0.92} color="#ffaa44" />

        <Suspense fallback={null}>
          <WalkmanModel
            onPasteClick={stableHandlePasteClick}
            onPlayPause={handlePlayPause}
            onMuteToggle={handleMuteToggle}
            onStop={handleStop}
            onForward={handleForward}
            onRewind={handleRewind}
            onVolumeChange={handleVolumeChange}
            onVolumeEnd={handleVolumeEnd}
            devParamsRef={devParamsRef}
            onReady={(fn, redraw, startScroll) => { updateDisplayRef.current = fn; redrawCurrentRef.current = redraw; startScrollRef.current = startScroll }}
          />
          <ContactShadows position={[0, -3.07, 0]} opacity={0.54} scale={14} blur={3} far={6} />
          <Environment preset="studio" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={18}
          minPolarAngle={Math.PI * 0.05}
          maxPolarAngle={Math.PI * 0.85}
          enableDamping
          dampingFactor={0.06}
        />
      </Canvas>

      <div
        style={{
          position: 'absolute', bottom: '2rem', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem',
        }}
      >
        {displayStatus
          ? <RetroStatus status={displayStatus} />
          : <span style={{
              fontFamily: '"Courier New", monospace', fontSize: 10,
              color: 'rgba(0,0,0,0.38)', letterSpacing: '0.08em', whiteSpace: 'nowrap',
            }}>
              copy a youtube url · click the ▣ button beside the display
            </span>
        }
        <span style={{
          fontFamily: '"Courier New", monospace', fontSize: 10,
          color: 'rgba(0,0,0,0.18)', letterSpacing: '0.1em', whiteSpace: 'nowrap',
        }}>
          ► play&nbsp;&nbsp;·&nbsp;&nbsp;❚❚ pause&nbsp;&nbsp;·&nbsp;&nbsp;◀◀ rewind&nbsp;&nbsp;·&nbsp;&nbsp;▶▶ skip&nbsp;&nbsp;·&nbsp;&nbsp;⊘ mute
        </span>
      </div>

      {/* <DevPanel devParamsRef={devParamsRef} onParamsChange={() => redrawCurrentRef.current?.()} /> */}
    </div>
  )
}
