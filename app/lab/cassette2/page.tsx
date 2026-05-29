'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
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
  fontSize: 5,
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

  function draw(text: string, showCursor: boolean) {
    const p = devParamsRef.current
    const cw = Math.max(1, Math.round(p.canvasW))
    const ch = Math.max(1, Math.round(p.canvasH))

    // Resize canvas if dimensions changed (clears it automatically)
    if (canvas.width !== cw) canvas.width = cw
    if (canvas.height !== ch) canvas.height = ch

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, cw, ch)

    if (p.showBorder) {
      // Canvas boundary
      ctx.strokeStyle = '#ff00ff'
      ctx.lineWidth = Math.max(2, Math.round(cw / 64))
      ctx.strokeRect(1, 1, cw - 2, ch - 2)
      // Center crosshair
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch)
      ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2)
      ctx.stroke()
      // Origin marker — red square at (0,0)
      const ms = Math.max(4, Math.round(cw / 20))
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(0, 0, ms, ms)
      // Text anchor — cyan crosshair at (cw/2+textX, ch/2+textY)
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
    ctx.translate(cw / 2 + p.textX, ch / 2 + p.textY)
    ctx.rotate(p.canvasRotation)
    if (p.mirrorX) ctx.scale(-1, 1)
    ctx.font = `${fs}px "Press Start 2P", monospace`
    ctx.fillStyle = '#00ff88'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text.slice(0, 14), 0, 0)
    if (showCursor) {
      const tw = ctx.measureText(text.slice(0, 14)).width
      const curH = Math.round(fs * 1.2)
      ctx.fillRect(tw / 2 + 4, -curH / 2, 3, curH)
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
    updateDisplay(lastText, lastBlinking)
  }

  function dispose() {
    if (interval) clearInterval(interval)
    tex.dispose()
    ;(mesh.material as THREE.MeshStandardMaterial).dispose()
  }

  return { updateDisplay, redrawCurrent, dispose }
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
  onReady: (fn: (text: string, blinking?: boolean) => void, redraw: () => void) => void
  devParamsRef: { current: DevParams }
}

function WalkmanModel({ onPasteClick, onReady, devParamsRef }: WalkmanProps) {
  const { scene } = useGLTF('/models/walkman/walkman.glb')
  const { scene: threeScene } = useThree()

  const reel1 = useRef<THREE.Object3D | null>(null)
  const reel2 = useRef<THREE.Object3D | null>(null)
  const disposeRef = useRef<(() => void) | null>(null)
  const onPasteClickRef = useRef(onPasteClick)
  useEffect(() => { onPasteClickRef.current = onPasteClick }, [onPasteClick])

  const btnMeshes = useRef<THREE.Object3D[]>([])
  const btnOrigScale = useRef<THREE.Vector3[]>([])
  const btnOrigPos = useRef<THREE.Vector3[]>([])
  const btnPress = useRef(0)

  const rippleMeshRef = useRef<THREE.Mesh | null>(null)
  const rippleT = useRef(1)
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
    btnMeshes.current = []
    btnOrigScale.current = []
    btnOrigPos.current = []

    scene.traverse((obj) => {
      const n = obj.name
      if (n === 'Inside1_low001') reel1.current = obj
      if (n === 'Inside2_low001') reel2.current = obj
      if (n === '8Bit_screen') screenMesh = obj as THREE.Mesh

      if (n === 'Paste_click_button' || n === 'Cube003' || n === 'Cube003_1') {
        btnMeshes.current.push(obj)
        btnOrigScale.current.push(obj.scale.clone())
        btnOrigPos.current.push(obj.position.clone())
      }

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
      const { updateDisplay, redrawCurrent, dispose } = createDisplayUpdater(screenMesh as THREE.Mesh, devParamsRef)
      disposeRef.current = dispose
      onReady(updateDisplay, redrawCurrent)
      updateDisplay('PASTE URL', true)
      document.fonts.load('5px "Press Start 2P"').then(() => {
        updateDisplay('PASTE URL', true)
      })
    }

    return () => { disposeRef.current?.() }
  }, [scene])

  useFrame(({ camera }, delta) => {
    const playing = window.ytPlayer?.getPlayerState?.() === 1
    if (playing) {
      if (reel1.current) reel1.current.rotation.z -= delta * 1.8
      if (reel2.current) reel2.current.rotation.z -= delta * 1.8
    }

    if (btnPress.current > 0) {
      btnPress.current = Math.max(0, btnPress.current - delta * 9)
      const t = Math.sin(btnPress.current * Math.PI)
      btnMeshes.current.forEach((mesh, i) => {
        const os = btnOrigScale.current[i]
        const op = btnOrigPos.current[i]
        if (os) mesh.scale.set(os.x * (1 - t * 0.20), os.y * (1 - t * 0.45), os.z * (1 - t * 0.20))
        if (op) { mesh.position.copy(op); mesh.position.y -= t * 0.10 }
        if ((mesh as THREE.Mesh).isMesh) {
          const mat = (mesh as THREE.Mesh).material
          const mats = Array.isArray(mat) ? mat : [mat]
          mats.forEach(m => {
            if (m instanceof THREE.MeshStandardMaterial) { m.emissiveIntensity = t * 0.8; m.emissive.setHex(0xffffff); m.needsUpdate = true }
          })
        }
      })
    } else {
      btnMeshes.current.forEach((mesh, i) => {
        if (btnOrigScale.current[i]) mesh.scale.copy(btnOrigScale.current[i])
        if (btnOrigPos.current[i]) mesh.position.copy(btnOrigPos.current[i])
        if ((mesh as THREE.Mesh).isMesh) {
          const mat = (mesh as THREE.Mesh).material
          const mats = Array.isArray(mat) ? mat : [mat]
          mats.forEach(m => {
            if (m instanceof THREE.MeshStandardMaterial) { m.emissiveIntensity = 0; m.needsUpdate = true }
          })
        }
      })
    }

    if (rippleT.current < 1 && rippleMeshRef.current) {
      rippleT.current = Math.min(1, rippleT.current + delta / 0.4)
      const t = rippleT.current
      rippleMeshRef.current.scale.setScalar(1 + t * 5)
      rippleMeshRef.current.lookAt(camera.position)
      ;(rippleMeshRef.current.material as THREE.MeshBasicMaterial).opacity = 1 - t
      if (t >= 1) {
        threeScene.remove(rippleMeshRef.current)
        rippleMeshRef.current.geometry.dispose()
        ;(rippleMeshRef.current.material as THREE.Material).dispose()
        rippleMeshRef.current = null
      }
    }
  })

  const isBtn = (name: string) =>
    name === 'Paste_click_button' || name === 'Cube003' || name === 'Cube003_1'

  const handlePointerOver = useCallback((e: any) => {
    if (isBtn(e.object?.name ?? '')) { document.body.style.cursor = 'pointer'; isHovered.current = true }
  }, [])

  const handlePointerOut = useCallback((e: any) => {
    if (isBtn(e.object?.name ?? '')) { document.body.style.cursor = 'default'; isHovered.current = false }
  }, [])

  const handlePointerDown = useCallback((e: any) => {
    if (isBtn(e.object?.name ?? '')) {
      e.stopPropagation()
      btnPress.current = 1
      if (rippleMeshRef.current) {
        threeScene.remove(rippleMeshRef.current)
        rippleMeshRef.current.geometry.dispose()
        ;(rippleMeshRef.current.material as THREE.Material).dispose()
        rippleMeshRef.current = null
      }
      const worldPos = new THREE.Vector3()
      e.object.getWorldPosition(worldPos)
      const geo = new THREE.TorusGeometry(0.18, 0.028, 8, 48)
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 1.0, side: THREE.DoubleSide })
      const torus = new THREE.Mesh(geo, mat)
      torus.position.copy(worldPos)
      threeScene.add(torus)
      rippleMeshRef.current = torus
      rippleT.current = 0
    }
  }, [threeScene])

  const handleClick = useCallback((e: any) => {
    e.stopPropagation()
    if (isBtn(e.object?.name ?? '')) { btnPress.current = 1; onPasteClickRef.current() }
  }, [])

  return (
    <primitive
      object={scene}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
  )
}

useGLTF.preload('/models/walkman/walkman.glb')

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Cassette2() {
  const [url, setUrl] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState('')
  const [apiReady, setApiReady] = useState(false)
  const updateDisplayRef = useRef<((text: string, blinking?: boolean) => void) | null>(null)
  const redrawCurrentRef = useRef<(() => void) | null>(null)
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

  const stableHandlePasteClick = useCallback(() => {
    const trimmed = urlRef.current.trim()
    if (!trimmed) {
      updateDisplayRef.current?.('NO URL', true)
      setTimeout(() => updateDisplayRef.current?.('PASTE URL', true), 2000)
      return
    }
    const id = extractVideoId(trimmed)
    if (!id) {
      updateDisplayRef.current?.('BAD URL :(', true)
      setTimeout(() => updateDisplayRef.current?.('PASTE URL', true), 2000)
      return
    }
    setError('')
    updateDisplayRef.current?.(trimmed, false)
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
          onStateChange: (e: any) => setIsPlaying(e.data === window.YT.PlayerState.PLAYING),
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
            devParamsRef={devParamsRef}
            onReady={(fn, redraw) => { updateDisplayRef.current = fn; redrawCurrentRef.current = redraw }}
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
          transform: 'translateX(-50%)', width: 'min(90vw, 500px)',
          zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
        }}
      >
        {error && <span style={{ color: '#cc2200', fontSize: 12, fontFamily: '"Courier New", monospace' }}>{error}</span>}
        <div style={{ display: 'flex', width: '100%' }}>
          <input
            value={url}
            onChange={e => { setUrl(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && stableHandlePasteClick()}
            placeholder="Paste a YouTube URL..."
            style={{
              flex: 1, padding: '12px 16px',
              background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.15)',
              borderRight: 'none', borderRadius: '8px 0 0 8px',
              color: '#111', fontSize: 14, outline: 'none', fontFamily: 'FunnelDisplay, sans-serif',
            }}
          />
          <button
            onClick={stableHandlePasteClick}
            style={{
              padding: '12px 24px', background: '#111', color: '#fff', border: 'none',
              borderRadius: '0 8px 8px 0', fontSize: 14, cursor: 'pointer',
              fontFamily: 'FunnelDisplay, sans-serif', fontWeight: 600,
              letterSpacing: '0.03em', whiteSpace: 'nowrap',
            }}
          >
            Load
          </button>
        </div>
        {isPlaying
          ? <span style={{ color: 'rgba(0,160,80,0.8)', fontSize: 11, fontFamily: '"Courier New", monospace', letterSpacing: '0.08em' }}>PLAYING</span>
          : <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: 11, fontFamily: 'FunnelDisplay, sans-serif' }}>Paste a URL, then click Load or the Walkman</span>
        }
      </div>

      <DevPanel devParamsRef={devParamsRef} onParamsChange={() => redrawCurrentRef.current?.()} />
    </div>
  )
}
