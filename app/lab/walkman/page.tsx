'use client'

import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Environment, useProgress, Html } from '@react-three/drei'
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

function createDisplayUpdater(mesh: THREE.Mesh, devParamsRef: { current: DevParams }, invalidate: () => void) {
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

    const displayChars = (scrollX !== undefined ? text : text.slice(0, 16)).split('')
    const charW = ctx.measureText('W').width || fs * 0.6
    const spacing = charW * 1.2
    lastTextWidth = displayChars.length * spacing

    const xStart = scrollX !== undefined ? 0 : -lastTextWidth / 2
    displayChars.forEach((ch, i) => {
      ctx.fillText(ch, xStart + i * spacing, 0)
    })

    if (showCursor && scrollX === undefined) {
      ctx.fillText('>', xStart + lastTextWidth + spacing * 0.4, 0)
    }

    // Seamless marquee: draw a second copy trailing behind the first
    if (scrollX !== undefined) {
      const totalWidth = lastTextWidth + 50
      displayChars.forEach((ch, i) => {
        ctx.fillText(ch, totalWidth + i * spacing, 0)
      })
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
    invalidate()

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
    scrollOffset -= 0.5
    // Wrap by one cycle (textWidth + gap) so the second copy lands exactly where the first was
    const totalWidth = lastTextWidth + 50
    if (scrollOffset <= -totalWidth) scrollOffset += totalWidth
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
  darkBg: boolean
  isPlaying?: boolean
}

function WalkmanModel({ onPasteClick, onPlayPause, onMuteToggle, onStop, onForward, onRewind, onVolumeChange, onVolumeEnd, onReady, devParamsRef, darkBg, isPlaying }: WalkmanProps) {
  const { scene } = useGLTF('/models/walkman/walkman01.glb')
  const { invalidate, gl, scene: r3fScene, camera } = useThree()
  const cameraRef = useRef(camera)
  cameraRef.current = camera

  // Per-button world-space positions computed once after scene setup
  const btnWorldPositions = useRef<Array<{ label: string; pos: THREE.Vector3 }>>([])
  // Hover tooltip
  const [hoveredInfo, setHoveredInfo] = useState<{ label: string; pos: THREE.Vector3 } | null>(null)
  // Peek: briefly show all labels on first play
  const [peekHints, setPeekHints] = useState(false)

  const disposeRef = useRef<(() => void) | null>(null)
  const hasInteractedRef = useRef(false)
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

  const getBtnLabel = (n: string): string => {
    if (n.includes('Paste_click_button') || n.includes('Cube003')) return 'PASTE URL'
    if (n.includes('Button1_low001')) return 'MUTE'
    if (n.includes('Button2_low001')) return '+10s'
    if (n.includes('Button3_low001')) return '–10s'
    if (n.includes('Button4_low001')) return 'PLAY / PAUSE'
    if (n.includes('Button5_low001')) return 'STOP'
    return ''
  }

  // Show all button labels for 8s whenever music starts; hide when it stops
  useEffect(() => {
    if (!isPlaying) { setPeekHints(false); return }
    setPeekHints(true)
    const t = setTimeout(() => setPeekHints(false), 8000)
    return () => { clearTimeout(t); setPeekHints(false) }
  }, [isPlaying])

  useEffect(() => {
    gl.setClearColor(new THREE.Color(darkBg ? '#000000' : '#ffffff'), 0)
    invalidate()
  }, [darkBg])

  const btnGroups = useRef<Record<string, THREE.Object3D[]>>({ paste: [], play: [], stop: [], forward: [], rewind: [], stopeject: [] })
  const btnOriginals = useRef<Map<THREE.Object3D, { scale: THREE.Vector3; pos: THREE.Vector3 }>>(new Map())
  const animatingGroup = useRef<THREE.Object3D[]>([])
  const btnPress = useRef(0)
  const stopejectPress = useRef(0)

  const isDraggingSlider = useRef(false)
  const sliderStartY = useRef(0)
  const sliderStartVol = useRef(50)

  // Mechanical click sound for button presses
  const clickAudioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    const a = new Audio('/images/lab/walkman-click-01.mp3')
    a.preload = 'auto'
    a.volume = 0.55
    clickAudioRef.current = a
    return () => { clickAudioRef.current = null }
  }, [])
  const playClick = useCallback(() => {
    const a = clickAudioRef.current
    if (!a) return
    a.currentTime = 0
    a.play().catch(() => {})
  }, [])

  const tickScrollRef = useRef<() => void>(() => {})
  const stopScrollRef = useRef<() => void>(() => {})
  const wasPlayingRef = useRef(false)
  const isHovered = useRef(false)
  const scrollFrameCount = useRef(0)
  const driftTimeRef = useRef(0)
  const idleTimeRef = useRef(0)
  const sceneBasePosY = useRef(-1.07)
  const pivotRef = useRef<THREE.Group>(null!)
  const clearHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHoveredLabelRef = useRef('')

  useEffect(() => {
    scene.rotation.y = 4.4
    scene.rotation.x = 0.9084
    scene.scale.setScalar(2.35)

    const box = new THREE.Box3().setFromObject(scene)
    const center = new THREE.Vector3()
    box.getCenter(center)
    // Center scene at pivot's local origin so rotation is around the visual center
    scene.position.set(-center.x, -center.y, -center.z)
    const basePosY = center.y - 1.07
    sceneBasePosY.current = basePosY
    pivotRef.current.position.set(0.03, basePosY, 0)

    let screenMesh: THREE.Mesh | null = null
    btnGroups.current = { paste: [], play: [], stop: [], forward: [], rewind: [], stopeject: [] }
    btnOriginals.current = new Map()
    animatingGroup.current = []

    scene.traverse((obj) => {
      const n = obj.name

      const addToGroup = (group: string) => {
        btnGroups.current[group].push(obj)
        btnOriginals.current.set(obj, { scale: obj.scale.clone(), pos: obj.position.clone() })
      }
      if (n.includes('Paste_click_button') || n.includes('Cube003')) addToGroup('paste')
      else if (n.includes('Button1_low001')) addToGroup('play')
      else if (n.includes('Button2_low001')) addToGroup('stop')
      else if (n.includes('Button3_low001')) addToGroup('forward')
      else if (n.includes('Button4_low001')) addToGroup('rewind')
      else if (n.includes('Button5_low001')) addToGroup('stopeject')

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

    // Compute world positions for each button label (after transforms are applied)
    r3fScene.updateMatrixWorld(true)
    const labelTargets: Array<{ test: (n: string) => boolean; label: string }> = [
      { test: n => n.includes('Paste_click_button') || n.includes('Cube003'), label: 'PASTE URL' },
      { test: n => n.includes('Button1_low001'), label: 'MUTE' },
      { test: n => n.includes('Button2_low001'), label: '+10s' },
      { test: n => n.includes('Button3_low001'), label: '–10s' },
      { test: n => n.includes('Button4_low001'), label: 'PLAY / PAUSE' },
      { test: n => n.includes('Button5_low001'), label: 'STOP' },
    ]
    const seenLabels = new Set<string>()
    const computed: Array<{ label: string; pos: THREE.Vector3 }> = []
    const camPos = cameraRef.current.position.clone()
    scene.traverse((obj) => {
      for (const t of labelTargets) {
        if (t.test(obj.name) && !seenLabels.has(t.label)) {
          seenLabels.add(t.label)
          const wp = new THREE.Vector3()
          obj.getWorldPosition(wp)
          // offset 0.35 units toward camera so label floats in front of button face
          const dir = new THREE.Vector3().subVectors(camPos, wp).normalize()
          computed.push({ label: t.label, pos: wp.clone().addScaledVector(dir, 0.35) })
          break
        }
      }
    })
    btnWorldPositions.current = computed

    if (screenMesh) {
      const { updateDisplay, redrawCurrent, startScroll, stopScroll, tickScroll, dispose } = createDisplayUpdater(screenMesh as THREE.Mesh, devParamsRef, invalidate)
      disposeRef.current = dispose
      tickScrollRef.current = tickScroll
      stopScrollRef.current = stopScroll
      onReady(updateDisplay, redrawCurrent, startScroll)
      updateDisplay('PASTE URL', true)
      document.fonts.load('4px "Press Start 2P"').then(() => {
        updateDisplay('PASTE URL', true)
      })
    }

    return () => {
      disposeRef.current?.()
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose()
        }
      })
    }
  }, [scene])

  useFrame((_, delta) => {
    const playing = window.ytPlayer?.getPlayerState?.() === 1
    if (playing) {
      scrollFrameCount.current++
      if (scrollFrameCount.current % 2 === 0) tickScrollRef.current()

      driftTimeRef.current += delta
      const t = driftTimeRef.current
      pivotRef.current.rotation.y = t * 0.25
      pivotRef.current.rotation.x = Math.sin(t * 0.19) * 0.013
      pivotRef.current.position.y = THREE.MathUtils.lerp(pivotRef.current.position.y, sceneBasePosY.current, Math.min(1, delta * 4))

      invalidate()
    } else {
      idleTimeRef.current += delta
      pivotRef.current.position.y = sceneBasePosY.current + Math.sin(idleTimeRef.current * 0.65) * 0.2
      invalidate()
    }
    if (!playing && wasPlayingRef.current) {
      stopScrollRef.current()
    }
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
      invalidate()
    }

    if (stopejectPress.current > 0) {
      stopejectPress.current = Math.max(0, stopejectPress.current - delta * 7)
      const t = Math.sin(stopejectPress.current * Math.PI)
      btnGroups.current.stopeject.forEach((mesh) => {
        const orig = btnOriginals.current.get(mesh)
        if (!orig) return
        mesh.position.copy(orig.pos)
        mesh.position.z += t * 0.04
      })
      if (stopejectPress.current === 0) {
        btnGroups.current.stopeject.forEach((mesh) => {
          const orig = btnOriginals.current.get(mesh)
          if (orig) mesh.position.copy(orig.pos)
        })
      }
      invalidate()
    }
  })

  const isBtn = (name: string) =>
    name.includes('Paste_click_button') || name.includes('Cube003') ||
    name.includes('Button1_low001') || name.includes('Button2_low001') ||
    name.includes('Button3_low001') || name.includes('Button4_low001') ||
    name.includes('Button5_low001') ||
    name.includes('Slider1_low001') || name.includes('Slider2_low001')

  const isSliderMesh = (name: string) =>
    name.includes('Slider1_low001') || name.includes('Slider2_low001')

  const pressGroup = (n: string) => {
    if (n.includes('Button5_low001')) {
      stopejectPress.current = 1
      invalidate()
      return
    }
    btnPress.current = 1
    if (n.includes('Paste_click_button') || n.includes('Cube003'))
      animatingGroup.current = btnGroups.current.paste
    else if (n.includes('Button1_low001')) animatingGroup.current = btnGroups.current.play
    else if (n.includes('Button2_low001')) animatingGroup.current = btnGroups.current.stop
    else if (n.includes('Button3_low001')) animatingGroup.current = btnGroups.current.forward
    else if (n.includes('Button4_low001')) animatingGroup.current = btnGroups.current.rewind
    invalidate()
  }

  const handlePointerOver = useCallback((e: any) => {
    const n = e.object?.name ?? ''
    if (isBtn(n)) {
      if (clearHoverTimerRef.current) {
        clearTimeout(clearHoverTimerRef.current)
        clearHoverTimerRef.current = null
      }
      document.body.style.cursor = 'pointer'
      isHovered.current = true
      if (!isSliderMesh(n)) {
        const label = getBtnLabel(n)
        if (label) {
          lastHoveredLabelRef.current = label
          const wp = new THREE.Vector3()
          e.object.getWorldPosition(wp)
          const dir = new THREE.Vector3().subVectors(cameraRef.current.position, wp).normalize()
          setHoveredInfo({ label, pos: wp.clone().addScaledVector(dir, 0.35) })
          invalidate()
        }
      }
    }
  }, [])

  const handlePointerOut = useCallback((e: any) => {
    if (isBtn(e.object?.name ?? '')) {
      document.body.style.cursor = 'default'
      isHovered.current = false
      lastHoveredLabelRef.current = ''
      clearHoverTimerRef.current = setTimeout(() => {
        setHoveredInfo(null)
        clearHoverTimerRef.current = null
      }, 150)
    }
  }, [])

  const handlePointerDown = useCallback((e: any) => {
    const n = e.object?.name ?? ''
    if (isSliderMesh(n)) {
      e.stopPropagation()
      isDraggingSlider.current = true
      sliderStartY.current = e.clientY ?? 0
      sliderStartVol.current = window.ytPlayer?.getVolume?.() ?? 50
    } else if (isBtn(n) && !isSliderMesh(n)) {
      e.stopPropagation()
      playClick()
      pressGroup(n)
    }
  }, [playClick])

  const handlePointerMove = useCallback((e: any) => {
    if (isDraggingSlider.current) {
      const dy = sliderStartY.current - (e.clientY ?? 0)
      const newVol = Math.max(0, Math.min(100, sliderStartVol.current + dy))
      onVolumeChangeRef.current(Math.round(newVol))
      return
    }
    // Belt-and-suspenders: onPointerOver can miss when cursor is already over
    // a mesh (e.g. right after a click). onPointerMove fires every frame so we
    // use it to reliably keep the label in sync with whatever mesh is under
    // the cursor. We gate on lastHoveredLabelRef to avoid re-renders on every
    // tiny mouse movement.
    const n = e.object?.name ?? ''
    if (isBtn(n) && !isSliderMesh(n)) {
      const label = getBtnLabel(n)
      if (label && label !== lastHoveredLabelRef.current) {
        if (clearHoverTimerRef.current) {
          clearTimeout(clearHoverTimerRef.current)
          clearHoverTimerRef.current = null
        }
        lastHoveredLabelRef.current = label
        document.body.style.cursor = 'pointer'
        const wp = new THREE.Vector3()
        e.object.getWorldPosition(wp)
        const dir = new THREE.Vector3().subVectors(cameraRef.current.position, wp).normalize()
        setHoveredInfo({ label, pos: wp.clone().addScaledVector(dir, 0.35) })
        invalidate()
      }
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    if (isDraggingSlider.current) {
      isDraggingSlider.current = false
      onVolumeEndRef.current()
    }
  }, [])

  const handleClick = useCallback((e: any) => {
    e.stopPropagation()
    hasInteractedRef.current = true
    const name = e.object?.name ?? ''
    if (name.includes('Paste_click_button') || name.includes('Cube003')) {
      onPasteClickRef.current()
    } else if (name.includes('Button1_low001')) {
      onMuteToggleRef.current?.()
    } else if (name.includes('Button2_low001')) {
      onForwardRef.current?.()
    } else if (name.includes('Button3_low001')) {
      onRewindRef.current?.()
    } else if (name.includes('Button4_low001')) {
      onPlayPauseRef.current?.()
    } else if (name.includes('Button5_low001')) {
      onStopRef.current?.()
    }
  }, [])

  const labelStyle: React.CSSProperties = {
    fontFamily: '"Courier New", monospace',
    fontSize: '9px',
    letterSpacing: '0.12em',
    color: darkBg ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.88)',
    background: darkBg ? 'rgba(10,10,10,0.72)' : 'rgba(255,255,255,0.84)',
    border: `1px solid ${darkBg ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'}`,
    padding: '3px 7px',
    borderRadius: '4px',
    whiteSpace: 'nowrap' as const,
    backdropFilter: 'blur(8px)',
    pointerEvents: 'none',
    userSelect: 'none',
    boxShadow: '0 1px 8px rgba(0,0,0,0.18)',
    lineHeight: 1,
  }

  // Html must be siblings of the pivot group (not children) so that
  // the world-space positions computed via getWorldPosition() are
  // interpreted correctly — inside the group they would be local coords.
  return (
    <>
      <group ref={pivotRef}>
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
      </group>

    </>
  )
}

useGLTF.preload('/models/walkman/walkman01.glb')

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

// ─── soft shadow ─────────────────────────────────────────────────────────────

function SoftShadow() {
  const texture = useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const cx = size / 2
    const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
    gradient.addColorStop(0,    'rgba(0,0,0,0.45)')
    gradient.addColorStop(0.38, 'rgba(0,0,0,0.28)')
    gradient.addColorStop(0.72, 'rgba(0,0,0,0.09)')
    gradient.addColorStop(1,    'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(canvas)
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.07, 0]} scale={[2.5, 1.2, 1]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  )
}

// ─── model loader overlay ─────────────────────────────────────────────────────

function WalkmanLoaderOverlay({ darkBg }: { darkBg: boolean }) {
  const { progress } = useProgress()
  const [gone, setGone] = useState(false)
  const done = progress >= 100

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setGone(true), 750)
    return () => clearTimeout(t)
  }, [done])

  if (gone) return null

  const fg = '#00ff88'
  const fgDim = darkBg ? 'rgba(0,255,136,0.18)' : 'rgba(0,160,80,0.14)'
  const textColor = darkBg ? 'rgba(0,255,136,0.75)' : 'rgba(0,130,70,0.82)'
  const subColor = darkBg ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9990,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: darkBg ? '#000' : '#fff',
      opacity: done ? 0 : 1,
      transition: 'opacity 0.7s ease',
      pointerEvents: done ? 'none' : 'all',
    }}>
      {/* Spinning arc — cassette reel feel */}
      <div style={{
        width: 38, height: 38,
        borderRadius: '50%',
        border: `2px solid ${fgDim}`,
        borderTopColor: fg,
        animation: 'reelSpin 1.1s linear infinite',
        marginBottom: 28,
      }} />

      {/* Progress track */}
      <div style={{ width: 160, height: 2, background: fgDim, borderRadius: 1, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          width: `${progress}%`, height: '100%',
          background: fg, borderRadius: 1,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 8, color: textColor, letterSpacing: '0.1em',
      }}>
        {Math.round(progress)}%
      </div>

      <div style={{
        fontFamily: '"Courier New", monospace',
        fontSize: 10, color: subColor,
        marginTop: 10, letterSpacing: '0.05em',
      }}>
        warming up the tape
      </div>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Walkman() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => { setIsMobile(window.innerWidth < 768) }, [])

  const [url, setUrl] = useState('')
  const [displayStatus, setDisplayStatus] = useState('')
  const [thumbUrl, setThumbUrl] = useState('')
  const [videoMeta, setVideoMeta] = useState<{ title: string; author: string } | null>(null)
  const [darkBg, setDarkBg] = useState(false)
  const [bgGlows, setBgGlows] = useState<{ r: number; g: number; b: number }[]>([])
  const [glowKey, setGlowKey] = useState(0)
  const [apiReady, setApiReady] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [hoveredCtrl, setHoveredCtrl] = useState<string | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [mobileInputVal, setMobileInputVal] = useState('')
  const [toast, setToast] = useState<{ title: string; hint: string; thumb?: string } | null>(null)
  const showToast = useCallback((title: string, hint: string, thumb?: string) => {
    setToast({ title, hint, thumb })
  }, [])

  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFullscreen])
  const updateDisplayRef = useRef<((text: string, blinking?: boolean) => void) | null>(null)
  const redrawCurrentRef = useRef<(() => void) | null>(null)
  const startScrollRef = useRef<((text: string) => void) | null>(null)
  const currentUrlRef = useRef('')
  const pendingVideoRef = useRef<string | null>(null)
  const playerReadyRef = useRef(false)
  const isMutedRef = useRef(false)
  const devParamsRef = useRef<DevParams>({ ...defaultDevParams })
  const urlRef = useRef(url)
  useEffect(() => { urlRef.current = url }, [url])

  useEffect(() => {
    if (!darkBg) {
      document.body.setAttribute('data-light-page', 'true')
      document.documentElement.removeAttribute('data-cassette-dark')
    } else {
      document.body.removeAttribute('data-light-page')
      document.documentElement.setAttribute('data-cassette-dark', 'true')
    }
    return () => {
      document.body.removeAttribute('data-light-page')
      document.documentElement.removeAttribute('data-cassette-dark')
    }
  }, [darkBg])

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

  // Pre-initialize the YT player as soon as the API is ready.
  // Uses muted autoplay (always allowed by browsers) then unmutes at state=1,
  // bypassing Android Chrome's cross-origin user-activation restriction.
  useEffect(() => {
    if (!apiReady) return

    // window.ytPlayer may survive Next.js client-side navigation even though
    // refs reset on remount. Destroy the stale player so onReady fires fresh.
    if (window.ytPlayer) {
      window.ytPlayer.destroy?.()
      window.ytPlayer = null
    }

    window.ytPlayer = new window.YT.Player('yt-player', {
      height: '113', width: '200',
      playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, playsinline: 1 },
      events: {
        onReady: () => {
          playerReadyRef.current = true
          if (pendingVideoRef.current) {
            const id = pendingVideoRef.current
            pendingVideoRef.current = null
            window.ytPlayer.mute()
            window.ytPlayer.loadVideoById(id)
            window.ytPlayer.playVideo()
          }
        },
        onStateChange: (e: any) => {
          const st = e.data
          if (st === 1) {
            if (!isMutedRef.current) window.ytPlayer?.unMute?.()
            startScrollRef.current?.(currentUrlRef.current)
            setDisplayStatus('PLAYING')
            const data = window.ytPlayer?.getVideoData?.()
            if (data?.title) setVideoMeta({ title: data.title, author: data.author ?? '' })
          } else if (st === 2) {
            updateDisplayRef.current?.('PAUSED', false)
            setDisplayStatus('PAUSED')
          } else if (st === 0) {
            updateDisplayRef.current?.('PASTE URL', true)
            setDisplayStatus('')
          }
        },
        onError: (e: any) => {
          const code = e.data
          // 101/150 = owner disabled embedding · 100 = not found/private
          // 2 = bad video ID · 5 = HTML5 player error
          const t = (code === 101 || code === 150)
            ? { disp: 'BLOCKED', title: "Can't play this one", hint: 'The owner disabled embedding. Try a normal youtube.com link instead of YouTube Music.' }
            : code === 100
            ? { disp: 'NOT FOUND', title: 'Video unavailable', hint: 'It may be private, deleted, or region locked.' }
            : { disp: 'ERROR :(', title: 'Playback error', hint: 'Something went wrong loading that track. Try another link.' }
          const failedId = extractVideoId(currentUrlRef.current)
          const thumb = failedId ? `https://img.youtube.com/vi/${failedId}/hqdefault.jpg` : undefined
          updateDisplayRef.current?.(t.disp, true)
          setDisplayStatus('')
          setThumbUrl('')
          showToast(t.title, t.hint, thumb)
          setTimeout(() => updateDisplayRef.current?.('PASTE URL', true), 2500)
        },
      },
    })

    return () => {
      window.ytPlayer?.destroy?.()
      window.ytPlayer = null
      playerReadyRef.current = false
    }
  }, [apiReady, setDisplayStatus, setVideoMeta, showToast])

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
      setIsMuted(false)
      isMutedRef.current = false
      updateDisplayRef.current?.('UNMUTED', false)
      setDisplayStatus('UNMUTED')
    } else {
      window.ytPlayer.mute()
      setIsMuted(true)
      isMutedRef.current = true
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
    setIsMuted(false)
    setThumbUrl('')
    setVideoMeta(null)
    setBgGlows([])
    setGlowKey(0)
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

  const extractColors = useCallback(async (videoId: string) => {
    try {
      const response = await fetch(`/api/thumbnail?id=${videoId}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)

      const img = new Image()
      img.src = objectUrl
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image load failed'))
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width || 120
      canvas.height = img.height || 90
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(objectUrl)

      const w = canvas.width, h = canvas.height
      type RGB = { r: number; g: number; b: number }

      // 8×8 grid = 64 samples for better coverage
      const samples: RGB[] = []
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          const px = Math.floor((x / 7) * (w - 1))
          const py = Math.floor((y / 7) * (h - 1))
          const d = ctx.getImageData(px, py, 1, 1).data
          samples.push({ r: d[0], g: d[1], b: d[2] })
        }
      }

      // K-means to find 5 genuinely distinct color clusters
      const K = 5
      let centroids: RGB[] = Array.from({ length: K }, (_, i) => ({
        ...samples[Math.floor((i / K) * samples.length)]
      }))
      for (let iter = 0; iter < 10; iter++) {
        const clusters: RGB[][] = Array.from({ length: K }, () => [])
        for (const s of samples) {
          let minD = Infinity, minI = 0
          centroids.forEach((c, i) => {
            const d = (s.r - c.r) ** 2 + (s.g - c.g) ** 2 + (s.b - c.b) ** 2
            if (d < minD) { minD = d; minI = i }
          })
          clusters[minI].push(s)
        }
        centroids = clusters.map((cluster, i) => {
          if (!cluster.length) return centroids[i]
          return {
            r: Math.round(cluster.reduce((a, c) => a + c.r, 0) / cluster.length),
            g: Math.round(cluster.reduce((a, c) => a + c.g, 0) / cluster.length),
            b: Math.round(cluster.reduce((a, c) => a + c.b, 0) / cluster.length),
          }
        })
      }

      // Score: prefer vibrant mid-brightness colors; penalize near-black and near-white/gray
      const score = (c: RGB) => {
        const max = Math.max(c.r, c.g, c.b)
        const min = Math.min(c.r, c.g, c.b)
        const brightness = (c.r + c.g + c.b) / 3
        if (brightness < 18) return 0
        if (brightness > 230 && max - min < 25) return 0.05
        return (max - min) / (max + 1)
      }

      centroids.sort((a, b) => score(b) - score(a))
      setBgGlows(centroids)
      setGlowKey(k => k + 1)
    } catch (e) {
      console.error('color extract failed:', e)
    }
  }, [])

  const processUrl = useCallback((trimmed: string) => {
    if (!trimmed) {
      updateDisplayRef.current?.('NO INPUT', true)
      showToast('No tape loaded', 'Bring a YouTube URL — the Walkman does the rest.')
      setTimeout(() => updateDisplayRef.current?.('PASTE URL', true), 1500)
      return
    }
    const id = extractVideoId(trimmed)
    if (!id) {
      updateDisplayRef.current?.('BAD URL', true)
      showToast("Wrong format", 'Needs a youtube.com, youtu.be, or music.youtube.com link.')
      setTimeout(() => updateDisplayRef.current?.('PASTE URL', true), 1500)
      return
    }
    setToast(null)
    setUrl(trimmed)
    currentUrlRef.current = trimmed
    setThumbUrl(`https://img.youtube.com/vi/${id}/hqdefault.jpg`)
    extractColors(id)
    updateDisplayRef.current?.('LOADING..', false)
    setDisplayStatus('LOADING')
    if (playerReadyRef.current && window.ytPlayer?.loadVideoById) {
      window.ytPlayer.mute()
      window.ytPlayer.loadVideoById(id)
      window.ytPlayer.playVideo()
    } else {
      pendingVideoRef.current = id
    }
  }, [extractColors, setDisplayStatus, showToast])

  const stableHandlePasteClick = useCallback(async () => {
    // Mobile: clipboard reads are unreliable over HTTP, so always open the
    // input popup fresh. This also lets the user paste a NEW link after one
    // has already played (the old behavior re-loaded the stale URL instead).
    if (isMobile) {
      setMobileInputVal('')
      setShowUrlInput(true)
      return
    }
    // Desktop: clipboard read works (sticky user activation).
    let trimmed = ''
    try {
      const clip = await navigator.clipboard.readText()
      trimmed = clip.trim()
    } catch { /* clipboard permission denied */ }
    if (!trimmed) trimmed = urlRef.current.trim()
    processUrl(trimmed)
  }, [isMobile, processUrl])

  const bgBase = darkBg ? '#000000' : '#ffffff'

  return (
    <div style={{ width: '100vw', height: '100vh', background: bgBase, transition: 'background 0.6s ease', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes reelSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes iconPop {
          0%   { opacity: 0; transform: scale(0.55) rotate(-15deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes toastIn {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes ambientFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        html[data-cassette-dark] {
          scrollbar-color: rgba(255,255,255,0.22) #0d0d0d;
          scrollbar-width: thin;
        }
        html[data-cassette-dark]::-webkit-scrollbar {
          width: 8px;
        }
        html[data-cassette-dark]::-webkit-scrollbar-track {
          background: #0d0d0d;
        }
        html[data-cassette-dark]::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.22);
          border-radius: 4px;
        }
        html[data-cassette-dark]::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.4);
        }
        @keyframes ambientDrift0 {
          0%,100% { transform: translate(-50%,-50%) scale(1); }
          50%     { transform: translate(calc(-50% - 3.5vw), calc(-50% + 2vh)) scale(1.14); }
        }
        @keyframes ambientDrift1 {
          0%,100% { transform: translate(-50%,-50%) scale(1.06); }
          50%     { transform: translate(calc(-50% + 4vw), calc(-50% - 3.5vh)) scale(0.88); }
        }
        @keyframes ambientDrift2 {
          0%,100% { transform: translate(-50%,-50%) scale(0.94); }
          50%     { transform: translate(calc(-50% - 2.5vw), calc(-50% - 4vh)) scale(1.1); }
        }
        @keyframes ambientDrift3 {
          0%,100% { transform: translate(-50%,-50%) scale(1.08); }
          50%     { transform: translate(calc(-50% + 3vw), calc(-50% + 3.5vh)) scale(0.87); }
        }
        @keyframes ambientDrift4 {
          0%,100% { transform: translate(-50%,-50%) scale(1); }
          50%     { transform: translate(calc(-50% + 1.5vw), calc(-50% - 2.5vh)) scale(1.12); }
        }
        @keyframes textShine {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      <WalkmanLoaderOverlay darkBg={darkBg} />

      <div style={{ position: 'fixed', top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div id="yt-player" />
      </div>

      {/* bg toggle — vertical pill */}
      <div
        style={{
          position: 'fixed' as const, top: isMobile ? '4.5rem' : '1rem', right: '1rem', zIndex: 10010,
          width: '42px',
          background: darkBg ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${darkBg ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'}`,
          borderRadius: '21px',
          backdropFilter: 'blur(12px)',
          transition: 'background 0.35s ease, border-color 0.35s ease',
          overflow: 'hidden',
        }}
      >
        {/* sun — light mode */}
        <button
          onClick={() => setDarkBg(false)}
          title="Light background"
          style={{
            width: '42px', height: '42px', borderRadius: '21px 21px 0 0',
            background: !darkBg
              ? 'radial-gradient(circle at center, rgba(255,165,30,0.22) 0%, transparent 72%)'
              : 'none',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            transition: 'background 0.4s ease',
          }}
        >
          <img src="/images/lab/sun.png" alt="light mode"
            style={{
              width: '20px', height: '20px', objectFit: 'contain',
              opacity: darkBg ? 0.28 : 1,
              filter: !darkBg ? 'drop-shadow(0 0 5px rgba(255,160,20,0.9)) drop-shadow(0 0 10px rgba(255,130,0,0.5))' : 'none',
              transition: 'opacity 0.35s ease, filter 0.35s ease',
            }}
          />
        </button>

        {/* moon — dark mode */}
        <button
          onClick={() => setDarkBg(true)}
          title="Dark background"
          style={{
            width: '42px', height: '42px', borderRadius: '0 0 21px 21px',
            background: darkBg
              ? 'radial-gradient(circle at center, rgba(170,210,255,0.20) 0%, transparent 72%)'
              : 'none',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            transition: 'background 0.4s ease',
          }}
        >
          <img src="/images/lab/moon.png" alt="dark mode"
            style={{
              width: '20px', height: '20px', objectFit: 'contain',
              opacity: darkBg ? 1 : 0.28,
              filter: darkBg ? 'drop-shadow(0 0 5px rgba(180,215,255,0.9)) drop-shadow(0 0 10px rgba(140,190,255,0.5))' : 'none',
              transition: 'opacity 0.35s ease, filter 0.35s ease',
            }}
          />
        </button>
      </div>

      {/* Fullscreen toggle — desktop only, top-left */}
      {!isMobile && (
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          style={{
            position: 'fixed', top: '1rem', left: '1rem', zIndex: 10010,
            width: '42px', height: '68px', borderRadius: '21px',
            background: darkBg ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            border: `1px solid ${darkBg ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'}`,
            backdropFilter: 'blur(12px)',
            cursor: 'pointer', padding: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '10px',
            transition: 'background 0.2s ease, border-color 0.2s ease',
          }}
        >
          {isFullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={darkBg ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={darkBg ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V3h4" />
              <path d="M21 7V3h-4" />
              <path d="M3 17v4h4" />
              <path d="M21 17v4h-4" />
            </svg>
          )}
          <span style={{
            fontFamily: 'SatishSans, sans-serif',
            fontSize: '15px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: darkBg ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
            lineHeight: 1,
          }}>F</span>
        </button>
      )}

      {/* Multi-blob ambient lighting — 5 independent colored glows, each drifting slowly */}
      {bgGlows.length > 0 && (
        <div
          key={glowKey}
          style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', animation: 'ambientFadeIn 2.5s ease forwards' }}
        >
          {([
            { left: '25%', top: '35%', size: '90vw', dur: '9s',   delay: '0s',    anim: 0 },
            { left: '78%', top: '22%', size: '75vw', dur: '11s',  delay: '-3.5s', anim: 1 },
            { left: '12%', top: '72%', size: '70vw', dur: '8.5s', delay: '-1.5s', anim: 2 },
            { left: '82%', top: '78%', size: '80vw', dur: '13s',  delay: '-5s',   anim: 3 },
            { left: '52%', top: '52%', size: '85vw', dur: '10s',  delay: '-2.5s', anim: 4 },
          ] as const).map((b, i) => {
            const c = bgGlows[i] ?? bgGlows[bgGlows.length - 1]
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: b.left, top: b.top,
                  width: b.size, height: b.size,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, rgba(${c.r},${c.g},${c.b},${darkBg ? 0.62 : 0.3}) 0%, transparent 68%)`,
                  mixBlendMode: darkBg ? 'screen' : 'multiply',
                  animation: `ambientDrift${b.anim} ${b.dur} ease-in-out ${b.delay} infinite`,
                  willChange: 'transform',
                }}
              />
            )
          })}
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
        background: `linear-gradient(to top, ${bgBase} 0%, transparent 100%)`,
        transition: 'background 0.6s ease', pointerEvents: 'none', zIndex: 2,
      }} />

      <Canvas
        camera={{ position: isMobile ? [0, 0.88, 22] : [0, 0.88, 11.32], fov: isMobile ? 36 : 43 }}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: false, depth: true, alpha: true }}
        frameloop="demand"
        dpr={[1, 1.5]}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[6.99, 20, -3.2]} intensity={3.06} />

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
            darkBg={darkBg}
            onReady={(fn, redraw, startScroll) => { updateDisplayRef.current = fn; redrawCurrentRef.current = redraw; startScrollRef.current = startScroll }}
            isPlaying={displayStatus === 'PLAYING'}
          />
          <SoftShadow />
          <Environment preset="studio" resolution={64} />
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={isMobile ? 6 : 4}
          maxDistance={isMobile ? 22 : 18}
          minPolarAngle={Math.PI * 0.05}
          maxPolarAngle={Math.PI * 0.85}
          enableDamping
          dampingFactor={0.06}
          regress
        />
      </Canvas>

      <div
        style={{
          position: 'absolute', bottom: isMobile ? '5rem' : '2rem', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem',
        }}
      >
        {displayStatus
          ? (!isMobile && <RetroStatus status={displayStatus} />)
          : <span style={{
              fontFamily: '"Courier New", monospace', fontSize: isMobile ? 10 : 11,
              letterSpacing: '0.08em',
              whiteSpace: isMobile ? 'normal' : 'nowrap',
              wordBreak: isMobile ? 'break-word' : 'normal',
              textAlign: 'center',
              padding: isMobile ? '0 12px' : '0',
              width: isMobile ? 'min(90vw, 500px)' : undefined,
              // Neon green shine sweep left → right
              backgroundImage: darkBg
                ? 'linear-gradient(90deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.38) 35%, #00ff88 50%, rgba(255,255,255,0.38) 65%, rgba(255,255,255,0.38) 100%)'
                : 'linear-gradient(90deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.28) 35%, #00cc66 50%, rgba(0,0,0,0.28) 65%, rgba(0,0,0,0.28) 100%)',
              backgroundSize: '250% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'textShine 4s linear infinite',
            }}>
              copy a youtube url · click the Paste button beside the display
            </span>
        }
        <div style={{
          display: 'flex', alignItems: 'center',
          flexWrap: 'nowrap',
          gap: 0,
          justifyContent: 'center',
          whiteSpace: 'nowrap',
          padding: isMobile ? '0 0.5rem' : '0',
        }}>
          {((isMobile
            ? [
                { id: 'play',   icon: '►❚', label: 'play/pause', tip: 'Play or pause — press the bottom-right button on the Walkman' },
                { id: 'rewind', icon: '◀◀', label: 'rewind', tip: 'Rewind 10s — press the second button from the right' },
                { id: 'skip',   icon: '▶▶', label: 'skip',   tip: 'Skip 10s — press the second button from the left' },
                { id: 'mute',   icon: '⊘',  label: isMuted ? 'muted' : 'mute', tip: 'Mute or unmute — click the orange button on the side of the Walkman' },
              ]
            : [
                { id: 'play',   icon: '►',  label: 'play',   tip: 'Play the song — press the bottom-right button on the Walkman' },
                { id: 'pause',  icon: '❚❚', label: 'pause',  tip: 'Pause the song — press the bottom-right button on the Walkman' },
                { id: 'rewind', icon: '◀◀', label: 'rewind', tip: 'Rewind 10s — press the second button from the right' },
                { id: 'skip',   icon: '▶▶', label: 'skip',   tip: 'Skip 10s — press the second button from the left' },
                { id: 'mute',   icon: '⊘',  label: isMuted ? 'muted' : 'mute', tip: 'Mute or unmute — click the orange button on the side of the Walkman' },
              ]
          ) as { id: string; icon: string; label: string; tip: string }[]).map((ctrl, i, arr) => (
            <span key={ctrl.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <span
                onMouseEnter={() => setHoveredCtrl(ctrl.id)}
                onMouseLeave={() => setHoveredCtrl(null)}
                style={{
                  position: 'relative',
                  fontFamily: '"Courier New", monospace', fontSize: isMobile ? 9 : 10,
                  letterSpacing: isMobile ? '0.05em' : '0.1em', whiteSpace: 'nowrap', cursor: 'default',
                  color: ctrl.id === 'mute' && isMuted
                    ? 'rgba(230,100,30,0.9)'
                    : darkBg ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)',
                  transition: 'color 0.25s ease',
                  fontWeight: ctrl.id === 'mute' && isMuted ? 600 : 400,
                }}
              >
                {ctrl.icon} {ctrl.label}
                {hoveredCtrl === ctrl.id && (
                  <span style={{
                    position: 'absolute', bottom: 'calc(100% + 7px)', left: '50%',
                    transform: 'translateX(-50%)',
                    background: darkBg ? 'rgba(20,20,20,0.93)' : 'rgba(255,255,255,0.95)',
                    color: darkBg ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.65)',
                    fontSize: 9, fontFamily: '"Courier New", monospace',
                    letterSpacing: '0.03em', lineHeight: 1.5,
                    padding: '4px 8px', borderRadius: 5, whiteSpace: 'nowrap',
                    backdropFilter: 'blur(10px)',
                    border: darkBg ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.07)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                    pointerEvents: 'none', zIndex: 100,
                  }}>
                    {ctrl.tip}
                  </span>
                )}
              </span>
              {i < arr.length - 1 && (
                <span style={{
                  color: darkBg ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
                  fontSize: 7, margin: isMobile ? '0 4px' : '0 7px',
                }}>·</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {(thumbUrl || (isMobile && displayStatus)) && (
        <div style={{
          position: 'fixed',
          bottom: isMobile ? '9rem' : '5rem',
          left: isMobile ? '1rem' : undefined,
          right: isMobile ? '1rem' : '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : 'flex-end',
          gap: '10px',
          zIndex: 20,
          opacity: 1,
          transition: 'opacity 0.5s ease',
        }}>
          {/* Mobile: PLAYING status left-aligned, same line as the track name */}
          {isMobile && displayStatus && (
            <div style={{ flexShrink: 0, textAlign: 'left' }}>
              <RetroStatus status={displayStatus} />
            </div>
          )}
          {thumbUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              {videoMeta && (
                <div style={{ textAlign: 'right', maxWidth: '160px' }}>
                  <div style={{
                    color: darkBg ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.78)',
                    fontSize: '11px',
                    fontFamily: '"Courier New", monospace',
                    letterSpacing: '0.01em',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                  }}>
                    {videoMeta.title}
                  </div>
                  {videoMeta.author && (
                    <div style={{
                      color: darkBg ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.42)',
                      fontSize: '9px',
                      fontFamily: '"Courier New", monospace',
                      letterSpacing: '0.07em',
                      marginTop: '4px',
                      textTransform: 'uppercase',
                    }}>
                      {videoMeta.author}
                    </div>
                  )}
                </div>
              )}
              <div style={{
                width: isMobile ? '56px' : '64px',
                height: isMobile ? '56px' : '64px',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                border: darkBg ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.10)',
                flexShrink: 0,
              }}>
                <img src={thumbUrl} alt="album art" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.38)', transformOrigin: 'center' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* <DevPanel devParamsRef={devParamsRef} onParamsChange={() => redrawCurrentRef.current?.()} /> */}

      {/* Toast — slides in from top, stays until dismissed */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: isMobile ? '4.5rem' : '5.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99998,
            width: 'calc(100% - 2rem)',
            maxWidth: '360px',
            background: 'rgba(255,255,255,0.48)',
            border: '1px solid rgba(255,255,255,0.55)',
            borderRadius: '12px',
            padding: '0.8rem 0.9rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.7rem',
            animation: 'toastIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {toast.thumb && (
            <div style={{
              flexShrink: 0,
              width: '44px', height: '44px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: darkBg ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.07)',
              position: 'relative',
            }}>
              <img src={toast.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.38)', transformOrigin: 'center', filter: 'grayscale(0.35) brightness(0.65)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="8" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Row 1: icon + title inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '1.4rem' }}>
              {!toast.thumb && (
                <img src="/images/lab/youtube-color-icon.svg" alt="" style={{ flexShrink: 0, width: 18, height: 18 }} />
              )}
              <span style={{
                fontFamily: 'FunnelDisplay, sans-serif',
                fontSize: '13px', fontWeight: 600,
                color: 'rgba(0,0,0,0.82)',
                lineHeight: 1.3,
              }}>
                {toast.title}
              </span>
            </div>
            {/* Row 2: hint */}
            <div style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '10.5px',
              letterSpacing: '0.02em',
              color: 'rgba(0,0,0,0.48)',
              lineHeight: 1.5,
              marginTop: '5px',
            }}>
              {toast.hint}
            </div>
          </div>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            style={{
              position: 'absolute',
              top: '0.5rem', right: '0.5rem',
              width: '20px', height: '20px',
              padding: 0, border: 'none',
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {showUrlInput && (
        <div
          onClick={() => setShowUrlInput(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: darkBg ? '#111' : '#fff',
              borderRadius: '16px',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '360px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}
          >
            <div style={{
              fontFamily: '"Courier New", monospace',
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: darkBg ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
              textTransform: 'uppercase',
            }}>
              Paste a YouTube URL
            </div>
            <input
              autoFocus
              type="url"
              value={mobileInputVal}
              onChange={e => setMobileInputVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setShowUrlInput(false)
                  processUrl(mobileInputVal.trim())
                }
              }}
              placeholder="https://youtube.com/watch?v=..."
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: darkBg ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.15)',
                background: darkBg ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: darkBg ? '#fff' : '#000',
                fontFamily: '"Courier New", monospace',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => {
                setShowUrlInput(false)
                processUrl(mobileInputVal.trim())
              }}
              style={{
                padding: '0.75rem',
                borderRadius: '10px',
                background: '#0b3e88',
                color: '#fff',
                border: 'none',
                fontFamily: '"Courier New", monospace',
                fontSize: '12px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Play
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
