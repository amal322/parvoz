// Hero of the second visual style. One idea: every student has a shape, drawn by six verified measures.
import React, { useEffect, useRef, useState } from 'react'
import { AXES, radarOf, type Radar } from '../data/insight'
import { STUDENTS } from '../data/seed'
import type { School, Student } from '../data/logic'
import { enter } from '../data/store'
import { useT } from '../i18n'
import { Backed, Btn, Icon, Portrait, reduceMotion } from '../ui/bits'
import { startTour } from '../ui/tour'

// six students whose shapes differ most: for each school, the one with the widest spread between measures
const spread = (x: Student) => { const v = Object.values(radarOf(x)); return Math.max(...v) - Math.min(...v) }
const pick = (s: School, n = 0) => STUDENTS.filter((x) => x.school === s && x.id !== STUDENTS[0].id).sort((a, b) => spread(b) - spread(a))[n]
const CAST: Student[] = [STUDENTS[0], pick('bus'), pick('med'), pick('den'), pick('arc'), pick('hos')]

const W = 520, C = 260, R = 190
const ang = (i: number) => ((-90 + i * 60) * Math.PI) / 180
const at = (i: number, v: number, r = R) => [C + Math.cos(ang(i)) * r * (v / 100), C + Math.sin(ang(i)) * r * (v / 100)]
const pts = (vals: number[]) => vals.map((v, i) => at(i, v).map((n) => n.toFixed(1)).join(',')).join(' ')

/** Letters rise one after another; words stay whole so a line never breaks inside one. */
function Rise({ text, from = 0 }: { text: string; from?: number }) {
  let n = from
  return <>{text.split(' ').map((w, i) => <span className="hb-w" key={i}>{[...w].map((ch, j) => <span className="hb-ch" key={j} style={{ '--i': n++ } as React.CSSProperties}>{ch}</span>)}</span>)}</>
}

export function HeroB() {
  const { t } = useT()
  const [idx, setIdx] = useState(0)
  const [hold, setHold] = useState(false)
  const [vals, setVals] = useState<number[]>(() => AXES.map((a) => radarOf(CAST[0])[a]))
  const cur = useRef(vals)
  const s = CAST[idx]
  const target: Radar = radarOf(s)

  // the shape flows from one student to the next
  useEffect(() => {
    const to = AXES.map((a) => target[a]), from = cur.current
    if (reduceMotion()) { cur.current = to; return setVals(to) }
    const t0 = performance.now(), dur = 900
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4)
      const v = from.map((f, i) => f + (to[i] - f) * e)
      cur.current = v
      setVals(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [idx])
  useEffect(() => {
    if (hold || reduceMotion()) return
    const id = setTimeout(() => setIdx((i) => (i + 1) % CAST.length), 3400)
    return () => clearTimeout(id)
  }, [idx, hold])

  const a = t('hb.a'), b = t('hb.b')
  return (
    <section className={'heroB sch-' + s.school}>
      <div className="wrap heroB-in">
        <div className="heroB-copy">
          <p className="hb-kicker">{t('hero.kicker')}</p>
          <h1 className="hb-h" aria-label={`${a} ${b}`}>
            <span className="hb-l hb-bold" aria-hidden="true"><Rise text={a} /></span>
            <span className="hb-l hb-thin" aria-hidden="true"><Rise text={b} from={[...a].length} /></span>
          </h1>
          <p className="lede">{t('hb.lede')}</p>
          <div className="hero-cta">
            <Btn onClick={() => enter('company')}>{t('hero.cta')}</Btn>
            <button className="hb-play" onClick={startTour}><span><Icon name="play" size={13} /></span>{t('hero.tour')}</button>
          </div>
          <Backed />
          <p className="hero-note">{t('hero.demo')}</p>
        </div>

        <div className="heroB-stage" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
          <svg viewBox={`0 0 ${W} ${W}`} role="img" aria-label={t('ch.radar.aria', { name: s.name })}>
            {[25, 50, 75, 100].map((v) => <polygon key={v} className="hb-ring" points={pts(AXES.map(() => v))} />)}
            {AXES.map((ax, i) => { const [x, y] = at(i, 100); return <line key={ax} className="hb-spoke" x1={C} y1={C} x2={x} y2={y} /> })}
            <polygon className="hb-shape" points={pts(vals)} />
            {vals.map((v, i) => { const [x, y] = at(i, v); return <circle key={i} className="hb-dot" cx={x} cy={y} r="6" /> })}
            {AXES.map((ax, i) => {
              const c = Math.cos(ang(i)), sn = Math.sin(ang(i))
              const [x, y] = [C + c * (R + 22), C + sn * (R + 22) + (Math.abs(c) < 0.2 ? (sn < 0 ? -22 : 20) : sn < 0 ? -8 : 10)]
              return (
                <text key={ax} className="hb-label" x={x} y={y} textAnchor={Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end'}>
                  <tspan>{t('ax.' + ax)}</tspan><tspan className="hb-val" x={x} dy="1.15em">{Math.round(vals[i])}</tspan>
                </text>
              )
            })}
          </svg>
          <div className="heroB-meta">
          <div className="hb-id" key={s.id}>
            <Portrait s={s} />
            <span><b>{s.name}</b><small>{t('prog.' + s.program)} · {t('school.' + s.school)}</small></span>
          </div>
          <div className="hb-cast" role="tablist" aria-label={t('hb.cast')}>
            {CAST.map((x, i) => (
              <button key={x.id} role="tab" aria-selected={i === idx} className={'sch-' + x.school + (i === idx ? ' is-on' : '')} onClick={() => setIdx(i)} onMouseEnter={() => setIdx(i)} aria-label={x.name}><Portrait s={x} /></button>
            ))}
          </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** A ring that trails the pointer and swells over anything clickable. Second style, mouse only. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (reduceMotion() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const el = ref.current!
    let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, raf = 0
    const move = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY
      el.classList.add('is-on')
      el.classList.toggle('is-big', !!(e.target as Element).closest?.('button, a, input, select, textarea, [role=tab]'))
    }
    const loop = () => { x += (tx - x) * 0.2; y += (ty - y) * 0.2; el.style.transform = `translate(${x}px, ${y}px)`; raf = requestAnimationFrame(loop) }
    addEventListener('pointermove', move)
    raf = requestAnimationFrame(loop)
    return () => { removeEventListener('pointermove', move); cancelAnimationFrame(raf) }
  }, [])
  return <div className="cursor" ref={ref} aria-hidden="true"><i /></div>
}
