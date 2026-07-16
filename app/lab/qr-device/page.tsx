'use client'

import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { gsap } from 'gsap'

// ─── Types ────────────────────────────────────────────────────────────────────
type ModuleShape = 'square'|'circle'|'rounded'|'diamond'|'star'|'squircle'|'leaf'|'cross'|'hexagon'|'triangle'|'flower'
type FinderStyle = 'default'|'rounded'|'circle'|'leaf'|'bracket'|'diamond-eye'|'flower-sq'|'flower-circ'|'diamond-sq'|'diamond-circ'|'star-sq'|'star-circ'|'diamond2-sq'
type ECLevel     = 'L'|'M'|'Q'|'H'
type GradType    = 'L'|'R'|'C'
type ActivePanel = 'none'|'preset'|'texture'|'shape'|'finder'|'bg'|'fg'|'gradient'

interface GStop { id: string; color: string; position: number }

interface QRSettings {
  text: string
  moduleShape: ModuleShape
  cornerRoundness: number
  fgColor: string
  bgColor: string
  gradientEnabled: boolean
  gradientType: GradType
  gradientStops: GStop[]
  gradientAngle: number
  ecLevel: ECLevel
  finderStyle: FinderStyle
  gradientSpread: number
  logoDataUrl: string | null
}

const DEFAULT_STOPS: GStop[] = [
  { id: 'a', color: '#6366f1', position: 0 },
  { id: 'b', color: '#ec4899', position: 100 },
]

const DEFAULTS: QRSettings = {
  text: 'https://www.satishhebbal.design/',
  moduleShape: 'rounded',
  cornerRoundness: 40,
  fgColor: '#111111',
  bgColor: '#ffffff',
  gradientEnabled: false,
  gradientType: 'L',
  gradientStops: DEFAULT_STOPS,
  gradientAngle: 45,
  ecLevel: 'H',
  finderStyle: 'rounded',
  gradientSpread: 5,
  logoDataUrl: null,
}

const GRAD_PRESETS = [
  { name: 'Sunset',   stops: [{id:'a',color:'#ff6b35',position:0},{id:'b',color:'#f72585',position:50},{id:'c',color:'#7209b7',position:100}] },
  { name: 'Ocean',    stops: [{id:'a',color:'#00c9ff',position:0},{id:'b',color:'#003566',position:100}] },
  { name: 'Neon',     stops: [{id:'a',color:'#00f5a0',position:0},{id:'b',color:'#00d9f5',position:100}] },
  { name: 'Gold',     stops: [{id:'a',color:'#8b6914',position:0},{id:'b',color:'#ffd700',position:50},{id:'c',color:'#8b6914',position:100}] },
  { name: 'Aurora',   stops: [{id:'a',color:'#22c55e',position:0},{id:'b',color:'#8b5cf6',position:50},{id:'c',color:'#3b82f6',position:100}] },
  { name: 'Fire',     stops: [{id:'a',color:'#ff0000',position:0},{id:'b',color:'#ff6d00',position:50},{id:'c',color:'#ffba08',position:100}] },
  { name: 'Candy',    stops: [{id:'a',color:'#f472b6',position:0},{id:'b',color:'#a78bfa',position:50},{id:'c',color:'#60a5fa',position:100}] },
  { name: 'Midnight', stops: [{id:'a',color:'#302b63',position:0},{id:'b',color:'#0f0c29',position:50},{id:'c',color:'#24243e',position:100}] },
]

// ─── SVG path helpers ─────────────────────────────────────────────────────────
function rrect(x: number, y: number, s: number, pct: number): string {
  const r = Math.min((pct/100)*(s/2), s/2)
  if (r <= 0) return `M${x},${y}h${s}v${s}h-${s}z`
  return `M${x+r},${y}h${s-2*r}a${r},${r} 0 0 1 ${r},${r}v${s-2*r}a${r},${r} 0 0 1 -${r},${r}h-${s-2*r}a${r},${r} 0 0 1 -${r},-${r}v-${s-2*r}a${r},${r} 0 0 1 ${r},-${r}z`
}
function circ(cx: number, cy: number, r: number): string {
  return `M${cx-r},${cy}a${r},${r} 0 1 0 ${2*r},0a${r},${r} 0 1 0 -${2*r},0`
}
function squircle(x: number, y: number, s: number): string {
  const cx=x+s/2,cy=y+s/2,r=s/2*0.92,k=r*0.89
  return `M${cx},${cy-r}C${cx+k},${cy-r} ${cx+r},${cy-k} ${cx+r},${cy}C${cx+r},${cy+k} ${cx+k},${cy+r} ${cx},${cy+r}C${cx-k},${cy+r} ${cx-r},${cy+k} ${cx-r},${cy}C${cx-r},${cy-k} ${cx-k},${cy-r} ${cx},${cy-r}z`
}
function leafPath(x: number, y: number, s: number): string {
  const cx=x+s/2,cy=y+s/2,rx=s*0.47,ry=s*0.36
  return `M${cx-rx},${cy}Q${cx},${cy-ry*1.6} ${cx+rx},${cy}Q${cx},${cy+ry*1.6} ${cx-rx},${cy}z`
}
function cross(x: number, y: number, s: number): string {
  const t=s*0.16,e=s/2*0.88,cx=x+s/2,cy=y+s/2
  return `M${cx-t},${cy-e}h${2*t}v${e-t}h${e-t}v${2*t}h-${e-t}v${e-t}h-${2*t}v-${e-t}h-${e-t}v-${2*t}h${e-t}z`
}
function hexagon(x: number, y: number, s: number): string {
  const cx=x+s/2,cy=y+s/2,r=s*0.48
  return Array.from({length:6},(_,i)=>{
    const a=(Math.PI/3)*i-Math.PI/6
    return `${i===0?'M':'L'}${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`
  }).join('')+'z'
}
function triangle(x: number, y: number, s: number): string {
  const cx=x+s/2,cy=y+s/2,r=s*0.46,h=r*Math.sqrt(3)/2
  return `M${cx},${cy-r}L${cx+h},${cy+r/2}L${cx-h},${cy+r/2}z`
}
function flowerPath(ox: number, oy: number, s: number): string {
  const k = s / 41
  const x = (v: number) => (ox + v * k).toFixed(2)
  const y = (v: number) => (oy + v * k).toFixed(2)
  return [
    `M${x(41)},${y(10)}`,
    `C${x(41)},${y(16.0751)} ${x(36.0751)},${y(21)} ${x(30)},${y(21)}`,
    `C${x(35.738)},${y(21)} ${x(40.4478)},${y(25.3936)} ${x(40.9531)},${y(31)}`,
    `H${x(41)}V${y(41)}H${x(31)}`,
    `C${x(24.9249)},${y(41)} ${x(20)},${y(36.0751)} ${x(20)},${y(30)}`,
    `C${x(20)},${y(35.738)} ${x(15.6064)},${y(40.4478)} ${x(10)},${y(40.9531)}`,
    `V${y(41)}H${x(0)}V${y(31)}H${x(0.046875)}`,
    `C${x(0.552189)},${y(25.3936)} ${x(5.26202)},${y(21)} ${x(11)},${y(21)}`,
    `C${x(4.92487)},${y(21)} ${x(0)},${y(16.0751)} ${x(0)},${y(10)}`,
    `V${y(0)}H${x(10)}V${y(0.046875)}`,
    `C${x(15.6064)},${y(0.552189)} ${x(20)},${y(5.26202)} ${x(20)},${y(11)}`,
    `C${x(20)},${y(4.92487)} ${x(24.9249)},${y(0)} ${x(31)},${y(0)}`,
    `H${x(41)}V${y(10)}z`,
  ].join(' ')
}
function diamond(x: number, y: number, s: number): string {
  const cx=x+s/2,cy=y+s/2,h=s*0.50
  return `M${cx},${cy-h}L${cx+h},${cy}L${cx},${cy+h}L${cx-h},${cy}z`
}
function star(x: number, y: number, s: number): string {
  const cx=x+s/2,cy=y+s/2,outer=s*0.47,inner=s*0.21
  return Array.from({length:10},(_,i)=>{
    const a=(Math.PI/5)*i-Math.PI/2,r=i%2===0?outer:inner
    return `${i===0?'M':'L'}${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`
  }).join('')+'z'
}

function modulePath(row: number, col: number, shape: ModuleShape, roundness: number, cell: number): string {
  const x=col*cell,y=row*cell,pad=cell*0.06,sz=cell-pad*2
  const cx=x+cell/2,cy=y+cell/2
  switch(shape) {
    case 'circle':   return circ(cx,cy,sz/2)
    case 'squircle': return squircle(x+pad,y+pad,sz)
    case 'leaf':     return leafPath(x+pad,y+pad,sz)
    case 'cross':    return cross(x+pad,y+pad,sz)
    case 'hexagon':  return hexagon(x+pad,y+pad,sz)
    case 'triangle': return triangle(x+pad,y+pad,sz)
    case 'diamond':  return diamond(x+pad,y+pad,sz)
    case 'star':     return star(x+pad,y+pad,sz)
    case 'rounded':  return rrect(x+pad,y+pad,sz,roundness)
    case 'flower':   return flowerPath(x+pad,y+pad,sz)
    default:         return rrect(x+pad,y+pad,sz,0)
  }
}

// ─── Custom finder helpers (all SVGs are 78×78) ───────────────────────────────
function _fScale(ox: number, oy: number, cell: number) {
  const k = (cell * 7) / 78
  return {
    x: (v: number) => (ox + v * k).toFixed(2),
    y: (v: number) => (oy + v * k).toFixed(2),
  }
}
function _fDiamondOuter(ox: number, oy: number, cell: number): string {
  const { x, y } = _fScale(ox, oy, cell)
  return [
    `M${x(78)},${y(39)} L${x(39)},${y(78)} L${x(0)},${y(39)} L${x(39)},${y(0)} Z`,
    `M${x(10)},${y(39)} L${x(39)},${y(68)} L${x(68)},${y(39)} L${x(39)},${y(10)} Z`,
  ].join(' ')
}
function _fSquareOuter(ox: number, oy: number, cell: number): string {
  const { x, y } = _fScale(ox, oy, cell)
  return `M${x(78)},${y(78)} H${x(0)} V${y(0)} H${x(78)} V${y(78)} Z M${x(10)},${y(10)} V${y(68)} H${x(68)} V${y(10)} H${x(10)} Z`
}
function _fCircleOuter(ox: number, oy: number, cell: number): string {
  const S = cell * 7, cx = ox + S / 2, cy = oy + S / 2
  return circ(cx, cy, S / 2) + ' ' + circ(cx, cy, S / 2 * (29 / 39))
}
function _fFlowerCenter(ox: number, oy: number, cell: number): string {
  const { x, y } = _fScale(ox, oy, cell)
  return [
    `M${x(56)},${y(30.0488)}`,
    `C${x(56)},${y(34.9385)} ${x(52.0361)},${y(38.9024)} ${x(47.1463)},${y(38.9024)}`,
    `C${x(51.7647)},${y(38.9024)} ${x(55.5556)},${y(42.4387)} ${x(55.9623)},${y(46.9512)}`,
    `H${x(56)} V${y(55)} H${x(47.9512)}`,
    `C${x(43.0615)},${y(55)} ${x(39.0976)},${y(51.0361)} ${x(39.0976)},${y(46.1463)}`,
    `C${x(39.0976)},${y(50.7647)} ${x(35.5613)},${y(54.5556)} ${x(31.0488)},${y(54.9623)}`,
    `V${y(55)} H${x(23)} V${y(46.9512)} H${x(23.0377)}`,
    `C${x(23.4444)},${y(42.4387)} ${x(27.2353)},${y(38.9024)} ${x(31.8537)},${y(38.9024)}`,
    `C${x(26.9639)},${y(38.9024)} ${x(23)},${y(34.9385)} ${x(23)},${y(30.0488)}`,
    `V${y(22)} H${x(31.0488)} V${y(22.0377)}`,
    `C${x(35.5613)},${y(22.4444)} ${x(39.0976)},${y(26.2353)} ${x(39.0976)},${y(30.8537)}`,
    `C${x(39.0976)},${y(25.9639)} ${x(43.0615)},${y(22)} ${x(47.9512)},${y(22)}`,
    `H${x(56)} V${y(30.0488)}Z`,
  ].join(' ')
}
function _fDiamondCenter(ox: number, oy: number, cell: number): string {
  const { x, y } = _fScale(ox, oy, cell)
  return [
    `M${x(60.4185)},${y(38.5074)}`,
    `C${x(48.2477)},${y(38.8018)} ${x(38.4756)},${y(48.3115)} ${x(38.4756)},${y(60)}`,
    `C${x(38.4756)},${y(48.7849)} ${x(29.4798)},${y(39.5791)} ${x(18)},${y(38.5914)}`,
    `V${y(38.4086)}`,
    `C${x(29.4798)},${y(37.4209)} ${x(38.4756)},${y(28.2151)} ${x(38.4756)},${y(17)}`,
    `C${x(38.4756)},${y(28.8741)} ${x(48.5604)},${y(38.5)} ${x(61)},${y(38.5)}`,
    `L${x(60.4185)},${y(38.5074)}Z`,
  ].join(' ')
}
function _fStarCenter(ox: number, oy: number, cell: number): string {
  const { x, y } = _fScale(ox, oy, cell)
  return [
    `M${x(37.4007)},${y(23.1287)}`,
    `C${x(37.9359)},${y(21.6238)} ${x(40.0641)},${y(21.6238)} ${x(40.5993)},${y(23.1287)}`,
    `L${x(42.2674)},${y(27.8195)}`,
    `C${x(42.6044)},${y(28.7672)} ${x(43.687)},${y(29.2156)} ${x(44.5954)},${y(28.7838)}`,
    `L${x(49.0919)},${y(26.6464)}`,
    `C${x(50.5344)},${y(25.9607)} ${x(52.0393)},${y(27.4656)} ${x(51.3536)},${y(28.9081)}`,
    `L${x(49.2162)},${y(33.4046)}`,
    `C${x(48.7844)},${y(34.313)} ${x(49.2328)},${y(35.3956)} ${x(50.1805)},${y(35.7326)}`,
    `L${x(54.8713)},${y(37.4007)}`,
    `C${x(56.3762)},${y(37.9359)} ${x(56.3762)},${y(40.0641)} ${x(54.8713)},${y(40.5993)}`,
    `L${x(50.1805)},${y(42.2674)}`,
    `C${x(49.2328)},${y(42.6044)} ${x(48.7844)},${y(43.687)} ${x(49.2162)},${y(44.5954)}`,
    `L${x(51.3536)},${y(49.0919)}`,
    `C${x(52.0393)},${y(50.5344)} ${x(50.5344)},${y(52.0393)} ${x(49.0919)},${y(51.3536)}`,
    `L${x(44.5954)},${y(49.2162)}`,
    `C${x(43.687)},${y(48.7844)} ${x(42.6044)},${y(49.2328)} ${x(42.2674)},${y(50.1805)}`,
    `L${x(40.5993)},${y(54.8713)}`,
    `C${x(40.0641)},${y(56.3762)} ${x(37.9359)},${y(56.3762)} ${x(37.4007)},${y(54.8713)}`,
    `L${x(35.7326)},${y(50.1805)}`,
    `C${x(35.3956)},${y(49.2328)} ${x(34.313)},${y(48.7844)} ${x(33.4046)},${y(49.2162)}`,
    `L${x(28.9081)},${y(51.3536)}`,
    `C${x(27.4656)},${y(52.0393)} ${x(25.9607)},${y(50.5344)} ${x(26.6464)},${y(49.0919)}`,
    `L${x(28.7838)},${y(44.5954)}`,
    `C${x(29.2156)},${y(43.687)} ${x(28.7672)},${y(42.6044)} ${x(27.8195)},${y(42.2674)}`,
    `L${x(23.1287)},${y(40.5993)}`,
    `C${x(21.6238)},${y(40.0641)} ${x(21.6238)},${y(37.9359)} ${x(23.1287)},${y(37.4007)}`,
    `L${x(27.8195)},${y(35.7326)}`,
    `C${x(28.7672)},${y(35.3956)} ${x(29.2156)},${y(34.313)} ${x(28.7838)},${y(33.4046)}`,
    `L${x(26.6464)},${y(28.9081)}`,
    `C${x(25.9607)},${y(27.4656)} ${x(27.4656)},${y(25.9607)} ${x(28.9081)},${y(26.6464)}`,
    `L${x(33.4046)},${y(28.7838)}`,
    `C${x(34.313)},${y(29.2156)} ${x(35.3956)},${y(28.7672)} ${x(35.7326)},${y(27.8195)}`,
    `L${x(37.4007)},${y(23.1287)}Z`,
  ].join(' ')
}

function finderPath(ox: number, oy: number, cell: number, style: FinderStyle): string {
  const outer=cell*7,cx=ox+outer/2,cy=oy+outer/2
  switch(style) {
    case 'circle': {
      return circ(cx,cy,cell*3.3)+' '+circ(cx,cy,cell*2.3)+' '+circ(cx,cy,cell*1.3)
    }
    case 'rounded': {
      return rrect(ox+cell*0.1,oy+cell*0.1,cell*6.8,55)+' '+rrect(ox+cell*1.0,oy+cell*1.0,cell*5.0,42)+' '+rrect(ox+cell*2.0,oy+cell*2.0,cell*3.0,30)
    }
    case 'leaf': {
      const r=outer/2-cell*0.2,rx=r,ry=r*0.82,irx=rx-cell,iry=ry-cell
      return `M${cx-rx},${cy}Q${cx},${cy-ry*1.1} ${cx+rx},${cy}Q${cx},${cy+ry*1.1} ${cx-rx},${cy}z`+' '+`M${cx-irx},${cy}Q${cx},${cy-iry*1.1} ${cx+irx},${cy}Q${cx},${cy+iry*1.1} ${cx-irx},${cy}z`+' '+circ(cx,cy,cell*1.3)
    }
    case 'bracket': {
      const thick=cell*1.05,arm=cell*2.5
      function lbr(px:number,py:number,dx:number,dy:number):string{const x2=px+dx*arm,y3=py+dy*thick,x4=px+dx*thick,y5=py+dy*arm;return `M${px},${py}L${x2},${py}L${x2},${y3}L${x4},${y3}L${x4},${y5}L${px},${y5}z`}
      return [lbr(ox,oy,1,1),lbr(ox+outer,oy,-1,1),lbr(ox,oy+outer,1,-1),lbr(ox+outer,oy+outer,-1,-1),circ(cx,cy,cell*1.35)].join(' ')
    }
    case 'diamond-eye': {
      const oD=`M${cx},${oy+cell*0.2}L${ox+outer-cell*0.2},${cy}L${cx},${oy+outer-cell*0.2}L${ox+cell*0.2},${cy}z`
      const rD=`M${cx},${oy+cell*1.2}L${ox+outer-cell*1.2},${cy}L${cx},${oy+outer-cell*1.2}L${ox+cell*1.2},${cy}z`
      return oD+' '+rD+' '+diamond(ox+cell*2.1,oy+cell*2.1,cell*2.8)
    }
    case 'flower-sq':    return _fSquareOuter(ox,oy,cell) + ' ' + _fFlowerCenter(ox,oy,cell)
    case 'flower-circ':  return _fCircleOuter(ox,oy,cell) + ' ' + _fFlowerCenter(ox,oy,cell)
    case 'diamond-sq':   return _fSquareOuter(ox,oy,cell) + ' ' + _fDiamondCenter(ox,oy,cell)
    case 'diamond-circ': return _fCircleOuter(ox,oy,cell) + ' ' + _fDiamondCenter(ox,oy,cell)
    case 'star-sq':      return _fSquareOuter(ox,oy,cell) + ' ' + _fStarCenter(ox,oy,cell)
    case 'star-circ':    return _fCircleOuter(ox,oy,cell) + ' ' + _fStarCenter(ox,oy,cell)
    case 'diamond2-sq':  return _fDiamondOuter(ox,oy,cell) + ' ' + _fDiamondCenter(ox,oy,cell)
    default: {
      return `M${ox},${oy}h${outer}v${outer}h-${outer}z M${ox+cell},${oy+cell}h${outer-2*cell}v${outer-2*cell}h-${outer-2*cell}z `+rrect(ox+cell*2,oy+cell*2,cell*3,0)
    }
  }
}

function normalizeHex(hex: string): string | null {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return '#' + h.toLowerCase()
}

function hexToHue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
    if (h < 0) h += 360
  }
  return Math.round(h)
}

function hexToRgb(hex: string): [number,number,number] {
  let h=hex.replace('#','')
  if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]
}
function lerpColor(a: string,b: string,t: number): string {
  const [r1,g1,b1]=hexToRgb(a),[r2,g2,b2]=hexToRgb(b)
  const r=Math.round(r1+(r2-r1)*t),g=Math.round(g1+(g2-g1)*t),bl=Math.round(b1+(b2-b1)*t)
  return `#${[r,g,bl].map(v=>v.toString(16).padStart(2,'0')).join('')}`
}
function sampleStops(stops: GStop[], pct: number): string {
  const s=[...stops].sort((a,b)=>a.position-b.position)
  if(pct<=s[0].position) return s[0].color
  if(pct>=s[s.length-1].position) return s[s.length-1].color
  for(let i=0;i<s.length-1;i++){
    if(pct>=s[i].position&&pct<=s[i+1].position){
      const t=(pct-s[i].position)/(s[i+1].position-s[i].position)
      return lerpColor(s[i].color,s[i+1].color,t)
    }
  }
  return s[s.length-1].color
}

// ─── QR matrix ────────────────────────────────────────────────────────────────
async function getMatrix(text: string, ecLevel: ECLevel): Promise<boolean[][]> {
  if (!text.trim()) return []
  try {
    const data = QRCode.create(text, { errorCorrectionLevel: ecLevel })
    const sz = data.modules.size
    return Array.from({ length: sz }, (_,r) =>
      Array.from({ length: sz }, (_,c) => !!data.modules.get(r,c))
    )
  } catch { return [] }
}

// ─── SVG builder ─────────────────────────────────────────────────────────────
function buildSVG(matrix: boolean[][], s: QRSettings): string {
  if (!matrix.length) return ''
  const size=matrix.length,cell=10,dim=size*cell,pad=cell*2,total=dim+pad*2

  let gradDef='',gradFill=''
  if (s.gradientEnabled) {
    const sorted=[...s.gradientStops].sort((a,b)=>a.position-b.position)
    const stops=sorted.map(st=>`<stop offset="${st.position}%" stop-color="${st.color}"/>`).join('')
    const diag=Math.hypot(dim/2,dim/2)
    if (s.gradientType==='R') {
      gradDef=`<radialGradient id="qGrad" cx="${dim/2}" cy="${dim/2}" r="${dim*0.65}" gradientUnits="userSpaceOnUse">${stops}</radialGradient>`
      gradFill='url(#qGrad)'
    } else if (s.gradientType==='C') {
      const N=72,cx=dim/2,cy=dim/2,r=diag*1.05
      let slices=''
      for(let i=0;i<N;i++){
        const pct=((i+0.5)/N)*100,color=sampleStops(sorted,pct)
        const startRad=(s.gradientAngle*Math.PI/180)-Math.PI/2
        const a1=((i/N)*2*Math.PI)+startRad,a2=(((i+1)/N)*2*Math.PI)+startRad
        const x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1),x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2)
        slices+=`<path d="M${cx},${cy}L${x1.toFixed(2)},${y1.toFixed(2)}A${r.toFixed(2)},${r.toFixed(2)} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)}z" fill="${color}"/>`
      }
      gradDef=`<pattern id="qGrad" x="0" y="0" width="${dim}" height="${dim}" patternUnits="userSpaceOnUse">${slices}</pattern>`
      gradFill='url(#qGrad)'
    } else {
      const rad=s.gradientAngle*Math.PI/180
      const x1=dim/2-diag*Math.cos(rad),y1=dim/2-diag*Math.sin(rad)
      const x2=dim/2+diag*Math.cos(rad),y2=dim/2+diag*Math.sin(rad)
      gradDef=`<linearGradient id="qGrad" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`
      gradFill='url(#qGrad)'
    }
  }

  const fill=gradFill||s.fgColor
  const bgRx=Math.round((s.cornerRoundness/100)*total*0.12)
  const finderOrigins=[{r:0,c:0},{r:0,c:size-7},{r:size-7,c:0}]
  const finderSet=new Set<string>()
  finderOrigins.forEach(({r,c})=>{for(let dr=0;dr<7;dr++)for(let dc=0;dc<7;dc++)finderSet.add(`${r+dr},${c+dc}`)})

  let dataPaths=''
  for(let r=0;r<size;r++)
    for(let c=0;c<size;c++)
      if(matrix[r][c]&&!finderSet.has(`${r},${c}`))
        dataPaths+=modulePath(r,c,s.moduleShape,s.cornerRoundness,cell)+' '

  let fPaths=''
  finderOrigins.forEach(({r,c})=>{fPaths+=finderPath(c*cell,r*cell,cell,s.finderStyle)+' '})

  let logoEl=''
  if(s.logoDataUrl&&s.ecLevel==='H'){
    const ls=dim*0.18,lx=pad+(dim-ls)/2,ly=pad+(dim-ls)/2
    logoEl=`<rect x="${lx-4}" y="${ly-4}" width="${ls+8}" height="${ls+8}" rx="${ls*0.12}" fill="${s.bgColor}"/>`
          +`<image href="${s.logoDataUrl}" x="${lx}" y="${ly}" width="${ls}" height="${ls}" preserveAspectRatio="xMidYMid meet"/>`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${total} ${total}" width="100%" height="100%">
  <defs>${gradDef}</defs>
  <rect width="${total}" height="${total}" rx="${bgRx}" ry="${bgRx}" fill="${s.bgColor}"/>
  <g transform="translate(${pad},${pad})">
    <path d="${dataPaths}${fPaths}" fill="${fill}" fill-rule="evenodd"/>
    ${logoEl}
  </g>
</svg>`
}

// ─── Hardware-style CSS ───────────────────────────────────────────────────────
type HwTheme = {
  device: React.CSSProperties
  btn: (active?: boolean) => React.CSSProperties
  inset: React.CSSProperties
  label: React.CSSProperties
  screen: React.CSSProperties
}

const HW_DAY: HwTheme = {
  device: {
    background: 'linear-gradient(160deg, #e8e8e8 0%, #d4d4d4 40%, #c8c8c8 70%, #d8d8d8 100%)',
    boxShadow: '0 40px 80px rgba(0,0,0,0.45), 0 20px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.1)',
    border: '1px solid #a0a0a0',
    borderRadius: 32,
    transition: 'background 0.65s ease, box-shadow 0.65s ease',
  },
  btn: (active = false) => ({
    background: active ? 'linear-gradient(145deg, #b8b8b8, #d0d0d0)' : 'linear-gradient(145deg, #e8e8e8, #c8c8c8)',
    boxShadow: active ? 'inset 2px 2px 5px #a0a0a0, inset -1px -1px 3px #f0f0f0' : '3px 3px 6px #b0b0b0, -2px -2px 5px #f4f4f4',
    border: '1px solid #b0b0b0',
    cursor: 'pointer', transition: 'all 0.1s', color: '#555',
    fontFamily: 'inherit', userSelect: 'none' as const,
  }),
  inset: {
    background: 'linear-gradient(160deg, #c4c4c4, #d8d8d8)',
    boxShadow: 'inset 2px 2px 6px #a8a8a8, inset -1px -1px 4px #e8e8e8',
    border: '1px solid #a8a8a8', borderRadius: 16,
  },
  label: {
    fontSize: 8, letterSpacing: 0, textTransform: 'uppercase' as const, color: '#888',
    fontFamily: 'UniversNext, sans-serif', fontWeight: 400, display: 'block',
    textAlign: 'center' as const, marginTop: 4,
  },
  screen: {
    background: '#1a1a1a', boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.8), inset 0 0 0 3px #111',
    borderRadius: 28, overflow: 'hidden',
  },
}

const HW_NIGHT: HwTheme = {
  device: {
    background: 'linear-gradient(160deg, #3d3d4a 0%, #2c2c34 40%, #252528 70%, #303038 100%)',
    boxShadow: [
      '0 40px 80px rgba(0,0,0,0.82)',
      '0 20px 40px rgba(0,0,0,0.62)',
      'inset 0 1px 0 rgba(120,140,200,0.18)',
      'inset 0 -1px 0 rgba(0,0,0,0.55)',
      '-24px 0 60px rgba(185,212,255,0.13)',
    ].join(', '),
    border: '1px solid #1c1c26', borderRadius: 32,
    transition: 'background 0.65s ease, box-shadow 0.65s ease',
  },
  btn: (active = false) => ({
    background: active ? 'linear-gradient(145deg, #252530, #333340)' : 'linear-gradient(145deg, #393944, #2b2b36)',
    boxShadow: active ? 'inset 2px 2px 5px #13131e, inset -1px -1px 3px #45454e' : '3px 3px 6px #11111a, -2px -2px 5px #373742',
    border: '1px solid #1b1b26',
    cursor: 'pointer', transition: 'all 0.1s', color: '#8890a8',
    fontFamily: 'inherit', userSelect: 'none' as const,
  }),
  inset: {
    background: 'linear-gradient(160deg, #252530, #1e1e28)',
    boxShadow: 'inset 2px 2px 6px #0d0d18, inset -1px -1px 4px #31313e',
    border: '1px solid #16161f', borderRadius: 16,
  },
  label: {
    fontSize: 8, letterSpacing: 0, textTransform: 'uppercase' as const, color: '#5e6070',
    fontFamily: 'UniversNext, sans-serif', fontWeight: 400, display: 'block',
    textAlign: 'center' as const, marginTop: 4,
  },
  screen: {
    background: '#1a1a1a', boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.8), inset 0 0 0 3px #111',
    borderRadius: 28, overflow: 'hidden',
  },
}

// ─── HSB Color Picker ─────────────────────────────────────────────────────────
function HSBPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hue, setHue] = useState(() => hexToHue(value))
  const [hexDraft, setHexDraft] = useState(value.toUpperCase())

  useEffect(() => { setHue(hexToHue(value)) }, [value])
  useEffect(() => { setHexDraft(value.toUpperCase()) }, [value])

  // Draw SB square
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    // White to hue gradient horizontal
    const gH = ctx.createLinearGradient(0,0,W,0)
    gH.addColorStop(0,'#fff')
    gH.addColorStop(1,`hsl(${hue},100%,50%)`)
    ctx.fillStyle = gH
    ctx.fillRect(0,0,W,H)
    // Transparent to black gradient vertical
    const gV = ctx.createLinearGradient(0,0,0,H)
    gV.addColorStop(0,'rgba(0,0,0,0)')
    gV.addColorStop(1,'rgba(0,0,0,1)')
    ctx.fillStyle = gV
    ctx.fillRect(0,0,W,H)
  }, [hue])

  function pickSBAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const x = Math.max(0,Math.min(1,(clientX-rect.left)/rect.width))
    const y = Math.max(0,Math.min(1,(clientY-rect.top)/rect.height))
    const s=x,b=1-y
    const h=hue/60,i=Math.floor(h),f=h-i,p=b*(1-s),q=b*(1-f*s),t=b*(1-(1-f)*s)
    const rgb=[[b,t,p],[q,b,p],[p,b,t],[p,q,b],[t,p,b],[b,p,q]][i%6]
    const hex='#'+rgb.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')
    onChange(hex)
  }
  function pickSB(e: React.MouseEvent<HTMLCanvasElement>) { pickSBAt(e.clientX, e.clientY) }

  const rowH = 28

  return (
    <div style={{ padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <canvas
        ref={canvasRef}
        width={180} height={140}
        style={{ width:'100%', height:140, borderRadius:0, cursor:'crosshair', display:'block' }}
        onMouseDown={pickSB}
        onMouseMove={e => { if(e.buttons===1) pickSB(e) }}
        onTouchStart={e => { e.preventDefault(); pickSBAt(e.touches[0].clientX, e.touches[0].clientY) }}
        onTouchMove={e => { e.preventDefault(); pickSBAt(e.touches[0].clientX, e.touches[0].clientY) }}
      />
      {/* Hue slider — outer div has no overflow:hidden so knob isn't clipped */}
      <div style={{ position:'relative', height:20 }}>
        <div style={{ position:'absolute', top:'50%', transform:'translateY(-50%)', left:0, right:0, height:14, borderRadius:7, overflow:'hidden',
          background:'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}/>
        <input type="range" min={0} max={360} value={hue}
          onChange={e=>setHue(Number(e.target.value))}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0, cursor:'pointer' }}/>
        <div style={{ position:'absolute', top:'50%', transform:'translate(-50%,-50%)', left:`${(hue/360)*100}%`,
          width:20, height:20, borderRadius:'50%',
          background:`conic-gradient(from 80deg,#c2c2c2 0deg,#f2f2f2 22deg,#d4d4d4 38deg,#bcbcbc 65deg,#efefef 88deg,#c8c8c8 108deg,#b8b8b8 140deg,#f4f4f4 162deg,#ccc 185deg,#c0c0c0 220deg,#ebebeb 245deg,#d0d0d0 268deg,#bbbbbb 300deg,#f0f0f0 328deg,#c6c6c6 348deg,#c2c2c2 360deg)`,
          boxShadow:'1px 2px 5px rgba(0,0,0,0.4)', border:'1px solid #b0b0b0',
          pointerEvents:'none' }}/>
      </div>

      {/* Color preview + hex */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div
          title="Selected color"
          style={{
            width: rowH, height: rowH, borderRadius: '50%', flexShrink: 0,
            background: value,
            boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.55)',
            border: '1px solid rgba(0,0,0,0.22)',
          }}
        />
        <input
          type="text"
          value={hexDraft}
          spellCheck={false}
          maxLength={7}
          aria-label="Hex color value"
          onChange={e => {
            const raw = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
            if (!/^#[0-9A-Fa-f]{0,6}$/.test(raw)) return
            setHexDraft(raw.toUpperCase())
            const normalized = normalizeHex(raw)
            if (normalized) onChange(normalized)
          }}
          onBlur={() => {
            const normalized = normalizeHex(hexDraft)
            if (normalized) onChange(normalized)
            else setHexDraft(value.toUpperCase())
          }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={{
            flex: 1, minWidth: 0, height: rowH, boxSizing: 'border-box',
            background: '#0d0d0d',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.9)',
            border: '1px solid #000',
            borderRadius: 9,
            padding: '0 8px',
            fontSize: 11,
            fontFamily: 'monospace',
            color: '#e0e0e0',
            outline: 'none',
            textAlign: 'center',
            letterSpacing: '0.04em',
            caretColor: '#aaa',
          }}
        />
      </div>
    </div>
  )
}

// ─── Rotary Knob ──────────────────────────────────────────────────────────────
function getKnobAngle(e: MouseEvent | React.MouseEvent, el: HTMLElement): number {
  const r = el.getBoundingClientRect()
  return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI
}

function Knob({ value, onChange, min=0, max=360, isNight=false }: { value: number; onChange: (v: number) => void; min?: number; max?: number; isNight?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const startAngle = useRef(0)
  const startVal = useRef(0)

  const rotation = ((value - min) / (max - min)) * 270 - 135

  function getAngleFromEl(clientX: number, clientY: number): number {
    const r = ref.current!.getBoundingClientRect()
    return Math.atan2(clientY - (r.top + r.height / 2), clientX - (r.left + r.width / 2)) * 180 / Math.PI
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!ref.current) return
    dragging.current = true
    startAngle.current = getKnobAngle(e, ref.current)
    startVal.current = value
    e.preventDefault()
  }

  function onTouchStart(e: React.TouchEvent) {
    if (!ref.current) return
    dragging.current = true
    startAngle.current = getAngleFromEl(e.touches[0].clientX, e.touches[0].clientY)
    startVal.current = value
    e.preventDefault()
  }

  useEffect(() => {
    function applyAngle(clientX: number, clientY: number) {
      if (!dragging.current || !ref.current) return
      let delta = getAngleFromEl(clientX, clientY) - startAngle.current
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      onChange(Math.round(Math.max(min, Math.min(max, startVal.current + (delta / 270) * (max - min)))))
    }
    function onMove(e: MouseEvent) { applyAngle(e.clientX, e.clientY) }
    function onUp() { dragging.current = false }
    function onTouchMove(e: TouchEvent) { if (!dragging.current) return; e.preventDefault(); applyAngle(e.touches[0].clientX, e.touches[0].clientY) }
    function onTouchEnd() { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [min, max, onChange])

  return (
    <div ref={ref} onMouseDown={onMouseDown} onTouchStart={onTouchStart}
      style={{ width:48, height:48, borderRadius:'50%', cursor:'grab', position:'relative', flexShrink:0,
        background: isNight ? 'linear-gradient(135deg, #3c3c46, #26262e)' : 'linear-gradient(135deg,rgb(241,241,241),rgb(182,182,182))',
        boxShadow: isNight ? '5px 5px 12px rgba(0,0,0,0.65)' : '5px 5px 12px rgba(0,0,0,0.35)' }}>
      {/* Highlight dot floating above the knob */}
      <div style={{ position:'absolute', top:-7, left:'50%', transform:'translateX(-50%)',
        width:2, height:6, borderRadius:1,
        background: isNight ? 'rgba(140,160,220,0.55)' : 'rgba(255,255,255,0.9)',
        zIndex:3, pointerEvents:'none' }}/>
      {/* Inner disc — rotates with interaction, spun-metal conic texture */}
      <div style={{ position:'absolute', inset:5, borderRadius:'50%',
        background: isNight
          ? `conic-gradient(from 55deg,#2e2e38 0deg,#4a4a56 20deg,#363640 42deg,#26262e 68deg,#464652 90deg,#363640 115deg,#282832 148deg,#484852 168deg,#363640 190deg,#2e2e38 228deg,#44444e 252deg,#363640 275deg,#242430 305deg,#46464e 332deg,#32323c 352deg,#2e2e38 360deg)`
          : `conic-gradient(from 55deg,#b8b8b8 0deg,#f8f8f8 20deg,#cccccc 42deg,#adadad 68deg,#f5f5f5 90deg,#c4c4c4 115deg,#b0b0b0 148deg,#fafafa 168deg,#c8c8c8 190deg,#b8b8b8 228deg,#f0f0f0 252deg,#cccccc 275deg,#aaaaaa 305deg,#f6f6f6 332deg,#c2c2c2 352deg,#b8b8b8 360deg)`,
        boxShadow: isNight ? 'inset 0 0 6px rgba(0,0,0,0.45)' : 'inset 0 0 6px rgba(0,0,0,0.18)',
        transform:`rotate(${rotation}deg)` }}>
        <div style={{ position:'absolute', top:4, left:'50%', transform:'translateX(-50%)',
          width:4, height:4, borderRadius:'50%', background:'#3EFF52',
          boxShadow:'0 0 5px rgba(62,255,82,0.7)' }}/>
      </div>
    </div>
  )
}

// ─── Vertical Type Selector ────────────────────────────────────────────────────
function TypeSelector({ value, onChange, isNight=false, labelColor }: { value: GradType; onChange: (v: GradType) => void; isNight?: boolean; labelColor?: string }) {
  const opts: { label: string; val: GradType }[] = [
    { label:'L', val:'L' },
    { label:'R', val:'R' },
    { label:'C', val:'C' },
  ]
  const idx = opts.findIndex(o => o.val === value)
  const trackH = 72, thumbSize = 22
  const thumbTops = [2, (trackH - thumbSize) / 2, trackH - thumbSize - 2]
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
      {/* L / R / C labels + dots, right-aligned */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        {opts.map((o) => (
          <div key={o.val} onClick={()=>onChange(o.val)}
            style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:5, cursor:'pointer', width:32 }}>
            <span style={{ fontSize:8, fontWeight:400, letterSpacing:0,
              color: labelColor ? (value===o.val ? labelColor : `${labelColor}66`) : (value===o.val ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)'), fontFamily:'UniversNext, sans-serif', lineHeight:1 }}>
              {o.label}
            </span>
            <div style={{ width:4, height:4, borderRadius:'50%', flexShrink:0,
              background: value===o.val ? '#3EFF52' : 'rgba(255,255,255,0.35)' }}/>
          </div>
        ))}
      </div>
      {/* Pill track with perfect circle thumb */}
      <div style={{ position:'relative', width:30, height:trackH,
        background: isNight ? 'linear-gradient(to bottom, #22222c, #2c2c38)' : 'linear-gradient(to bottom, #b0b0b0, #c8c8c8)',
        boxShadow: isNight ? 'inset 2px 2px 6px rgba(0,0,0,0.55), inset -1px -1px 3px rgba(70,80,120,0.12)' : 'inset 2px 2px 6px rgba(0,0,0,0.25), inset -1px -1px 3px rgba(255,255,255,0.3)',
        border: isNight ? '1px solid #151520' : '1px solid #a8a8a8', borderRadius:15 }}>
        {/* Center groove line */}
        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', top:10, bottom:10, width:3, borderRadius:2,
          background: isNight ? 'linear-gradient(to bottom, #141420, #20202c)' : 'linear-gradient(to bottom, #909090, #b0b0b0)',
          boxShadow:'inset 0 1px 3px rgba(0,0,0,0.35)', zIndex:0 }}/>
        {opts.map((_,i) => (
          <div key={i} onClick={()=>onChange(opts[i].val)}
            style={{ position:'absolute', left:0, right:0, height:'33.3%', top:`${i*33.3}%`, cursor:'pointer', zIndex:1 }}/>
        ))}
        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)',
          top: thumbTops[idx], transition:'top 0.18s cubic-bezier(0.34,1.56,0.64,1)',
          width:thumbSize, height:thumbSize, borderRadius:'50%', zIndex:2, pointerEvents:'none',
          background: isNight
            ? `conic-gradient(from 110deg,#2e2e38 0deg,#4a4a56 22deg,#363640 38deg,#26262e 65deg,#464652 88deg,#363640 108deg,#282832 140deg,#484852 162deg,#363640 185deg,#2e2e38 220deg,#44444e 245deg,#363640 268deg,#242430 300deg,#46464e 328deg,#32323c 348deg,#2e2e38 360deg)`
            : `conic-gradient(from 110deg,#c2c2c2 0deg,#f2f2f2 22deg,#d4d4d4 38deg,#bcbcbc 65deg,#efefef 88deg,#c8c8c8 108deg,#b8b8b8 140deg,#f4f4f4 162deg,#ccc 185deg,#c0c0c0 220deg,#ebebeb 245deg,#d0d0d0 268deg,#bbbbbb 300deg,#f0f0f0 328deg,#c6c6c6 348deg,#c2c2c2 360deg)`,
          boxShadow: isNight ? '2px 2px 6px rgba(0,0,0,0.65)' : '2px 2px 6px rgba(0,0,0,0.28)',
          border: isNight ? '1px solid #1e1e28' : '1px solid #b8b8b8' }}/>
      </div>
    </div>
  )
}

// ─── EC Selector ─────────────────────────────────────────────────────────────
function ECSelector({ value, onChange, isNight=false, labelColor }: { value: ECLevel; onChange: (v: ECLevel) => void; isNight?: boolean; labelColor?: string }) {
  const levels: ECLevel[] = ['L','M','Q','H']
  const idx = levels.indexOf(value)
  const S = 22
  return (
    <div>
      {/* L M Q H labels above track */}
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4,
        paddingLeft: S/2, paddingRight: S/2 }}>
        {levels.map(l=>(
          <span key={l} style={{ fontSize:8, color: labelColor ? (l===value ? labelColor : '#aaa') : (l===value ? '#ffffff' : '#888'), fontFamily:'UniversNext, sans-serif',
            fontWeight:400, letterSpacing:0 }}>{l}</span>
        ))}
      </div>
      {/* Track */}
      <div style={{ position:'relative', height:S }}>
        <div style={{ position:'absolute', inset:0, borderRadius:S/2,
          background: isNight ? 'linear-gradient(180deg, #22222c 0%, #2c2c38 100%)' : 'linear-gradient(180deg, #b4b4b4 0%, #cccccc 100%)',
          boxShadow: isNight ? 'inset 3px 3px 7px rgba(0,0,0,0.55), inset -2px -2px 5px rgba(70,80,120,0.1)' : 'inset 3px 3px 7px rgba(0,0,0,0.2), inset -2px -2px 5px rgba(255,255,255,0.25)',
          border: isNight ? '1px solid #151520' : '1px solid #aeaeae' }}/>
        {/* Click zones */}
        {levels.map((l,i)=>(
          <div key={l} onClick={()=>onChange(l)}
            style={{ position:'absolute', top:0, bottom:0, left:`${(i/4)*100}%`, width:'25%',
              cursor:'pointer', zIndex:3 }}/>
        ))}
        {/* Center groove line */}
        <div style={{ position:'absolute', top:'50%', transform:'translateY(-50%)', left:S/2, right:S/2, height:3, borderRadius:2,
          background: isNight ? 'linear-gradient(to right, #141420, #20202c)' : 'linear-gradient(to right, #909090, #b0b0b0)',
          boxShadow:'inset 0 1px 3px rgba(0,0,0,0.35)', zIndex:0, pointerEvents:'none' }}/>
        {/* Sliding thumb */}
        <div style={{ position:'absolute', top:0, zIndex:2, pointerEvents:'none',
          left:`calc(${(idx/3)*100}% - ${(idx/3)*S}px)`,
          width:S, height:S, borderRadius:'50%',
          background: isNight
            ? `conic-gradient(from 195deg,#2e2e38 0deg,#4a4a56 22deg,#363640 38deg,#26262e 65deg,#464652 88deg,#363640 108deg,#282832 140deg,#484852 162deg,#363640 185deg,#2e2e38 220deg,#44444e 245deg,#363640 268deg,#242430 300deg,#46464e 328deg,#32323c 348deg,#2e2e38 360deg)`
            : `conic-gradient(from 195deg,#c2c2c2 0deg,#f2f2f2 22deg,#d4d4d4 38deg,#bcbcbc 65deg,#efefef 88deg,#c8c8c8 108deg,#b8b8b8 140deg,#f4f4f4 162deg,#ccc 185deg,#c0c0c0 220deg,#ebebeb 245deg,#d0d0d0 268deg,#bbbbbb 300deg,#f0f0f0 328deg,#c6c6c6 348deg,#c2c2c2 360deg)`,
          boxShadow: isNight ? '2px 3px 8px rgba(0,0,0,0.65)' : '2px 3px 8px rgba(0,0,0,0.24)',
          border: isNight ? '1px solid #1e1e28' : '1px solid #c4c4c4',
          transition:'left 0.15s cubic-bezier(0.34,1.56,0.64,1)' }}/>
      </div>
    </div>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function HWToggle({ checked, onChange, isNight=false }: { checked: boolean; onChange: (v: boolean) => void; isNight?: boolean }) {
  return (
    <button onClick={()=>onChange(!checked)} style={{
      width:52, height:28, borderRadius:14,
      border: isNight ? '1px solid #191924' : '1px solid #a0a0a0',
      cursor:'pointer', padding:0,
      position:'relative', flexShrink:0, transition:'background 0.2s',
      background: isNight
        ? (checked ? 'linear-gradient(to right, #353540, #424250)' : 'linear-gradient(145deg, #2e2e3a, #252530)')
        : (checked ? 'linear-gradient(to right,#aaa,#bbb)' : 'linear-gradient(145deg,#d0d0d0,#c0c0c0)'),
      boxShadow: isNight
        ? 'inset 2px 2px 5px rgba(0,0,0,0.5), inset -1px -1px 3px rgba(70,80,120,0.1)'
        : 'inset 2px 2px 5px rgba(0,0,0,0.2),inset -1px -1px 3px rgba(255,255,255,0.5)',
    }}>
      {/* Center groove line */}
      <div style={{ position:'absolute', top:'50%', transform:'translateY(-50%)', left:6, right:6, height:3, borderRadius:2,
        background: isNight ? 'linear-gradient(to right, #141420, #20202c)' : 'linear-gradient(to right, #888, #aaa)',
        boxShadow:'inset 0 1px 3px rgba(0,0,0,0.35)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', top:3, left: checked?27:3, width:20, height:20, borderRadius:'50%',
        background: isNight
          ? `conic-gradient(from 310deg,#2e2e38 0deg,#4a4a56 22deg,#363640 38deg,#26262e 65deg,#464652 88deg,#363640 108deg,#282832 140deg,#484852 162deg,#363640 185deg,#2e2e38 220deg,#44444e 245deg,#363640 268deg,#242430 300deg,#46464e 328deg,#32323c 348deg,#2e2e38 360deg)`
          : `conic-gradient(from 310deg,#c2c2c2 0deg,#f2f2f2 22deg,#d4d4d4 38deg,#bcbcbc 65deg,#efefef 88deg,#c8c8c8 108deg,#b8b8b8 140deg,#f4f4f4 162deg,#ccc 185deg,#c0c0c0 220deg,#ebebeb 245deg,#d0d0d0 268deg,#bbbbbb 300deg,#f0f0f0 328deg,#c6c6c6 348deg,#c2c2c2 360deg)`,
        boxShadow: isNight ? '2px 2px 5px rgba(0,0,0,0.65)' : '2px 2px 5px rgba(0,0,0,0.28)',
        border: isNight ? '1px solid #1e1e28' : '1px solid #b8b8b8', transition:'left 0.2s' }}/>
    </button>
  )
}

// ─── Vertical Slider (analog style) ──────────────────────────────────────────
function VSlider({ value, onChange, min=0, max=100, label, labelColor, isNight=false }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string; labelColor?: string; isNight?: boolean
}) {
  const trackH=68, thumbH=20, thumbW=22
  const pct=(value-min)/(max-min)
  const thumbTop=(1-pct)*(trackH-thumbH)
  const numColor = labelColor ?? '#999'
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    function handleTouch(e: TouchEvent) {
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const p = 1 - Math.max(0, Math.min(1, (e.touches[0].clientY - rect.top) / rect.height))
      onChange(Math.round(min + p * (max - min)))
    }
    el.addEventListener('touchstart', handleTouch, { passive: false })
    el.addEventListener('touchmove',  handleTouch, { passive: false })
    return () => {
      el.removeEventListener('touchstart', handleTouch)
      el.removeEventListener('touchmove',  handleTouch)
    }
  }, [min, max, onChange])

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
      <span style={{ fontFamily:'monospace', fontSize:8, color:numColor }}>{max}</span>
      <div ref={trackRef} style={{ position:'relative', width:thumbW, height:trackH }}>
        {/* Thin track */}
        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', top:0, bottom:0, width:8,
          background: isNight ? 'linear-gradient(to bottom, #1e1e28, #2a2a36)' : 'linear-gradient(to bottom, #aaaaaa, #c4c4c4)',
          boxShadow: isNight ? 'inset 2px 2px 4px rgba(0,0,0,0.6), inset -1px -1px 2px rgba(70,80,120,0.1)' : 'inset 2px 2px 4px rgba(0,0,0,0.3), inset -1px -1px 2px rgba(255,255,255,0.25)',
          borderRadius:4 }}/>
        {/* Rounded square thumb with inner pill */}
        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)',
          top:thumbTop, width:thumbW, height:thumbH, borderRadius:12, pointerEvents:'none',
          background: isNight ? 'linear-gradient(145deg, #383844, #28282e)' : 'linear-gradient(145deg, #f0f0f0, #d8d8d8)',
          boxShadow: isNight ? '3px 3px 8px rgba(0,0,0,0.65)' : '3px 3px 8px rgba(0,0,0,0.3)',
          border: isNight ? '1px solid #1e1e28' : '1px solid #c8c8c8',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:14, height:5, borderRadius:3,
            background: isNight ? 'linear-gradient(145deg, #2e2e3a, #3a3a46)' : 'linear-gradient(145deg, #e8e8e8, #f6f6f6)',
            boxShadow: isNight ? 'inset 1px 1px 2px rgba(0,0,0,0.45), inset -1px -1px 1px rgba(70,80,120,0.1)' : 'inset 1px 1px 2px rgba(0,0,0,0.12), inset -1px -1px 1px rgba(255,255,255,0.8)' }}/>
        </div>
        <input type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))}
          style={{ position:'absolute', inset:0, opacity:0, width:'100%', height:'100%', cursor:'pointer',
            writingMode:'vertical-lr', direction:'rtl' } as React.CSSProperties}/>
      </div>
      <span style={{ fontFamily:'monospace', fontSize:8, color:numColor }}>{min}</span>
      {label && <span style={{ fontSize:8, letterSpacing:0, textTransform:'uppercase', fontFamily:'UniversNext, sans-serif', fontWeight:400, display:'block', textAlign:'center', marginTop:4, color: labelColor }}>{label}</span>}
    </div>
  )
}

// ─── Module shape grid ────────────────────────────────────────────────────────
const SHAPES: { id: ModuleShape; label: string }[] = [
  {id:'square',label:'Square'},{id:'rounded',label:'Rounded'},{id:'circle',label:'Circle'},
  {id:'diamond',label:'Diamond'},{id:'star',label:'Star'},{id:'squircle',label:'Squircle'},
  {id:'leaf',label:'Leaf'},{id:'cross',label:'Cross'},{id:'hexagon',label:'Hex'},{id:'triangle',label:'Tri'},
  {id:'flower',label:'Flower'},
]

const FINDERS: { id: FinderStyle; label: string }[] = [
  {id:'default',label:'Square'},{id:'rounded',label:'Rounded'},
  {id:'circle',label:'Circle'},{id:'diamond-eye',label:'Diamond'},
]

const TEXTURES: { id: string; label: string; bg: string; fgColor: string; bgColor: string }[] = [
  { id:'brushed-silver', label:'Brushed',    bg:'linear-gradient(135deg,#c8c8c8,#a0a0a0,#d0d0d0)',  fgColor:'#222222', bgColor:'#b0b0b0' },
  { id:'carbon-dark',    label:'Carbon',     bg:'linear-gradient(135deg,#1a1a1a,#2e2e2e,#111)',      fgColor:'#d0d0d0', bgColor:'#111111' },
  { id:'washi-paper',    label:'Washi',      bg:'linear-gradient(135deg,#f4ede0,#e8dcc8)',            fgColor:'#222222', bgColor:'#f4ede0' },
  { id:'neon-glow',      label:'Neon',       bg:'linear-gradient(135deg,#050510,#0a0a1e)',            fgColor:'#00ff88', bgColor:'#050510' },
  { id:'gold-leaf',      label:'Gold',       bg:'linear-gradient(135deg,#f5efdd,#ffd700,#8b6914)',   fgColor:'#8b6914', bgColor:'#f5efdd' },
  { id:'blueprint',      label:'Blueprint',  bg:'linear-gradient(135deg,#1a3a6b,#0f2548)',            fgColor:'#7fc4fd', bgColor:'#1a3a6b' },
  { id:'rose-gold',      label:'Rose Gold',  bg:'linear-gradient(135deg,#f9c6c9,#e8a598,#c96b6b)',   fgColor:'#7b1d2a', bgColor:'#faeae8' },
  { id:'forest',         label:'Forest',     bg:'linear-gradient(135deg,#1b4332,#2d6a4f,#52b788)',   fgColor:'#d8f3dc', bgColor:'#1b4332' },
  { id:'cosmic',         label:'Cosmic',     bg:'linear-gradient(135deg,#0d0221,#3c096c,#7b2ff7)',   fgColor:'#e0aaff', bgColor:'#0d0221' },
  { id:'terracotta',     label:'Terracotta', bg:'linear-gradient(135deg,#8b3a1f,#c65d2e,#e9835c)',   fgColor:'#fff1e6', bgColor:'#4a1e0c' },
  { id:'arctic',         label:'Arctic',     bg:'linear-gradient(135deg,#e8f4f8,#b8d4e8,#6ba3be)',   fgColor:'#00304a', bgColor:'#eaf6fb' },
  { id:'obsidian',       label:'Obsidian',   bg:'linear-gradient(135deg,#1a0533,#2d1b47,#4a2c6b)',   fgColor:'#c9b1d9', bgColor:'#120025' },
]

// ─── Drum Track ───────────────────────────────────────────────────────────────
function DrumTrack({ onNavigate, onTick, isNight=false }: { onNavigate: (dir: 1|-1) => void; onTick?: () => void; isNight?: boolean }) {
  const TICK_SPACING = 6
  const TICK_W = 2
  const TICK_H = 7
  const DRAG_THRESHOLD = 18
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(130)
  const [displayOffset, setDisplayOffset] = useState(0)
  const isDragging = useRef(false)
  const dragX = useRef(0)
  const dragAccum = useRef(0)
  const tickAccum = useRef(0)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(es => setWidth(es[0].contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    function applyDrag(dx: number) {
      setDisplayOffset(prev => prev - dx)
      dragAccum.current -= dx
      tickAccum.current = Math.min(tickAccum.current + Math.abs(dx), TICK_SPACING * 4)
      while (tickAccum.current >= TICK_SPACING) {
        onTick?.()
        tickAccum.current -= TICK_SPACING
      }
      if (dragAccum.current <= -DRAG_THRESHOLD) {
        onNavigate(1)
        dragAccum.current += DRAG_THRESHOLD
      } else if (dragAccum.current >= DRAG_THRESHOLD) {
        onNavigate(-1)
        dragAccum.current -= DRAG_THRESHOLD
      }
    }
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return
      const dx = e.clientX - dragX.current
      dragX.current = e.clientX
      applyDrag(dx)
    }
    function onUp() {
      isDragging.current = false
      dragAccum.current = 0
      tickAccum.current = 0
    }
    function onTouchMove(e: TouchEvent) {
      if (!isDragging.current) return
      e.preventDefault()
      const dx = e.touches[0].clientX - dragX.current
      dragX.current = e.touches[0].clientX
      applyDrag(dx)
    }
    function onTouchEnd() {
      isDragging.current = false
      dragAccum.current = 0
      tickAccum.current = 0
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [onNavigate])

  const cx = width / 2
  const startIdx = Math.floor((displayOffset - cx) / TICK_SPACING) - 1
  const count = Math.ceil(width / TICK_SPACING) + 6

  return (
    <div
      ref={containerRef}
      onMouseDown={e => { isDragging.current = true; dragX.current = e.clientX; dragAccum.current = 0; e.preventDefault() }}
      onTouchStart={e => { isDragging.current = true; dragX.current = e.touches[0].clientX; dragAccum.current = 0; }}
      style={{
        flex: 1, height: 18, borderRadius: 9999, padding: 1,
        background: isNight
          ? 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(80,90,140,0.45) 100%)'
          : 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(255,255,255,0.80) 100%)',
        cursor: 'ew-resize',
        userSelect: 'none',
      }}
    >
      <div style={{
        position: 'relative', height: '100%', borderRadius: 9999, overflow: 'hidden',
        background: '#000',
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.85)',
      }}>
        {/* Centre glow layer — sits beneath the ticks */}
        <div style={{
          position: 'absolute', top: 2, bottom: 2, left: 0, right: 0, pointerEvents: 'none',
          background: isNight
            ? 'linear-gradient(to right, #1a1a24 0%, #50505e 50%, #1a1a24 100%)'
            : 'linear-gradient(to right, #333333 0%, #D6D6D6 50%, #333333 100%)',
        }} />
        {Array.from({ length: count }).map((_, j) => {
          const idx = startIdx + j
          const x = idx * TICK_SPACING - displayOffset + cx
          if (x < 0 || x > width) return null
          const px = Math.round(x - TICK_W / 2)
          return (
            <div key={idx} style={{
              position: 'absolute', left: px, top: '50%', width: TICK_W, height: TICK_H,
              transform: 'translateY(-50%)',
              background: idx % 2 === 0 ? 'rgba(255,255,255,0.82)' : 'rgba(255, 255, 255, 0.25)',
              borderRadius: 1,
              pointerEvents: 'none',
            }} />
          )
        })}
        {/* Edge depth fade — on top of ticks */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, transparent 22%, transparent 78%, rgba(0,0,0,0.85) 100%)',
        }} />
      </div>
    </div>
  )
}

// ─── Arc Wheel Preset List ────────────────────────────────────────────────────
function ArcWheelPresets({
  presets,
  selectedIdx,
  onSelect,
}: {
  presets: typeof GRAD_PRESETS
  selectedIdx: number
  onSelect: (i: number) => void
}) {
  const ITEM_H = 38
  const CURVE_FACTOR = 7

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const dir = e.deltaY > 0 ? 1 : -1
    onSelect(Math.max(0, Math.min(presets.length - 1, selectedIdx + dir)))
  }

  return (
    <div
      onWheel={handleWheel}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'ns-resize' }}
    >
      {/* Center highlight row — background and border both fade right */}
      <div style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        left: 8, right: 8, height: ITEM_H,
        background: 'linear-gradient(to right, rgba(255,255,255,0.12) 0%, transparent 75%)',
        borderRadius: 9999,
        pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 9999,
          border: '1px solid rgba(255,255,255,0.22)',
          WebkitMaskImage: 'linear-gradient(to right, black 0%, transparent 72%)',
          maskImage: 'linear-gradient(to right, black 0%, transparent 72%)',
        }} />
      </div>

      {presets.map((p, i) => {
        const offset = i - selectedIdx
        if (Math.abs(offset) > 4) return null

        const abs = Math.abs(offset)
        const curveX = abs * abs * CURVE_FACTOR
        const scale = 1 - abs * 0.065
        const opacity = Math.max(0, 1 - abs * 0.28)
        const isActive = offset === 0
        const css = p.stops.map(st => `${st.color} ${st.position}%`).join(', ')

        return (
          <div
            key={p.name}
            onClick={() => onSelect(i)}
            style={{
              position: 'absolute', left: 0, right: 0, top: '50%', height: ITEM_H,
              display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
              cursor: 'pointer',
              transform: `translateY(calc(-50% + ${offset * ITEM_H}px)) translateX(-${curveX}px) scale(${scale})`,
              opacity,
              transition: 'transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.28s ease',
              zIndex: isActive ? 1 : 0,
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(to right, ${css})`,
              boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
              transition: 'box-shadow 0.28s ease',
            }} />
            <span style={{
              fontSize: isActive ? 12 : 10,
              fontFamily: 'UniversNext, sans-serif',
              color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.32)',
              transition: 'font-size 0.28s ease, color 0.28s ease',
              whiteSpace: 'nowrap',
              fontWeight: isActive ? 500 : 400,
              letterSpacing: isActive ? '0.01em' : 0,
            }}>
              {p.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Generic Arc Wheel List ───────────────────────────────────────────────────
function ArcWheelList({
  count,
  selectedIdx,
  onSelect,
  renderItem,
}: {
  count: number
  selectedIdx: number
  onSelect: (i: number) => void
  renderItem: (idx: number, isActive: boolean) => React.ReactNode
}) {
  const ITEM_H = 38
  const CURVE_FACTOR = 7

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const dir = e.deltaY > 0 ? 1 : -1
    onSelect(Math.max(0, Math.min(count - 1, selectedIdx + dir)))
  }

  return (
    <div
      onWheel={handleWheel}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'ns-resize' }}
    >
      <div style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        left: 8, right: 8, height: ITEM_H,
        background: 'linear-gradient(to right, rgba(255,255,255,0.12) 0%, transparent 75%)',
        borderRadius: 9999,
        pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 9999,
          border: '1px solid rgba(255,255,255,0.22)',
          WebkitMaskImage: 'linear-gradient(to right, black 0%, transparent 72%)',
          maskImage: 'linear-gradient(to right, black 0%, transparent 72%)',
        }} />
      </div>

      {Array.from({ length: count }).map((_, i) => {
        const offset = i - selectedIdx
        if (Math.abs(offset) > 4) return null
        const abs = Math.abs(offset)
        const curveX = abs * abs * CURVE_FACTOR
        const scale = 1 - abs * 0.065
        const opacity = Math.max(0, 1 - abs * 0.28)
        const isActive = offset === 0
        return (
          <div
            key={i}
            onClick={() => onSelect(i)}
            style={{
              position: 'absolute', left: 0, right: 0, top: '50%', height: ITEM_H,
              display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
              cursor: 'pointer',
              transform: `translateY(calc(-50% + ${offset * ITEM_H}px)) translateX(-${curveX}px) scale(${scale})`,
              opacity,
              transition: 'transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.28s ease',
              zIndex: isActive ? 1 : 0,
            }}
          >
            {renderItem(i, isActive)}
          </div>
        )
      })}
    </div>
  )
}

// ─── Color Dot Button ─────────────────────────────────────────────────────────
function ColorDot({ color, label, active, onClick, isNight=false }: {
  color: string; label: string; active: boolean; onClick: () => void; isNight?: boolean
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <button onClick={onClick} style={{
        width:28, height:28, borderRadius:'50%', cursor:'pointer', border:'3px solid rgba(0,0,0,0.2)', padding:0,
        background: color==='transparent'||color===''||color==='/slash'
          ? 'conic-gradient(#ccc 90deg, #fff 90deg 180deg, #ccc 180deg 270deg, #fff 270deg)'
          : color,
        outline: color==='#ffffff' ? '1px solid #ccc' : 'none',
        boxShadow: active
          ? `inset 2px 2px 5px rgba(0,0,0,${isNight ? 0.5 : 0.3})`
          : isNight ? '3px 3px 6px #0c0c16, -2px -2px 4px #363644' : '3px 3px 6px #b0b0b0, -2px -2px 4px #f4f4f4',
        transition:'box-shadow 0.15s',
        position:'relative',
      }}>
        {color==='transparent'||color==='' && (
          <svg viewBox="0 0 36 36" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
            <line x1="4" y1="4" x2="32" y2="32" stroke="#e55" strokeWidth="3"/>
          </svg>
        )}
      </button>
      {label && <span style={{ fontSize:8, letterSpacing:0, textTransform:'uppercase', fontFamily:'UniversNext, sans-serif', fontWeight:400, display:'block', textAlign:'center', marginTop:4, color:'#888' }}>{label}</span>}
    </div>
  )
}

// ─── Panel content ────────────────────────────────────────────────────────────
function PanelContent({ panel, s, set, setMany, presetIdx, setPresetIdx }: {
  panel: ActivePanel
  s: QRSettings
  set: <K extends keyof QRSettings>(k: K, v: QRSettings[K]) => void
  setMany: (patch: Partial<QRSettings>) => void
  presetIdx: number
  setPresetIdx: (n: number) => void
}) {
  if (panel === 'none') {
    return null
  }

  if (panel === 'bg' || panel === 'fg') {
    return null
  }

  if (panel === 'preset') return null

  if (panel === 'texture' || panel === 'shape' || panel === 'finder') {
    return null
  }

  return null
}

function ManCard({ label, desc, children, style }: { label: string; desc: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="man-card" style={{ background:'#f5f2eb', padding:'11px 13px', display:'flex', flexDirection:'column', gap:8, ...style }}>
      <div style={{ minHeight:52, display:'flex', alignItems:'center', pointerEvents:'none' }}>{children}</div>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'#1a1a1a', marginBottom:3, letterSpacing:'-0.01em' }}>{label}</div>
        <div style={{ fontSize:9, color:'#999', lineHeight:1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QR2() {
  const [isNight, setIsNight]   = useState(false)
  const [showManual, setShowManual] = useState(false)
  const hw = isNight ? HW_NIGHT : HW_DAY

  useEffect(() => {
    document.body.setAttribute('data-qr-page', 'true')
    return () => document.body.removeAttribute('data-qr-page')
  }, [])

  useEffect(() => {
    if (isNight) {
      document.body.setAttribute('data-dark-page', 'true')
    } else {
      document.body.removeAttribute('data-dark-page')
    }
    return () => document.body.removeAttribute('data-dark-page')
  }, [isNight])

  const [s, setS] = useState<QRSettings>(DEFAULTS)
  const [matrix, setMatrix] = useState<boolean[][]>([])
  const [activePanel, setActivePanel] = useState<ActivePanel>('none')
  const [presetIdx, setPresetIdx] = useState(0)
  const [textureIdx, setTextureIdx] = useState(0)
  const [shapeIdx, setShapeIdx] = useState(() => Math.max(0, SHAPES.findIndex(sh => sh.id === DEFAULTS.moduleShape)))
  const [finderIdx, setFinderIdx] = useState(() => Math.max(0, FINDERS.findIndex(f => f.id === DEFAULTS.finderStyle)))
  const [screenBgIdx, setScreenBgIdx] = useState(0)
  const [selectedStopId, setSelectedStopId] = useState(DEFAULT_STOPS[0].id)
  const [pressedBtn, setPressedBtn] = useState<string|null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const svgRef = useRef<HTMLDivElement>(null)
  const posWrapRef = useRef<HTMLDivElement>(null)
  const cornerSliderRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const bufsRef = useRef<Record<string, AudioBuffer>>({})
  const pickerWasOpen = useRef(false)

  // Prevent page scroll when touching the device, but allow native range input sliding
  useEffect(() => {
    const el = posWrapRef.current
    if (!el) return
    const prevent = (e: TouchEvent) => {
      if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
    }
    el.addEventListener('touchmove', prevent, { passive: false })
    return () => el.removeEventListener('touchmove', prevent)
  }, [])

  // Corner roundness slider — direct non-passive touch handler bypasses transform coordinate issues
  useEffect(() => {
    const el = cornerSliderRef.current
    if (!el) return
    function handleTouch(e: TouchEvent) {
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const p = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width))
      set('cornerRoundness', Math.round(p * 100))
    }
    el.addEventListener('touchstart', handleTouch, { passive: false })
    el.addEventListener('touchmove',  handleTouch, { passive: false })
    return () => {
      el.removeEventListener('touchstart', handleTouch)
      el.removeEventListener('touchmove',  handleTouch)
    }
  }, [])

  function set<K extends keyof QRSettings>(k: K, v: QRSettings[K]) {
    setS(prev => ({ ...prev, [k]: v }))
  }
  function setMany(patch: Partial<QRSettings>) {
    setS(prev => ({ ...prev, ...patch }))
  }

  // Sound — Web Audio API: each start() is an independent node, no reuse conflicts
  useEffect(() => {
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const base = '/images/lab/QR-device-sound-effects'
    const load = (key: string, file: string) =>
      fetch(`${base}/${file}`).then(r=>r.arrayBuffer()).then(ab=>ctx.decodeAudioData(ab)).then(buf=>{bufsRef.current[key]=buf}).catch(()=>{})
    load('tick',   'tick-sound-effect.mp3')
    load('picker', 'color-picker.mp3')
    load('btn',    'button-click.mp3')
    load('toggle', 'toggle01.mp3')
    fetch('/images/lab/QR-out-sound-effect.mp3').then(r=>r.arrayBuffer()).then(ab=>ctx.decodeAudioData(ab)).then(buf=>{bufsRef.current['qrout']=buf}).catch(()=>{})
    return () => { ctx.close() }
  }, [])
  function playBuf(key: string, vol = 1) {
    const ctx = audioCtxRef.current; const buf = bufsRef.current[key]
    if (!ctx || !buf) return
    if (ctx.state === 'suspended') ctx.resume()
    const src = ctx.createBufferSource(); const gain = ctx.createGain()
    gain.gain.value = vol; src.buffer = buf
    src.connect(gain); gain.connect(ctx.destination); src.start(0)
  }
  function playTick()   { playBuf('tick',   0.35) }
  function playBtn()    { playBuf('btn',    0.45) }
  function playToggle() { playBuf('toggle', 0.5)  }
  useEffect(() => {
    const open = activePanel==='bg'||activePanel==='fg'||activePanel==='gradient'
    if (open !== pickerWasOpen.current) {
      playBuf('picker', 0.5)
      pickerWasOpen.current = open
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel])

  // Debounced QR recompute
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const m = await getMatrix(s.text, s.ecLevel)
      setMatrix(m)
    }, 80)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [s.text, s.ecLevel])

  const svgStr = matrix.length ? buildSVG(matrix, s) : ''

  // Color Stops buttons "light up" (pure white icons) when a color panel is active,
  // i.e. when they can actually alter gradient / foreground / background values.
  const stopsLit = activePanel === 'gradient' || activePanel === 'fg' || activePanel === 'bg'

  function togglePanel(p: ActivePanel) {
    setActivePanel(prev => prev===p ? 'none' : p)
  }

  // Gradient stops management
  function addStop() {
    if (s.gradientStops.length >= 6) return
    const id = Math.random().toString(36).slice(2)
    const sorted = [...s.gradientStops].sort((a,b)=>a.position-b.position)
    const selIdx = Math.max(0, sorted.findIndex(st => st.id === selectedStopId))
    const sel = sorted[selIdx]
    const next = sorted[selIdx + 1]
    const pos = next
      ? Math.round((sel.position + next.position) / 2)
      : Math.min(100, sel.position + Math.round((100 - sel.position) / 2))
    const color = sampleStops(sorted, pos)
    setMany({ gradientStops: [...s.gradientStops, { id, color, position: pos }], gradientEnabled: true })
    setSelectedStopId(id)
    setActivePanel('gradient')
  }
  function removeStop() {
    if (s.gradientStops.length <= 2) return
    const sorted = [...s.gradientStops].sort((a,b)=>a.position-b.position)
    const selIdx = Math.max(0, sorted.findIndex(st => st.id === selectedStopId))
    const stopToRemove = sorted[selIdx]
    const newStops = s.gradientStops.filter(st => st.id !== stopToRemove.id)
    const newSorted = [...newStops].sort((a,b)=>a.position-b.position)
    setMany({ gradientStops: newStops, gradientEnabled: true })
    setSelectedStopId(newSorted[Math.min(selIdx, newSorted.length-1)]?.id ?? newSorted[0].id)
    setActivePanel('gradient')
  }

  // Paste from clipboard
  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) set('text', text)
    } catch {}
  }

  // Download SVG — animation fires only after the OS save dialog is fully dismissed
  async function downloadSVG() {
    if (!svgStr) return

    if ('showSaveFilePicker' in window) {
      // Start tracking blur BEFORE the dialog opens so we don't miss the event
      let blurred = false
      const onBlur = () => { blurred = true }
      window.addEventListener('blur', onBlur, { once: true })

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: 'qr-code.svg',
          types: [{ description: 'SVG Document', accept: { 'image/svg+xml': ['.svg'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(svgStr)
        await writable.close()
        window.removeEventListener('blur', onBlur)

        if (blurred && !document.hasFocus()) {
          // Dialog still has focus — fire when window gets it back
          window.addEventListener('focus', () => launchFlyAnimation(), { once: true })
        } else {
          // Focus already returned (dialog closed), animate now
          launchFlyAnimation()
        }
      } catch {
        window.removeEventListener('blur', onBlur)
        // AbortError — user cancelled, no animation
      }
    } else {
      // Fallback: <a> download + wait for focus return from any browser prompt
      const blob = new Blob([svgStr], { type:'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'qr-code.svg'; a.click()
      URL.revokeObjectURL(url)
      window.addEventListener('focus', () => launchFlyAnimation(), { once: true })
    }
  }

  // Paper-fly animation: card rises from behind the device (layer 1) then arcs to toggle pill
  function launchFlyAnimation() {
    const wrap = posWrapRef.current
    const bgWrap = wrap?.parentElement   // qr-bg-wrap — position:relative, no z-index
    if (!wrap || !bgWrap || !svgStr) return

    const isMobile = window.innerWidth <= 768

    const bgRect    = bgWrap.getBoundingClientRect()

    // Start: centre of the QR screen, converted to bgWrap-relative coords.
    // Card is z-index:1 so it sits behind the device (z-index:2) — invisible until
    // it clears the device edges, giving the "coming from behind the screen" feel.
    const screenEl   = svgRef.current ?? wrap
    const screenRect = screenEl.getBoundingClientRect()
    const startX = screenRect.left + screenRect.width  / 2 - 40 - bgRect.left
    const startY = screenRect.top  + screenRect.height / 2 - 40 - bgRect.top

    // Destination (toggle pill) in bgWrap-relative coords
    const pillRight = isMobile ? 17  : 37
    const pillTop   = isMobile ? 104 : 58
    const destX     = (window.innerWidth - pillRight) - bgRect.left
    const destY     = pillTop - bgRect.top

    const deltaX = (destX - startX - 40) * 0.75
    const deltaY = (destY - startY - 40) * 1.35

    // ── Build flying card ──────────────────────────────────────────────────
    const outerWrap = document.createElement('div')
    // z-index:1 → behind the device (posWrapRef is z-index:2 in the same parent)
    outerWrap.style.cssText = `position:absolute;left:${startX}px;top:${startY}px;width:80px;height:80px;z-index:1;pointer-events:none;`

    const card = document.createElement('div')
    card.style.cssText = `width:80px;height:80px;background:#fff;border-radius:10px;box-shadow:0 6px 28px rgba(0,0,0,0.38),0 2px 6px rgba(0,0,0,0.18);overflow:hidden;display:flex;align-items:center;justify-content:center;`

    const svgDataUrl = 'data:image/svg+xml,' + encodeURIComponent(svgStr)
    card.innerHTML = `<img src="${svgDataUrl}" style="width:72px;height:72px;" />`

    outerWrap.appendChild(card)
    bgWrap.appendChild(outerWrap)

    playBuf('qrout', 0.7)

    // Wobble the on-screen QR as the card launches
    if (svgRef.current) {
      gsap.fromTo(svgRef.current,
        { rotation: 0, scale: 1 },
        { rotation: -3, scale: 0.98, duration: 0.08, ease: 'sine.inOut',
          yoyo: true, repeat: 3, transformOrigin: 'center center',
          clearProps: 'rotation,scale' }
      )
    }

    const tl = gsap.timeline({ onComplete: () => { bgWrap.removeChild(outerWrap) } })

    // Card starts fully formed behind the screen — no separate pop-out phase needed.
    // It becomes visible the moment it clears the device boundary.
    gsap.set(card, { opacity: 1, scale: 1 })

    // Curved flight: explosive burst + spin the whole way
    tl.to(outerWrap, { x: deltaX,   duration: 0.85, ease: 'power4.out' }, 0)
    tl.to(card,      { y: deltaY,   duration: 0.85, ease: 'power4.in'  }, 0)
    tl.to(card,      { rotation: 540, duration: 0.85, ease: 'power2.in' }, 0)
    // Quick vanish at destination — no shrink during travel
    tl.to(card,      { opacity: 0,  duration: 0.15, ease: 'none' }, 0.72)
  }

  function navigateStop(dir: 1|-1) {
    const sorted = [...s.gradientStops].sort((a,b)=>a.position-b.position)
    const curIdx = Math.max(0, sorted.findIndex(st => st.id === selectedStopId))
    const nextIdx = Math.max(0, Math.min(sorted.length-1, curIdx + dir))
    setSelectedStopId(sorted[nextIdx].id)
    setMany({ gradientEnabled: true })
    setActivePanel('gradient')
  }

  // Scroll panel
  const panelScrollRef = useRef<HTMLDivElement>(null)
  function navigatePreset(dir: 1 | -1) {
    const next = Math.max(0, Math.min(GRAD_PRESETS.length - 1, presetIdx + dir))
    setPresetIdx(next)
    setMany({ gradientStops: GRAD_PRESETS[next].stops.map(st => ({...st})), gradientEnabled: true })
  }
  function selectTexture(i: number) {
    setTextureIdx(i)
    setMany({ fgColor: TEXTURES[i].fgColor, bgColor: TEXTURES[i].bgColor })
  }
  function selectShape(i: number) {
    setShapeIdx(i)
    set('moduleShape', SHAPES[i].id)
  }
  function selectFinder(i: number) {
    setFinderIdx(i)
    set('finderStyle', FINDERS[i].id)
  }
  function scrollPanel(dir: 1|-1) {
    if (activePanel === 'preset') {
      navigatePreset(dir)
    } else if (activePanel === 'texture') {
      selectTexture(Math.max(0, Math.min(TEXTURES.length - 1, textureIdx + dir)))
    } else if (activePanel === 'shape') {
      selectShape(Math.max(0, Math.min(SHAPES.length - 1, shapeIdx + dir)))
    } else if (activePanel === 'finder') {
      selectFinder(Math.max(0, Math.min(FINDERS.length - 1, finderIdx + dir)))
    } else if (activePanel === 'gradient') {
      const sorted = [...s.gradientStops].sort((a,b)=>a.position-b.position)
      const curIdx = Math.max(0, sorted.findIndex(st => st.id === selectedStopId))
      const nextIdx = Math.max(0, Math.min(sorted.length-1, curIdx + dir))
      setSelectedStopId(sorted[nextIdx].id)
    } else {
      panelScrollRef.current?.scrollBy({ top: dir*60, behavior:'smooth' })
    }
  }

  const DEVICE_W = 460

  return (
    <>
    <style>{`
      @font-face {
        font-family: 'UniversNext';
        src: url('/fonts/UniversNext/UniversNextProRegular.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      .panel-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
      @keyframes qr-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes manualFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .manual-btn { transition: padding 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease; }
      .manual-btn:hover { padding-left: 28px !important; padding-right: 30px !important; box-shadow: -4px 2px 16px rgba(0,0,0,0.18) !important; }
      @media (max-width: 768px) {
        .manual-overlay { padding: 60px 12px 0 !important; align-items: flex-start !important; }
        .manual-paper  { width: 100% !important; max-width: 100% !important; border-radius: 12px !important; height: 80vh !important; max-height: 80vh !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; }
        .manual-body   { flex: 1 1 auto; overflow-y: auto; }
        .manual-header-wrap { flex-shrink: 0; }
        .manual-footer-wrap { flex-shrink: 0; }
        .manual-logo-cell   { display: none !important; }
        .manual-grid   { grid-template-columns: repeat(2, 1fr) !important; }
        .man-card      { padding: 9px 10px !important; gap: 6px !important; }
        .man-card > div:first-child { min-height: 44px !important; }
      }
      .manual-no-shadows * { box-shadow: none !important; }
      @media (min-width: 769px) {
        .qr-theme-pill { top: 0 !important; display: flex !important; flex-direction: row !important; width: 84px !important; border-radius: 0 0 21px 21px !important; border-top: none !important; }
        .qr-pill-sun   { width: 42px !important; height: 42px !important; border-radius: 0 0 0 21px !important; }
        .qr-pill-moon  { width: 42px !important; height: 42px !important; border-radius: 0 0 21px 0 !important; }
      }
      @media (max-width: 768px) {
        .qr-theme-pill { right: 0 !important; top: calc(4.5rem - 4px) !important; width: 34px !important; border-radius: 17px 0 0 17px !important; border-right: none !important; }
        .qr-pill-sun   { width: 34px !important; height: 36px !important; border-radius: 17px 0 0 0 !important; }
        .qr-pill-moon  { width: 34px !important; height: 36px !important; border-radius: 0 0 0 17px !important; }
        .qr-pill-img   { width: 15px !important; height: 15px !important; }
      }

      /* ── Mobile only — desktop untouched ── */
      @media (max-width: 540px) {
        .qr-bg-wrap {
          padding-top: 100px !important;
          padding-bottom: 40px !important;
          align-items: flex-start !important;
        }
        .qr-bg-img {
          background-size: cover !important;
          background-position: center center !important;
        }
        .qr-pos-wrap {
          transform: scale(0.82);
          transform-origin: top center;
          margin-bottom: -110px;
        }
        /* Picker below device, no z-index override — natural z-index:0 sits
           behind the device (z-index:1) so closing rotation tucks it under */
        .qr-picker-anchor {
          right: auto !important;
          left: 30px !important;
          top: 100% !important;
          bottom: auto !important;
        }
        /* Rotate from top-left: closes by spinning back under the device */
        .qr-picker-panel {
          transform-origin: top left !important;
          border-radius: 0 0 28px 28px !important;
          border-top: none !important;
          border-right: 1px solid #a8a8a8 !important;
          box-shadow: 0 14px 28px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(255,255,255,0.3) !important;
        }
      }
      @media (max-width: 400px) {
        .qr-pos-wrap {
          transform: scale(0.78);
          margin-bottom: -130px;
        }
      }
    `}</style>
    <div className="qr-bg-wrap" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      position: 'relative',
    }}>
      {/* Day background — fades out when night */}
      <div className="qr-bg-img" style={{ position:'absolute', inset:0, backgroundImage:'url(/images/lab/qr-page-bg.webp)', backgroundSize:'125%', backgroundPosition:'center -20px', opacity: isNight ? 0 : 1, transition:'opacity 0.75s ease', zIndex:0 }}/>
      {/* Night background — fades in when night */}
      <div className="qr-bg-img" style={{ position:'absolute', inset:0, backgroundImage:'url(/images/lab/qr-page-bg-night.webp)', backgroundSize:'125%', backgroundPosition:'center -20px', opacity: isNight ? 1 : 0, transition:'opacity 0.75s ease', zIndex:0 }}/>
      {/* subtle overlay */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.28)', zIndex:1 }}/>

      <div ref={posWrapRef} className="qr-pos-wrap" style={{ position:'relative', zIndex:2 }}>

        {/* ── Color picker panel — 2D pivot from top-right anchor ── */}
        <div
          className="qr-picker-anchor"
          style={{
            position: 'absolute', right: '100%', top: '28%',
            zIndex: 0,
            pointerEvents: (activePanel==='bg'||activePanel==='fg'||activePanel==='gradient') ? 'all' : 'none',
          }}>
          <div className="qr-picker-panel" style={{
            width: 210,
            transformOrigin: 'right top',
            transform: (activePanel==='bg'||activePanel==='fg'||activePanel==='gradient')
              ? 'rotate(0deg)'
              : 'rotate(-90deg)',
            transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), background 0.65s ease, box-shadow 0.65s ease',
            borderRadius: '8px 0 0 28px',
            background: isNight ? 'linear-gradient(160deg, #32323e 0%, #282832 40%, #242428 70%, #2c2c38 100%)' : 'linear-gradient(160deg, #d4d4d4 0%, #c0c0c0 40%, #b8b8b8 70%, #c8c8c8 100%)',
            boxShadow: isNight ? '-8px 0 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(110,130,190,0.12)' : '-8px 0 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.5)',
            borderTop: isNight ? '1px solid #1c1c28' : '1px solid #a8a8a8',
            borderLeft: isNight ? '1px solid #1c1c28' : '1px solid #a8a8a8',
            borderBottom: isNight ? '1px solid #1c1c28' : '1px solid #a8a8a8',
            borderRight: 'none',
            overflow: 'hidden',
          }}>
            <HSBPicker
              value={
                activePanel==='bg' ? s.bgColor
                : activePanel==='gradient'
                  ? ([...s.gradientStops].sort((a,b)=>a.position-b.position).find(st=>st.id===selectedStopId)?.color ?? '#888888')
                  : s.fgColor
              }
              onChange={v => {
                if (activePanel==='bg') set('bgColor', v)
                else if (activePanel==='gradient') set('gradientStops', s.gradientStops.map(st=>st.id===selectedStopId?{...st,color:v}:st))
                else set('fgColor', v)
              }}
            />
          </div>
        </div>

        {/* ── Input module — separate physical unit above the device ── */}
        <div style={{
          width: '82%', marginLeft: 'auto', marginRight: 'auto',
          marginBottom: 0,
          background: isNight ? 'linear-gradient(160deg, #32323e 0%, #272732 50%, #2c2c38 100%)' : 'linear-gradient(160deg, #e0e0e0 0%, #cccccc 50%, #d4d4d4 100%)',
          boxShadow: isNight
            ? '0 8px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(110,130,190,0.12), -16px 0 40px rgba(185,212,255,0.09)'
            : '0 8px 20px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.7)',
          borderTop: isNight ? '1px solid #1c1c28' : '1px solid #a8a8a8',
          borderLeft: isNight ? '1px solid #1c1c28' : '1px solid #a8a8a8',
          borderRight: isNight ? '1px solid #1c1c28' : '1px solid #a8a8a8',
          borderBottom: 'none',
          transition: 'background 0.65s ease, box-shadow 0.65s ease',
          borderRadius: '14px 14px 0 0',
          padding: '7px 8px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ flex: 1, background: '#0d0d0d', borderRadius: 9,
            padding: '0 10px', height: 32, display: 'flex', alignItems: 'center',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.9)', border: '1px solid #000' }}>
            <input
              value={s.text}
              onChange={e=>set('text',e.target.value)}
              placeholder="Enter URL or text..."
              style={{ width:'100%', background:'transparent', border:'none', outline:'none',
                color:'#e0e0e0', fontSize:11, fontFamily:'monospace', caretColor:'#aaa' }}
            />
          </div>
          <button onClick={()=>{ playBtn(); paste() }}
            style={{ ...hw.btn(false), borderRadius:9, padding:'0 12px', fontSize:10,
              fontWeight:600, letterSpacing:'0.05em', display:'flex', alignItems:'center',
              gap:5, flexShrink:0, height:32 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
            Paste
          </button>
        </div>

        {/* ── Main Device ── */}
        <div style={{ width: DEVICE_W, padding: '12px 16px 16px', ...hw.device, position:'relative', zIndex:1 }}>

          {/* Main screen */}
          <div style={{ ...hw.screen, height: 220, display:'flex', marginBottom: 12,
            background: `url(/images/lab/QR-screen-bg-${screenBgIdx + 1}.${screenBgIdx === 4 ? 'gif' : 'jpg'}) center/cover no-repeat, #1a1a1a`,
            marginTop: -8, marginLeft: -12, marginRight: -12 }}>


            {/* Left sliding area */}
            {(() => {
              const isScreenPanel = ['preset','texture','shape','finder','gradient'].includes(activePanel)
              return (
                <div style={{ width:185, flexShrink:0, position:'relative', overflow:'hidden' }}>
                  {/* Dock icons — left-aligned, slides out left when panel opens */}
                  <div style={{ position:'absolute', inset:0,
                    display:'flex', flexDirection:'column', alignItems:'flex-start', justifyContent:'center',
                    padding:'0 0 0 10px',
                    transform: isScreenPanel ? 'translateX(-100%)' : 'translateX(0)',
                    transition:'transform 0.36s cubic-bezier(0.4,0,0.2,1)' }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                      padding:'6px 5px', borderRadius:16, background:'rgba(0,0,0,0.10)', backdropFilter:'blur(12px)' }}>
                      {([
                        { id:'preset'  as ActivePanel, icon:'/images/lab/preset-icon.svg' },
                        { id:'texture' as ActivePanel, icon:'/images/lab/texture-icon.svg' },
                        { id:'shape'   as ActivePanel, icon:'/images/lab/finder-pattern-icon.svg' },
                        { id:'finder'  as ActivePanel, icon:'/images/lab/mudule-shape-icon.svg' },
                      ] as const).map(btn=>(
                        <button key={btn.id} onClick={()=>{ playBtn(); togglePanel(btn.id) }}
                          style={{ width:32, height:32, borderRadius:9, border:'none', padding:0, cursor:'pointer',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            background:'linear-gradient(145deg, #2a2a2a, #0a0a0a)',
                            boxShadow:'none', transition:'all 0.15s' }}>
                          <img src={btn.icon} width="15" height="15"
                            style={{ display:'block', filter:'brightness(0) invert(1)', opacity: activePanel===btn.id ? 1 : 0.7 }}/>
                        </button>
                      ))}
                      <button onClick={()=>setScreenBgIdx(prev=>(prev+1)%5)}
                        style={{ width:32, height:32, borderRadius:9, border:'none', padding:0, cursor:'pointer',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          background:'linear-gradient(145deg, #2a2a2a, #0a0a0a)',
                          transition:'all 0.15s' }}>
                        <img src="/images/common/sa26-white.svg" width="15" height="15"
                          style={{ display:'block', opacity:0.7 }}/>
                      </button>
                    </div>
                  </div>
                  {/* Panel content — slides in from left */}
                  <div style={{ position:'absolute', inset:0,
                    background: isScreenPanel
                      ? `linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 75%),
                         radial-gradient(ellipse 230px 600px at -10px 50%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 18%, rgba(0,0,0,0.6) 45%, transparent 72%)`
                      : 'rgba(0,0,0,0.58)',
                    backdropFilter: isScreenPanel ? 'none' : 'blur(4px)',
                    transform: isScreenPanel ? 'translateX(0)' : 'translateX(-100%)',
                    transition:'transform 0.36s cubic-bezier(0.4,0,0.2,1)' }}>

                    {/* Preset arc wheel */}
                    {activePanel === 'preset' && (
                      <div style={{ position:'absolute', inset:0, zIndex:1 }}>
                        <ArcWheelPresets
                          presets={GRAD_PRESETS}
                          selectedIdx={presetIdx}
                          onSelect={(i) => {
                            playTick()
                            setPresetIdx(i)
                            setMany({ gradientStops: GRAD_PRESETS[i].stops.map(st => ({...st})), gradientEnabled: true })
                          }}
                        />
                        <div style={{
                          position:'absolute', top:10, left:22, zIndex:5, pointerEvents:'none',
                          color:'rgba(255,255,255,0.4)', fontSize:9, letterSpacing:'0.12em',
                          textTransform:'uppercase', fontFamily:'UniversNext, sans-serif',
                        }}>Gradient Presets</div>
                      </div>
                    )}

                    {/* Texture arc wheel */}
                    {activePanel === 'texture' && (
                      <div style={{ position:'absolute', inset:0, zIndex:1 }}>
                        <ArcWheelList
                          count={TEXTURES.length}
                          selectedIdx={textureIdx}
                          onSelect={(i) => { playTick(); selectTexture(i) }}
                          renderItem={(i, isActive) => (
                            <>
                              <div style={{
                                width:28, height:28, borderRadius:'50%', flexShrink:0,
                                background: TEXTURES[i].bg,
                                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.5)' : 'none',
                                transition:'box-shadow 0.28s ease',
                              }}/>
                              <span style={{
                                fontSize: isActive ? 12 : 10,
                                fontFamily:'UniversNext, sans-serif',
                                color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.32)',
                                transition:'font-size 0.28s ease, color 0.28s ease',
                                whiteSpace:'nowrap', fontWeight: isActive ? 500 : 400,
                                letterSpacing: isActive ? '0.01em' : 0,
                              }}>{TEXTURES[i].label}</span>
                            </>
                          )}
                        />
                        <div style={{
                          position:'absolute', top:10, left:22, zIndex:5, pointerEvents:'none',
                          color:'rgba(255,255,255,0.4)', fontSize:9, letterSpacing:'0.12em',
                          textTransform:'uppercase', fontFamily:'UniversNext, sans-serif',
                        }}>Textures</div>
                      </div>
                    )}

                    {/* Module shape arc wheel */}
                    {activePanel === 'shape' && (
                      <div style={{ position:'absolute', inset:0, zIndex:1 }}>
                        <ArcWheelList
                          count={SHAPES.length}
                          selectedIdx={shapeIdx}
                          onSelect={(i) => { playTick(); selectShape(i) }}
                          renderItem={(i, isActive) => (
                            <>
                              <div style={{
                                width:28, height:28, flexShrink:0,
                                display:'flex', alignItems:'center', justifyContent:'center',
                              }}>
                                <svg viewBox="0 0 10 10" width="22" height="22">
                                  <path d={modulePath(0, 0, SHAPES[i].id, 40, 10)}
                                    fill={isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)'}
                                    style={{ transition:'fill 0.28s ease' }}/>
                                </svg>
                              </div>
                              <span style={{
                                fontSize: isActive ? 12 : 10,
                                fontFamily:'UniversNext, sans-serif',
                                color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.32)',
                                transition:'font-size 0.28s ease, color 0.28s ease',
                                whiteSpace:'nowrap', fontWeight: isActive ? 500 : 400,
                                letterSpacing: isActive ? '0.01em' : 0,
                              }}>{SHAPES[i].label}</span>
                            </>
                          )}
                        />
                        <div style={{
                          position:'absolute', top:10, left:22, zIndex:5, pointerEvents:'none',
                          color:'rgba(255,255,255,0.4)', fontSize:9, letterSpacing:'0.12em',
                          textTransform:'uppercase', fontFamily:'UniversNext, sans-serif',
                        }}>Module Shape</div>
                      </div>
                    )}

                    {/* Finder pattern arc wheel */}
                    {activePanel === 'finder' && (
                      <div style={{ position:'absolute', inset:0, zIndex:1 }}>
                        <ArcWheelList
                          count={FINDERS.length}
                          selectedIdx={finderIdx}
                          onSelect={(i) => { playTick(); selectFinder(i) }}
                          renderItem={(i, isActive) => (
                            <>
                              <div style={{
                                width:28, height:28, flexShrink:0,
                                display:'flex', alignItems:'center', justifyContent:'center',
                              }}>
                                <svg viewBox="0 0 70 70" width="22" height="22">
                                  <path d={finderPath(0, 0, 10, FINDERS[i].id)}
                                    fill={isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)'}
                                    fillRule="evenodd"
                                    style={{ transition:'fill 0.28s ease' }}/>
                                </svg>
                              </div>
                              <span style={{
                                fontSize: isActive ? 12 : 10,
                                fontFamily:'UniversNext, sans-serif',
                                color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.32)',
                                transition:'font-size 0.28s ease, color 0.28s ease',
                                whiteSpace:'nowrap', fontWeight: isActive ? 500 : 400,
                                letterSpacing: isActive ? '0.01em' : 0,
                              }}>{FINDERS[i].label}</span>
                            </>
                          )}
                        />
                        <div style={{
                          position:'absolute', top:10, left:22, zIndex:5, pointerEvents:'none',
                          color:'rgba(255,255,255,0.4)', fontSize:9, letterSpacing:'0.12em',
                          textTransform:'uppercase', fontFamily:'UniversNext, sans-serif',
                        }}>Finder Pattern</div>
                      </div>
                    )}

                    {/* Gradient stops arc wheel */}
                    {activePanel === 'gradient' && (() => {
                      const sorted = [...s.gradientStops].sort((a,b)=>a.position-b.position)
                      const selIdx = Math.max(0, sorted.findIndex(st => st.id === selectedStopId))
                      const gradCss = sorted.map(st=>`${st.color} ${st.position}%`).join(', ')
                      return (
                        <div style={{ position:'absolute', inset:0, zIndex:1 }}>
                          {/* Gradient preview bar */}
                          <div style={{
                            position:'absolute', top:28, left:14, right:14, height:5, borderRadius:3,
                            background:`linear-gradient(to right, ${gradCss})`,
                            boxShadow:'0 1px 6px rgba(0,0,0,0.5)', zIndex:5, pointerEvents:'none',
                          }}>
                            {/* Stop markers on the bar */}
                            {sorted.map((st, i) => (
                              <div key={st.id} onClick={() => setSelectedStopId(st.id)}
                                style={{
                                  position:'absolute', top:'50%', left:`${st.position}%`,
                                  transform:'translate(-50%, -50%)',
                                  width: i === selIdx ? 11 : 7, height: i === selIdx ? 11 : 7,
                                  borderRadius:'50%', background: st.color,
                                  border: i === selIdx ? '2px solid #fff' : '1.5px solid rgba(255,255,255,0.6)',
                                  boxShadow: i === selIdx ? `0 0 6px ${st.color}` : 'none',
                                  cursor:'pointer', pointerEvents:'all',
                                  transition:'all 0.2s ease',
                                  zIndex: i === selIdx ? 2 : 1,
                                }}/>
                            ))}
                          </div>
                          {/* Arc wheel */}
                          <ArcWheelList
                            count={sorted.length}
                            selectedIdx={selIdx}
                            onSelect={(i) => { playTick(); setSelectedStopId(sorted[i].id) }}
                            renderItem={(i, isActive) => {
                              const stop = sorted[i]
                              return (
                                <>
                                  <div style={{
                                    width:28, height:28, borderRadius:'50%', flexShrink:0,
                                    background: stop.color,
                                    boxShadow: isActive ? `0 0 10px ${stop.color}99, 0 2px 8px rgba(0,0,0,0.5)` : 'none',
                                    border: isActive ? '2px solid rgba(255,255,255,0.7)' : '1px solid rgba(255,255,255,0.15)',
                                    transition:'all 0.28s ease',
                                  }}/>
                                  <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                                    <span style={{
                                      fontSize: isActive ? 11 : 9, fontFamily:'monospace',
                                      fontWeight: isActive ? 600 : 400,
                                      color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.32)',
                                      transition:'all 0.28s ease', whiteSpace:'nowrap',
                                    }}>{stop.color.toUpperCase()}</span>
                                    <span style={{
                                      fontSize:8, fontFamily:'UniversNext, sans-serif',
                                      color: isActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)',
                                      transition:'color 0.28s ease', whiteSpace:'nowrap',
                                    }}>AT {stop.position}%</span>
                                  </div>
                                </>
                              )
                            }}
                          />
                          <div style={{
                            position:'absolute', top:10, left:22, zIndex:5, pointerEvents:'none',
                            color:'rgba(255,255,255,0.4)', fontSize:9, letterSpacing:'0.12em',
                            textTransform:'uppercase', fontFamily:'UniversNext, sans-serif',
                          }}>Gradient Stops · {sorted.length}</div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })()}

            {/* Right QR preview */}
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:20, paddingLeft:65 }}>
              {svgStr ? (
                <div ref={svgRef}
                  style={{ width:156, height:156, borderRadius: Math.round(s.cornerRoundness * 0.1872), overflow:'hidden', flexShrink:0 }}
                  dangerouslySetInnerHTML={{ __html: svgStr }}/>
              ) : (
                <div style={{ color:'rgba(255,255,255,0.2)', fontSize:11, fontFamily:'UniversNext, sans-serif' }}>generating...</div>
              )}
            </div>
          </div>

          {/* ── Controls body ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

            {/* Row 1: Color controls + nav — same column split as gradient/buttons below */}
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>

              {/* Left: BG + FG + groove + Gradient — matches gradient panel width */}
              <div style={{ flex:'0 0 185px', display:'flex', alignItems:'center', gap:8 }}>

                {/* BG group: no-bg button + color dot inside a pill */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:3, padding:'2px 2px',
                    background: isNight ? 'linear-gradient(145deg, #252530, #31313e)' : 'linear-gradient(145deg, #c8c8c8, #dcdcdc)',
                    boxShadow: isNight ? 'inset 2px 2px 5px #111120, inset -1px -1px 3px #39394a' : 'inset 2px 2px 5px #b0b0b0, inset -1px -1px 3px #eeeeee',
                    border: isNight ? '1px solid #1b1b28' : '1px solid #b8b8b8', borderRadius:40,
                    transition:'background 0.65s ease, box-shadow 0.65s ease' }}>
                    <button onClick={()=>{ playBtn(); set('bgColor', s.bgColor==='transparent'?'#ffffff':'transparent'); if(s.bgColor!=='transparent') setActivePanel('none') }}
                      style={{ ...hw.btn(s.bgColor==='transparent'), width:28, height:28, borderRadius:'50%',
                        padding:0, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <img src="/images/lab/no-bg-icon.svg" width="14" height="14" style={{ display:'block' }}/>
                    </button>
                    <ColorDot color={s.bgColor==='transparent'?'#ffffff':s.bgColor} label="" active={activePanel==='bg'} onClick={()=>{ playBtn(); if(s.bgColor==='transparent') set('bgColor','#ffffff'); togglePanel('bg') }} isNight={isNight}/>
                  </div>
                  <span style={{ ...hw.label, color: activePanel==='bg' ? '#ffffff' : '#888' }}>Background</span>
                </div>

                {/* FG + line + Gradient — gap:0 so line physically touches both */}
                <div style={{ display:'flex', alignItems:'center', gap:0 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    <div style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', paddingLeft:1, flexShrink:0,
                      background: isNight ? 'linear-gradient(145deg, #27272e, #35353e)' : 'linear-gradient(145deg, #cccccc, #e0e0e0)',
                      boxShadow: isNight ? 'inset 4px 4px 10px rgba(0,0,0,0.7)' : 'inset 4px 4px 10px rgba(0,0,0,0.22)',
                      border: isNight ? '1px solid #1b1b24' : '1px solid #c0c0c0', borderRadius:'50%', overflow:'hidden',
                      transition:'background 0.65s ease' }}>
                      {s.gradientEnabled ? (
                        <button
                          onClick={()=>{ playBtn(); togglePanel('gradient') }}
                          style={{
                            width:28, height:28, borderRadius:'50%', cursor:'pointer', padding:0,
                            background:`linear-gradient(135deg, ${[...s.gradientStops].sort((a,b)=>a.position-b.position).map(st=>`${st.color} ${st.position}%`).join(', ')})`,
                            boxShadow: activePanel==='gradient' ? 'inset 2px 2px 5px rgba(0,0,0,0.3)' : '3px 3px 6px #a0a0a0, -2px -2px 4px #f4f4f4',
                            border:'2px solid #000000',
                            flexShrink:0,
                          }}
                        />
                      ) : (
                        <ColorDot color={s.fgColor} label="" active={activePanel==='fg'} onClick={()=>{ playBtn(); togglePanel('fg') }} isNight={isNight}/>
                      )}
                    </div>
                    <span style={{ ...hw.label, color: (activePanel==='fg'||activePanel==='gradient') ? '#ffffff' : '#888' }}>Foreground</span>
                  </div>
                  <div style={{ width:20, height:1, borderRadius:1, background:'#b5b5b5', flexShrink:0, alignSelf:'center', marginBottom:15, marginLeft:-11 }}/>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, paddingTop:6 }}>
                    <HWToggle checked={s.gradientEnabled} onChange={v=>{ playToggle(); set('gradientEnabled',v) }} isNight={isNight}/>
                    <span style={{ ...hw.label, color: s.gradientEnabled ? '#ffffff' : '#888' }}>Gradient</span>
                  </div>
                </div>
              </div>

              {/* Right: Nav pill — flex:1 matches right column width exactly */}
              <div style={{ flex:1, display:'flex', alignItems:'center', gap:6,
                background: isNight ? 'linear-gradient(160deg, #252530, #2e2e3c)' : 'linear-gradient(160deg, #c8c8c8, #d8d8d8)',
                boxShadow: isNight ? 'inset 3px 3px 8px rgba(0,0,0,0.5), inset -2px -2px 5px rgba(70,80,130,0.1)' : 'inset 3px 3px 8px rgba(0,0,0,0.18), inset -2px -2px 5px rgba(255,255,255,0.6)',
                borderRadius:40, padding:'6px 8px',
                transition:'background 0.65s ease, box-shadow 0.65s ease' }}>
                <button onClick={()=>{ playBtn(); scrollPanel(-1) }}
                  onMouseDown={()=>setPressedBtn('nav-up')} onMouseUp={()=>setPressedBtn(null)} onMouseLeave={()=>setPressedBtn(null)}
                  style={{ ...hw.btn(pressedBtn==='nav-up'), width:38, height:38, borderRadius:19,
                    display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0,
                    transition:'all 0.08s' }}>
                  <img src="/images/lab/selector-up-button-icon.svg" width="16" height="10" style={{ display:'block' }}/>
                </button>
                <DrumTrack onNavigate={scrollPanel} onTick={playTick} isNight={isNight}/>
                <button onClick={()=>{ playBtn(); scrollPanel(1) }}
                  onMouseDown={()=>setPressedBtn('nav-dn')} onMouseUp={()=>setPressedBtn(null)} onMouseLeave={()=>setPressedBtn(null)}
                  style={{ ...hw.btn(pressedBtn==='nav-dn'), width:38, height:38, borderRadius:19,
                    display:'flex', alignItems:'center', justifyContent:'center', padding:0, flexShrink:0,
                    transition:'all 0.08s' }}>
                  <img src="/images/lab/selector-down-button-icon.svg" width="16" height="10" style={{ display:'block' }}/>
                </button>
              </div>
            </div>

            {/* Row 2+3: Two-column — Gradient panel | 4 buttons */}
            <div style={{ display:'flex', gap:8, alignItems:'stretch' }}>

              {/* Left: Gradient inset panel */}
              <div style={{ ...hw.inset, border:'none', padding:'12px 10px', display:'flex', flexDirection:'column', gap:12, flex:'0 0 185px', alignItems:'center',
                background:`url(/images/lab/wood-texture-${isNight ? '1' : '2'}.jpg) center/cover`,
                boxShadow:'inset 0 3px 8px rgba(0,0,0,0.5), inset 3px 0 5px rgba(0,0,0,0.3), inset -3px 0 7px rgba(255,255,255,0.07), inset 0 -3px 7px rgba(255,255,255,0.07)' }}>
                {/* Top: Type + Angle knob */}
                <div style={{ display:'flex', justifyContent:'space-around', alignItems:'center', width:'100%', marginTop:10 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, marginLeft:-24 }}>
                    <TypeSelector value={s.gradientType} onChange={v=>{ playToggle(); setMany({ gradientType: v, gradientEnabled: true }); setActivePanel('gradient') }} isNight={isNight}/>
                    <span style={{ ...hw.label, color:'rgba(255,255,255,0.7)', marginLeft:20 }}>Type</span>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <Knob value={s.gradientAngle} onChange={v=>{ setMany({ gradientAngle: v, gradientEnabled: true }); setActivePanel('gradient') }} isNight={isNight}/>
                    <span style={{ ...hw.label, color:'rgba(255,255,255,0.7)' }}>Angle</span>
                  </div>
                </div>
                {/* Bottom: Color Stops + Distance slider */}
                <div style={{ display:'flex', justifyContent:'space-around', alignItems:'flex-start', width:'100%' }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, marginTop:20 }}>
                    <div style={{ background: isNight ? 'linear-gradient(145deg, #272732, #1e1e28)' : 'linear-gradient(145deg, #d0d0d0, #c4c4c4)',
                      boxShadow: isNight ? 'inset 3px 3px 8px rgba(0,0,0,0.6), inset -1px -1px 3px rgba(60,70,110,0.12)' : 'inset 3px 3px 8px rgba(0,0,0,0.35), inset -1px -1px 3px rgba(255,255,255,0.3)',
                      border: isNight ? '1px solid #141420' : '1px solid #b0b0b0', borderRadius:16, padding:3,
                      display:'grid', gridTemplateColumns:'1fr 1fr', gap:3,
                      transition:'background 0.65s ease, box-shadow 0.65s ease' }}>
                      <button onClick={()=>{ playBtn(); navigateStop(-1) }}
                        onMouseDown={()=>setPressedBtn('up')} onMouseUp={()=>setPressedBtn(null)} onMouseLeave={()=>setPressedBtn(null)}
                        style={{ ...hw.btn(pressedBtn==='up'), width:30, height:30, borderRadius:'16px 16px 5px 5px', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                        <img src="/images/lab/selector-up-button-icon.svg" width="12" height="8" style={{ display:'block', filter:'brightness(0) invert(1)', opacity: stopsLit ? 1 : 0.4, transition:'opacity 0.2s' }}/>
                      </button>
                      <button onClick={()=>{ playBtn(); addStop() }}
                        onMouseDown={()=>setPressedBtn('add')} onMouseUp={()=>setPressedBtn(null)} onMouseLeave={()=>setPressedBtn(null)}
                        style={{ ...hw.btn(pressedBtn==='add'), width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', padding:0, fontSize:17, fontWeight:300, color: stopsLit ? '#ffffff' : hw.btn(pressedBtn==='add').color }}>+</button>
                      <button onClick={()=>{ playBtn(); navigateStop(1) }}
                        onMouseDown={()=>setPressedBtn('dn')} onMouseUp={()=>setPressedBtn(null)} onMouseLeave={()=>setPressedBtn(null)}
                        style={{ ...hw.btn(pressedBtn==='dn'), width:30, height:30, borderRadius:'5px 5px 16px 16px', display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
                        <img src="/images/lab/selector-down-button-icon.svg" width="12" height="8" style={{ display:'block', filter:'brightness(0) invert(1)', opacity: stopsLit ? 1 : 0.4, transition:'opacity 0.2s' }}/>
                      </button>
                      <button onClick={()=>{ playBtn(); removeStop() }}
                        onMouseDown={()=>setPressedBtn('rm')} onMouseUp={()=>setPressedBtn(null)} onMouseLeave={()=>setPressedBtn(null)}
                        style={{ ...hw.btn(pressedBtn==='rm'), width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', padding:0, fontSize:18, fontWeight:300, color: stopsLit ? '#ffffff' : hw.btn(pressedBtn==='rm').color }}>−</button>
                    </div>
                    <span style={{ ...hw.label, color:'rgba(255,255,255,0.7)' }}>Color Stops</span>
                  </div>
                  <VSlider
                    value={activePanel === 'gradient'
                      ? ([...s.gradientStops].sort((a,b)=>a.position-b.position).find(st=>st.id===selectedStopId)?.position ?? 50)
                      : s.gradientSpread}
                    onChange={v => {
                      if (activePanel === 'gradient') {
                        setMany({ gradientStops: s.gradientStops.map(st=>st.id===selectedStopId?{...st,position:v}:st), gradientEnabled: true })
                      } else {
                        setMany({ gradientSpread: v, gradientEnabled: true })
                      }
                    }}
                    min={0} max={activePanel === 'gradient' ? 100 : 10}
                    label={activePanel === 'gradient' ? 'Position' : 'Distance'}
                    labelColor="rgba(255,255,255,0.7)"
                    isNight={isNight}
                  />
                </div>
              </div>

              {/* Right column: buttons + EC + roundness + download stacked */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>

                {/* 2x2 panel buttons */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {([
                    { id:'preset' as ActivePanel, icon:'/images/lab/preset-icon.svg', label:'Preset' },
                    { id:'texture' as ActivePanel, icon:'/images/lab/texture-icon.svg', label:'Texture' },
                    { id:'shape' as ActivePanel, icon:'/images/lab/finder-pattern-icon.svg', label:'Module Shape' },
                    { id:'finder' as ActivePanel, icon:'/images/lab/mudule-shape-icon.svg', label:'Finder Pattern' },
                  ] as const).map(btn=>(
                    <button key={btn.id} onClick={()=>{ playBtn(); togglePanel(btn.id) }}
                      style={{ ...hw.btn(activePanel===btn.id), borderRadius:22, padding:'11px 10px',
                        display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:500,
                        letterSpacing:'0.02em', justifyContent:'center', whiteSpace:'nowrap',
                        color: activePanel===btn.id ? '#ffffff' : '#555' }}>
                      <img src={btn.icon} width="14" height="14" style={{ display:'block',
                        filter: activePanel===btn.id ? 'brightness(0) invert(1)' : 'opacity(0.5)' }}/>
                      {btn.label}
                    </button>
                  ))}
                </div>

                {/* Error Correction */}
                <div style={{ display:'flex', alignItems:'flex-end', gap:10 }}>
                  <span style={{ ...hw.label, textAlign:'left', flexShrink:0, marginTop:0, marginBottom:4 }}>Error Correction</span>
                  <div style={{ flex:1 }}>
                    <ECSelector value={s.ecLevel} onChange={v=>{ playToggle(); set('ecLevel',v) }} isNight={isNight}/>
                  </div>
                </div>

                {/* Corner Roundness: label + slider side by side */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
                  <span style={{ ...hw.label, textAlign:'left', marginTop:0, flexShrink:0 }}>Corner Roundness</span>
                  <div ref={cornerSliderRef} style={{ flex:1, position:'relative', height:22 }}>
                    <div style={{ position:'absolute', top:'50%', left:0, right:0, height:6, transform:'translateY(-50%)',
                      borderRadius:3, background: isNight ? 'linear-gradient(to right, #1e1e28, #2a2a36)' : 'linear-gradient(to right,#c0c0c0,#d8d8d8)',
                      boxShadow: isNight ? 'inset 1px 1px 3px rgba(0,0,0,0.6)' : 'inset 1px 1px 3px rgba(0,0,0,0.2)' }}/>
                    <input type="range" min={0} max={100} value={s.cornerRoundness}
                      onChange={e=>set('cornerRoundness',Number(e.target.value))}
                      style={{ position:'absolute', inset:0, width:'100%', opacity:0, cursor:'pointer' }}/>
                    <div style={{ position:'absolute', top:'50%', transform:'translateY(-50%)', left:`${s.cornerRoundness}%`,
                      marginLeft:-13, width:26, height:24, borderRadius:12, pointerEvents:'none',
                      background: isNight ? 'linear-gradient(145deg, #383844, #28282e)' : 'linear-gradient(145deg, #f0f0f0, #d8d8d8)',
                      boxShadow: isNight ? '3px 3px 8px rgba(0,0,0,0.65)' : '3px 3px 8px rgba(0,0,0,0.3)',
                      border: isNight ? '1px solid #1e1e28' : '1px solid #c8c8c8', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ width:14, height:5, borderRadius:3,
                        background: isNight ? 'linear-gradient(145deg, #2e2e3a, #3a3a46)' : 'linear-gradient(145deg, #e8e8e8, #f6f6f6)',
                        boxShadow: isNight ? 'inset 1px 1px 2px rgba(0,0,0,0.45), inset -1px -1px 1px rgba(70,80,120,0.1)' : 'inset 1px 1px 2px rgba(0,0,0,0.12), inset -1px -1px 1px rgba(255,255,255,0.8)' }}/>
                    </div>
                  </div>
                </div>

                {/* Download — full width, pinned to bottom */}
                <button onClick={()=>{ playBtn(); downloadSVG() }}
                  style={{ ...hw.btn(false), borderRadius:22, padding:'11px 0', width:'100%', marginTop:'auto',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontSize:11, fontWeight:500, letterSpacing:'0.03em' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

      {/* ── Day / Night toggle pill — same pattern as Walkman ── */}
      <div className="qr-theme-pill" style={{
        position: 'fixed', top: '1rem', right: '1rem', zIndex: 10010,
        width: '42px',
        background: isNight ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        border: '1.5px solid rgba(255,255,255,0.15)',
        borderRadius: '21px',
        backdropFilter: 'blur(12px)',
        boxShadow: isNight
          ? 'inset -14px 0 28px rgba(200,225,255,0.22)'
          : 'inset 14px 0 28px rgba(255,148,30,0.28)',
        transition: 'background 0.35s ease, border-color 0.35s ease, box-shadow 0.55s ease',
        overflow: 'hidden',
      }}>
        {/* Sun — day mode */}
        <button
          className="qr-pill-sun"
          onClick={() => setIsNight(false)}
          title="Day"
          style={{
            width: '42px', height: '42px', borderRadius: '21px 21px 0 0',
            background: !isNight ? 'radial-gradient(circle at center, rgba(255,165,30,0.22) 0%, transparent 72%)' : 'none',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            transition: 'background 0.4s ease',
          }}
        >
          <img src="/images/lab/sun.png" alt="day"
            className="qr-pill-img"
            style={{
              width: '20px', height: '20px', objectFit: 'contain',
              opacity: isNight ? 0.72 : 1,
              filter: !isNight ? 'drop-shadow(0 0 5px rgba(255,160,20,0.9)) drop-shadow(0 0 10px rgba(255,130,0,0.5))' : 'none',
              animation: !isNight ? 'qr-spin-slow 20s linear infinite' : 'none',
              transition: 'opacity 0.35s ease, filter 0.35s ease',
            }}
          />
        </button>
        {/* Moon — night mode */}
        <button
          className="qr-pill-moon"
          onClick={() => setIsNight(true)}
          title="Night"
          style={{
            width: '42px', height: '42px', borderRadius: '0 0 21px 21px',
            background: isNight ? 'radial-gradient(circle at center, rgba(170,210,255,0.20) 0%, transparent 72%)' : 'none',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            transition: 'background 0.4s ease',
          }}
        >
          <img src="/images/lab/moon.png" alt="night"
            className="qr-pill-img"
            style={{
              width: '20px', height: '20px', objectFit: 'contain',
              opacity: isNight ? 1 : 0.72,
              filter: isNight ? 'drop-shadow(0 0 5px rgba(180,215,255,0.9)) drop-shadow(0 0 10px rgba(140,190,255,0.5))' : 'none',
              animation: isNight ? 'qr-spin-slow 20s linear infinite' : 'none',
              transition: 'opacity 0.35s ease, filter 0.35s ease',
            }}
          />
        </button>
      </div>

      {/* ── Manual button ── */}
      <button
        className="manual-btn"
        onClick={() => setShowManual(true)}
        style={{
          position: 'fixed', bottom: 24, right: 0, zIndex: 10020,
          padding: '8px 18px 8px 16px',
          borderRadius: '20px 0 0 20px',
          background: isNight
            ? 'linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 45%), linear-gradient(160deg, #2e2e42, #16161f)'
            : 'linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 45%), linear-gradient(160deg, #5a4030, #2a1a0e)',
          borderTop: isNight ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.2)',
          borderLeft: isNight ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.2)',
          borderBottom: isNight ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.2)',
          borderRight: 'none',
          color: 'rgba(255,255,255,0.92)',
          fontSize: 11, letterSpacing: '0.08em', fontFamily: 'UniversNext, sans-serif',
          fontWeight: 500, cursor: 'pointer',
          boxShadow: '-2px 2px 8px rgba(0,0,0,0.12)',
          transition: 'all 0.2s ease',
        }}
      >
        user manual
      </button>

      {/* ── Manual overlay ── */}
      {showManual && (
        <div
          className="manual-overlay"
          onClick={() => setShowManual(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10030,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
            animation: 'manualFadeIn 0.2s ease',
          }}
        >
          <div
            className="manual-paper"
            onClick={e => e.stopPropagation()}
            style={{
              background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"), #f5f2eb`,
              borderRadius: 4,
              boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.25)',
              maxWidth: 1120, width: '96vw',
              overflow: 'hidden',
              position: 'relative',
              fontFamily: 'UniversNext, system-ui, sans-serif',
            }}
          >
            {/* Header */}
            <div className="manual-header-wrap" style={{
              padding: '18px 24px 14px',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundImage: 'url(/images/lab/menual-head-bg.png)',
              backgroundRepeat: 'repeat-x',
              backgroundSize: 'auto 100%',
              backgroundPosition: '-500px top',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em', whiteSpace: 'nowrap', textShadow: '0 1px 4px #fef5de, 0 2px 8px #fef5de' }}>
                QR Device <span style={{ fontWeight: 500, fontSize: 22, color: '#1a1a1a', letterSpacing: '-0.02em' }}>· Quick Guide</span>
              </div>
              <button onClick={() => setShowManual(false)} style={{
                border: 'none', background: 'rgba(0,0,0,0.12)', color: '#333', fontSize: 18,
                cursor: 'pointer', lineHeight: 1, padding: '5px 8px', borderRadius: 6,
                alignSelf: 'flex-start', marginTop: -10, marginRight: -10,
                fontWeight: 700,
              }}>✕</button>
            </div>

            <div className="manual-body">
            {/* 5-column grid — all 15 items fit in 3 rows, no scroll needed */}
            <div className="manual-no-shadows manual-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'rgba(0,0,0,0.06)' }}>

              {/* URL Input */}
              <ManCard label="URL / Text Input" desc="Type or paste any link or text. The QR updates live.">
                <div style={{ display:'flex', alignItems:'center', background:'#0d0d0d', borderRadius:9, padding:'0 12px', height:32, boxShadow:'inset 0 2px 6px rgba(0,0,0,0.9)', border:'1px solid #000', width:'100%', boxSizing:'border-box' }}>
                  <span style={{ fontSize:9, color:'#888', fontFamily:'monospace' }}>https://your-link.com/</span>
                </div>
              </ManCard>

              {/* Background & Foreground */}
              <ManCard label="Background & Foreground" desc="Tap a dot to open the color picker. BG = canvas, FG = dots.">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:3, padding:'2px', background: isNight ? 'linear-gradient(145deg,#252530,#31313e)' : 'linear-gradient(145deg,#c8c8c8,#dcdcdc)', boxShadow: isNight ? 'inset 2px 2px 5px #111120' : 'inset 2px 2px 5px #b0b0b0', border: isNight ? '1px solid #1b1b28' : '1px solid #b8b8b8', borderRadius:40 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', ...hw.btn(false), display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <img src="/images/lab/no-bg-icon.svg" width="14" height="14"/>
                      </div>
                      <ColorDot color="#ffffff" label="" active={false} onClick={()=>{}} isNight={isNight}/>
                    </div>
                    <span style={{ fontSize:7, color:'#888', textTransform:'uppercase' }}>Background</span>
                  </div>
                  <ColorDot color="#111111" label="Foreground" active={false} onClick={()=>{}} isNight={isNight}/>
                </div>
              </ManCard>

              {/* Module Shape */}
              <ManCard label="Module Shape" desc="Opens the dot shape picker — square, circle, diamond, star and more.">
                <button style={{ ...hw.btn(false), borderRadius:22, padding:'11px 14px', display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:500, color: isNight ? '#aaa' : '#555' }}>
                  <img src="/images/lab/finder-pattern-icon.svg" width="14" height="14" style={{ filter: isNight ? 'brightness(0) invert(1) opacity(0.5)' : 'opacity(0.5)' }}/>
                  Module Shape
                </button>
              </ManCard>

              {/* Finder Pattern */}
              <ManCard label="Finder Pattern" desc="Styles the three corner squares scanners use to orient the code.">
                <button style={{ ...hw.btn(false), borderRadius:22, padding:'11px 14px', display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:500, color: isNight ? '#aaa' : '#555' }}>
                  <img src="/images/lab/mudule-shape-icon.svg" width="14" height="14" style={{ filter: isNight ? 'brightness(0) invert(1) opacity(0.5)' : 'opacity(0.5)' }}/>
                  Finder Pattern
                </button>
              </ManCard>

              {/* Gradient */}
              <ManCard label="Gradient" desc="Toggle to apply a gradient across the dots. Tap FG dot to edit color stops.">
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  <HWToggle checked={false} onChange={()=>{}} isNight={isNight}/>
                  <HWToggle checked={true}  onChange={()=>{}} isNight={isNight}/>
                  <span style={{ fontSize:8, color: isNight ? '#444' : '#bbb' }}>off → on</span>
                </div>
              </ManCard>

              {/* Gradient Type */}
              <ManCard label="Gradient Type" desc="L = linear, R = radial, C = conical. Controls the direction of color flow.">
                <TypeSelector value="L" onChange={()=>{}} isNight={isNight} labelColor="#444"/>
              </ManCard>

              {/* Angle */}
              <ManCard label="Angle" desc="Drag the knob to rotate the gradient. Only affects linear gradients.">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Knob value={45} onChange={()=>{}} isNight={isNight}/>
                  <span style={{ fontSize:8, color: isNight ? '#444' : '#bbb', lineHeight:1.4 }}>drag<br/>to rotate</span>
                </div>
              </ManCard>

              {/* Color Stops */}
              <ManCard label="Color Stops" desc="↑↓ cycle stops. + adds, − removes. Tap a stop dot on the screen to select it.">
                <div style={{ background: isNight ? 'linear-gradient(145deg,#272732,#1e1e28)' : 'linear-gradient(145deg,#d0d0d0,#c4c4c4)', boxShadow: isNight ? 'inset 3px 3px 8px rgba(0,0,0,0.6)' : 'inset 3px 3px 8px rgba(0,0,0,0.35)', border: isNight ? '1px solid #141420' : '1px solid #b0b0b0', borderRadius:16, padding:3, display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>
                  {[['16px 16px 5px 5px','up'],['50%','+'],['5px 5px 16px 16px','dn'],['50%','−']].map(([r,k]) => (
                    <button key={k} style={{ ...hw.btn(false), width:30, height:30, borderRadius:r, display:'flex', alignItems:'center', justifyContent:'center', padding:0, fontSize: k==='+'||k==='−' ? 17 : undefined, fontWeight:300, color: isNight ? '#bbb' : '#555' }}>
                      {k==='up' ? <img src="/images/lab/selector-up-button-icon.svg" width="12" height="8" style={{ filter: isNight ? 'brightness(0) invert(1) opacity(0.6)' : undefined }}/> : k==='dn' ? <img src="/images/lab/selector-down-button-icon.svg" width="12" height="8" style={{ filter: isNight ? 'brightness(0) invert(1) opacity(0.6)' : undefined }}/> : k}
                    </button>
                  ))}
                </div>
              </ManCard>

              {/* Distance */}
              <ManCard label="Distance" desc="Vertical slider — controls how far gradient colors spread across the QR modules.">
                <VSlider value={5} onChange={()=>{}} min={0} max={10} label="Distance" labelColor={isNight ? 'rgba(255,255,255,0.4)' : '#888'} isNight={isNight}/>
              </ManCard>

              {/* Preset */}
              <ManCard label="Preset" desc="One-tap gradient themes — Sunset, Ocean, Neon, Gold, Aurora, Fire, Candy and more.">
                <button style={{ ...hw.btn(false), borderRadius:22, padding:'11px 14px', display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:500, color: isNight ? '#aaa' : '#555' }}>
                  <img src="/images/lab/preset-icon.svg" width="14" height="14" style={{ filter: isNight ? 'brightness(0) invert(1) opacity(0.5)' : 'opacity(0.5)' }}/>
                  Preset
                </button>
              </ManCard>

              {/* Texture */}
              <ManCard label="Texture" desc="Apply a material skin — Brushed Silver, Carbon, Washi, Neon Glow, Blueprint and more.">
                <button style={{ ...hw.btn(false), borderRadius:22, padding:'11px 14px', display:'flex', alignItems:'center', gap:6, fontSize:10, fontWeight:500, color: isNight ? '#aaa' : '#555' }}>
                  <img src="/images/lab/texture-icon.svg" width="14" height="14" style={{ filter: isNight ? 'brightness(0) invert(1) opacity(0.5)' : 'opacity(0.5)' }}/>
                  Texture
                </button>
              </ManCard>

              {/* Corner Roundness */}
              <ManCard label="Corner Roundness" desc="Drag to round the finder corners from sharp square to fully circular.">
                <div style={{ width:'100%', position:'relative', height:22 }}>
                  <div style={{ position:'absolute', top:'50%', left:0, right:0, height:6, transform:'translateY(-50%)', borderRadius:3, background: isNight ? 'linear-gradient(145deg,#272732,#1e1e28)' : 'linear-gradient(145deg,#b0b0b0,#c8c8c8)', boxShadow: isNight ? 'inset 2px 2px 6px rgba(0,0,0,0.7)' : 'inset 2px 2px 6px rgba(0,0,0,0.22)', border: isNight ? '1px solid #141420' : '1px solid #999' }}/>
                  <div style={{ position:'absolute', top:'50%', left:'40%', transform:'translateY(-50%)', width:20, height:20, borderRadius:'50%', ...hw.btn(false) }}/>
                </div>
              </ManCard>

              {/* Error Correction */}
              <ManCard label="Error Correction" desc="L = smallest. H = most tolerant of damage. Use H when overlaying a logo.">
                <div style={{ width:'100%' }}>
                  <ECSelector value="H" onChange={()=>{}} isNight={isNight} labelColor="#444"/>
                </div>
              </ManCard>

              {/* Download */}
              <ManCard label="Download" desc="Saves the QR as a lossless SVG — scales perfectly to any print size.">
                <button style={{ ...hw.btn(false), width:'100%', borderRadius:22, padding:'10px 0', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:7, color: isNight ? '#bbb' : '#444', boxSizing:'border-box' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 4v12M8 13l4 5 4-5"/><path d="M4 20h16"/></svg>
                  Download
                </button>
              </ManCard>

              {/* 5th slot — logo (hidden on mobile) */}
              <div className="manual-logo-cell" style={{ background:'#f5f2eb', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src="/images/common/sa26-filled.svg" alt="Satish Hebbal" style={{ width: 36, height: 36, opacity: 0.25 }}/>
              </div>

            </div>

            </div>{/* end manual-body */}
            {/* Footer */}
            <div className="manual-footer-wrap" style={{
              padding: '10px 24px',
              borderTop: '1px solid rgba(0,0,0,0.07)',
              fontSize: 11, color: '#888', letterSpacing: '0.1em', textAlign: 'center',
              textTransform: 'uppercase', fontFamily: 'UniversNext, sans-serif', fontWeight: 500,
            }}>
              MANUFACTURED WITH ❤️ FOR CRAFT · SATISHHEBBAL.DESIGN
            </div>
          </div>
        </div>
      )}
    </>
  )
}
