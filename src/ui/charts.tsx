// Charts for a student profile. Plain SVG and CSS, no chart library.
// Every chart has a legend or direct labels, a hover and keyboard layer, and a text equivalent.
import React, { useEffect, useState } from 'react'
import { AXES, type Radar as RadarValues } from '../data/insight'
import { useT } from '../i18n'
import { Pill, reduceMotion } from './bits'

/** Fixed order: a series keeps its colour whatever else is on the chart. */
export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)']

function useEntered() {
  const [on, setOn] = useState(reduceMotion())
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return on
}

export function Legend({ items }: { items: { name: string; color?: string; ref?: boolean }[] }) {
  return (
    <ul className="legend">
      {items.map((x, i) => <li key={i}>{x.ref ? <i className="sw-dash" /> : <i className="sw" style={{ background: x.color }} />}{x.name}</li>)}
    </ul>
  )
}

// ───────────────────────────────────────────────────────── radar
export interface RadarSeries { name: string; values: RadarValues; ref?: boolean }

const RW = 420, RH = 336, CX = 210, CY = 170, RR = 108
const ang = (i: number) => ((-90 + i * 60) * Math.PI) / 180
const pt = (i: number, v: number, r = RR) => [CX + Math.cos(ang(i)) * r * (v / 100), CY + Math.sin(ang(i)) * r * (v / 100)] as const
const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(',')).join(' ')

/** Six measures on one 0 to 100 scale. Solid shapes are people, the dashed outline is the reference. */
export function Radar({ series, label }: { series: RadarSeries[]; label: string }) {
  const { t } = useT()
  const on = useEntered()
  const [hover, setHover] = useState<number | null>(null)
  const people = series.filter((s) => !s.ref)
  const solo = people.length === 1
  const colorOf = (s: RadarSeries) => SERIES[people.indexOf(s)]
  const tipAt = hover === null ? null : pt(hover, Math.max(...series.map((s) => s.values[AXES[hover]])))
  return (
    <figure className="chartbox">
      <Legend items={series.map((s) => ({ name: s.name, color: colorOf(s), ref: s.ref }))} />
      <div className="radar">
        <svg viewBox={`0 0 ${RW} ${RH}`} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
          {[25, 50, 75, 100].map((v) => <polygon key={v} className={'radar-ring' + (v === 100 ? ' is-outer' : '')} points={poly(AXES.map(() => v))} />)}
          {AXES.map((a, i) => { const [x, y] = pt(i, 100); return <line key={a} className={'radar-spoke' + (hover === i ? ' is-on' : '')} x1={CX} y1={CY} x2={x} y2={y} /> })}
          <text className="radar-tick" x={CX + 5} y={CY - RR / 2 + 12}>50</text>
          <g className="radar-shapes" style={{ transform: `scale(${on ? 1 : 0.001})`, transformOrigin: `${CX}px ${CY}px` }}>
            {series.filter((s) => s.ref).map((s) => <polygon key={s.name} className="radar-ref" points={poly(AXES.map((a) => s.values[a]))} />)}
            {people.map((s) => (
              <g key={s.name} style={{ color: colorOf(s) }}>
                <polygon className="radar-area" points={poly(AXES.map((a) => s.values[a]))} />
                {AXES.map((a, i) => { const [x, y] = pt(i, s.values[a]); return <circle key={a} className="radar-dot" cx={x} cy={y} r={hover === i ? 5.5 : 4} /> })}
              </g>
            ))}
          </g>
          {AXES.map((a, i) => {
            const c = Math.cos(ang(i)), s = Math.sin(ang(i))
            const anchor = Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end'
            const x = CX + c * (RR + 16)
            const y = CY + s * (RR + 16) + (Math.abs(c) < 0.2 ? (s < 0 ? (solo ? -22 : -6) : 16) : s < 0 ? (solo ? -8 : 0) : 6)
            return (
              <text key={a} className={'radar-label' + (hover === i ? ' is-on' : '')} x={x} y={y} textAnchor={anchor}>
                <tspan>{t('ax.' + a)}</tspan>
                {solo && <tspan className="radar-val" x={x} dy="1.1em">{people[0].values[a]}</tspan>}
              </text>
            )
          })}
          {AXES.map((a, i) => {
            const [x1, y1] = [CX + Math.cos(ang(i) - 0.52) * (RR + 60), CY + Math.sin(ang(i) - 0.52) * (RR + 60)]
            const [x2, y2] = [CX + Math.cos(ang(i) + 0.52) * (RR + 60), CY + Math.sin(ang(i) + 0.52) * (RR + 60)]
            return (
              <polygon key={a} className="hit" points={`${CX},${CY} ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`} tabIndex={0} role="img"
                aria-label={`${t('ax.' + a)}: ${series.map((s) => `${s.name} ${s.values[a]}`).join(', ')}`}
                onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
            )
          })}
        </svg>
        {hover !== null && tipAt && (
          <div className="ctip" role="tooltip" style={{ left: (tipAt[0] / RW) * 100 + '%', top: (tipAt[1] / RH) * 100 + '%' }}>
            <b>{t('ax.' + AXES[hover])}</b>
            {series.map((s) => <span key={s.name}>{s.ref ? <i className="sw-dash" /> : <i className="sw" style={{ background: colorOf(s) }} />}{s.name}<em>{s.values[AXES[hover]]}</em></span>)}
          </div>
        )}
      </div>
      <table className="vh">
        <caption>{label}</caption>
        <thead><tr><th />{series.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
        <tbody>{AXES.map((a) => <tr key={a}><th>{t('ax.' + a)}</th>{series.map((s) => <td key={s.name}>{s.values[a]}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  )
}

// ───────────────────────────────────────────────────────── GPA by semester
const TW = 420, TH = 196, TL = 34, TR = 44, TT = 14, TB = 28
const Y_MIN = 2, Y_MAX = 4

export function TermChart({ name, terms, cohort, label }: { name: string; terms: { n: number; gpa: number; att: number }[]; cohort: (number | null)[]; label: string }) {
  const { t, lang } = useT()
  const [hover, setHover] = useState<number | null>(null)
  const n = terms.length
  const pw = TW - TL - TR, ph = TH - TT - TB
  const x = (i: number) => TL + (n === 1 ? pw / 2 : (i / (n - 1)) * pw)
  const y = (g: number) => TT + ((Y_MAX - Math.max(Y_MIN, g)) / (Y_MAX - Y_MIN)) * ph
  const f2 = (g: number) => (lang === 'en' ? g.toFixed(2) : g.toFixed(2).replace('.', ','))
  const path = (vals: (number | null)[]) => vals.map((g, i) => (g === null ? '' : `${i === 0 || vals[i - 1] === null ? 'M' : 'L'}${x(i).toFixed(1)},${y(g).toFixed(1)}`)).join(' ')
  const last = terms[n - 1]
  const band = n === 1 ? pw : pw / (n - 1)
  return (
    <figure className="chartbox">
      <Legend items={[{ name, color: SERIES[0] }, { name: t('ch.avg'), ref: true }]} />
      <div className="termchart">
        <svg viewBox={`0 0 ${TW} ${TH}`} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
          {[2, 2.5, 3, 3.5, 4].map((g) => (
            <g key={g}><line className="grid-l" x1={TL} x2={TW - TR} y1={y(g)} y2={y(g)} /><text className="axis-t" x={TL - 8} y={y(g) + 4} textAnchor="end">{f2(g)}</text></g>
          ))}
          {terms.map((tm, i) => <text key={tm.n} className={'axis-t' + (hover === i ? ' is-on' : '')} x={x(i)} y={TH - 8} textAnchor="middle">{tm.n}</text>)}
          {hover !== null && <line className="cross" x1={x(hover)} x2={x(hover)} y1={TT} y2={TH - TB} />}
          <path className="line-ref" d={path(cohort.slice(0, n))} />
          <path className="line-main" d={path(terms.map((tm) => tm.gpa))} pathLength={1} />
          {terms.map((tm, i) => <circle key={tm.n} className="line-dot" cx={x(i)} cy={y(tm.gpa)} r={hover === i ? 5.5 : 4} />)}
          <text className="line-end" x={x(n - 1) + 9} y={y(last.gpa) + 5}>{f2(last.gpa)}</text>
          {terms.map((tm, i) => (
            <rect key={tm.n} className="hit" x={x(i) - band / 2} y={0} width={band} height={TH} tabIndex={0} role="img"
              aria-label={`${t('ch.sem', { n: tm.n })}: ${name} ${f2(tm.gpa)}${cohort[i] != null ? `, ${t('ch.avg')} ${f2(cohort[i]!)}` : ''}, ${t('l.attendance')} ${tm.att}%`}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
          ))}
        </svg>
        {hover !== null && (
          <div className={'ctip' + (hover > n / 2 ? ' ctip-l' : ' ctip-r')} role="tooltip" style={{ left: (x(hover) / TW) * 100 + '%', top: (y(terms[hover].gpa) / TH) * 100 + '%' }}>
            <b>{t('ch.sem', { n: terms[hover].n })}</b>
            <span><i className="sw" style={{ background: SERIES[0] }} />{name}<em>{f2(terms[hover].gpa)}</em></span>
            {cohort[hover] != null && <span><i className="sw-dash" />{t('ch.avg')}<em>{f2(cohort[hover]!)}</em></span>}
            <span>{t('l.attendance')}<em>{terms[hover].att}%</em></span>
          </div>
        )}
      </div>
    </figure>
  )
}

// ───────────────────────────────────────────────────────── place in the school
const SW = 420, SH = 78, SL = 6, SR = 6, AY = 46

export function CohortStrip({ scores, mine, median, label }: { scores: number[]; mine: number; median: number; label: string }) {
  const { t } = useT()
  const [hover, setHover] = useState<number | null>(null)
  const lo = Math.min(400, Math.floor(scores[0] / 100) * 100), hi = 1000
  const x = (v: number) => SL + ((v - lo) / (hi - lo)) * (SW - SL - SR)
  const mx = x(mine), medx = x(median)
  const anchorOf = (px: number) => (px < 46 ? 'start' : px > SW - 46 ? 'end' : 'middle')
  return (
    <div className="strip">
      <svg viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        <line className="strip-axis" x1={SL} x2={SW - SR} y1={AY} y2={AY} />
        {scores.map((v, i) => v !== mine && <line key={i} className={'strip-tick' + (hover === i ? ' is-on' : '')} x1={x(v)} x2={x(v)} y1={AY - 15} y2={AY} />)}
        <line className="strip-med" x1={medx} x2={medx} y1={AY - 21} y2={AY + 6} />
        <text className="axis-t" x={medx} y={AY + 22} textAnchor={anchorOf(medx)}>{t('ch.pos.median', { n: median })}</text>
        {medx - SL > 110 && <text className="axis-t" x={SL} y={AY + 22}>{lo}</text>}
        {SW - SR - medx > 110 && <text className="axis-t" x={SW - SR} y={AY + 22} textAnchor="end">{hi}</text>}
        <line className="strip-me" x1={mx} x2={mx} y1={AY - 27} y2={AY} />
        <text className="strip-me-t" x={mx} y={AY - 33} textAnchor={anchorOf(mx)}>{mine}</text>
        {scores.map((v, i) => v !== mine && (
          <rect key={i} className="hit" x={x(v) - 5} y={AY - 22} width={10} height={28} tabIndex={0} role="img" aria-label={`${t('l.cvscore')}: ${v}`}
            onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
        ))}
      </svg>
      {hover !== null && <div className="ctip" role="tooltip" style={{ left: (x(scores[hover]) / SW) * 100 + '%', top: ((AY - 18) / SH) * 100 + '%' }}><span>{t('l.cvscore')}<em>{scores[hover]}</em></span></div>}
    </div>
  )
}

// ───────────────────────────────────────────────────────── skill levels
export function SkillLevels({ levels, wanted }: { levels: Record<string, number>; wanted?: string[] }) {
  const { t } = useT()
  const rows = Object.entries(levels).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return (
    <ul className="levels">
      {rows.map(([k, lv], i) => (
        <li key={k}>
          <span className={'tag' + (wanted?.includes(k) ? ' tag-hit' : '')}>{k}</span>
          <span className="lv" role="img" aria-label={t('ch.level', { n: lv })} style={{ '--i': i } as React.CSSProperties}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= lv ? 'on' : ''} />)}</span>
          <b>{lv}</b>
          <small>{t('lvl.' + lv)}</small>
        </li>
      ))}
    </ul>
  )
}

// ───────────────────────────────────────────────────────── salary against the role's range
export function SalaryFit({ expects, min, max }: { expects: number; min: number; max: number }) {
  const { t, dec, mlnCur } = useT()
  const range = `${dec(min / 1e6)}–${mlnCur(max)}`
  const pad = (Math.max(max, expects) - Math.min(min, expects)) * 0.2
  const lo = Math.min(min, expects) - pad, hi = Math.max(max, expects) + pad
  const p = (v: number) => ((v - lo) / (hi - lo)) * 100
  const state = expects > max ? 'above' : expects < min ? 'below' : 'in'
  const side = p(expects) < 20 ? ' is-start' : p(expects) > 80 ? ' is-end' : ''
  return (
    <div className="salfit">
      <div className="salfit-plot" role="img" aria-label={`${t('ch.sal.expects')} ${mlnCur(expects)}. ${t('ch.sal.range')}: ${range}`}>
        <span className={'salfit-me' + side} style={{ left: p(expects) + '%' }}>{t('ch.sal.expects')} <b>{mlnCur(expects)}</b></span>
        <div className="salfit-track">
          <i className="salfit-band" style={{ left: p(min) + '%', width: p(max) - p(min) + '%' }} />
          <i className="salfit-dot" style={{ left: p(expects) + '%' }} />
        </div>
        <span className="salfit-cap" style={{ left: (p(min) + p(max)) / 2 + '%' }}>{t('ch.sal.range')}: {range}</span>
      </div>
      <p className="salfit-note">
        <Pill tone={state === 'above' ? 'warn' : 'ok'} icon={state === 'above' ? 'flag' : 'check'}>
          {state === 'in' ? t('ch.sal.in') : state === 'above' ? t('ch.sal.above', { n: mlnCur(expects - max) }) : t('ch.sal.below', { n: mlnCur(min - expects) })}
        </Pill>
      </p>
    </div>
  )
}

// ───────────────────────────────────────────────────────── skills: demand and supply
export function GapChart({ rows, roles, students }: { rows: { name: string; asked: number; have: number; demand: number; supply: number }[]; roles: number; students: number }) {
  const { t } = useT()
  const on = useEntered()
  const w = (v: number) => ({ width: on ? v + '%' : 0 })
  return (
    <>
      <ul className="legend"><li><i className="sw" style={{ background: 'var(--ink)' }} />{t('gap.demand')}</li><li><i className="sw" style={{ background: SERIES[0] }} />{t('gap.supply')}</li></ul>
      <ul className="gap">
        {rows.map((r) => {
          const state = r.demand - r.supply >= 15 ? 'short' : r.supply >= r.demand ? 'ok' : 'tight'
          return (
            <li key={r.name}>
              <span className="gap-name"><b>{r.name}</b><small>{t('gap.row', { a: r.asked, b: roles, c: r.have, d: students })}</small></span>
              <span className="gap-bars" role="img" aria-label={`${r.name}: ${t('gap.demand')} ${r.demand}%, ${t('gap.supply')} ${r.supply}%`}>
                <span><i className="gap-d" style={w(r.demand)} /><em style={{ left: r.demand + '%' }}>{r.demand}%</em></span>
                <span><i className="gap-s" style={w(r.supply)} /><em style={{ left: r.supply + '%' }}>{r.supply}%</em></span>
              </span>
              <Pill tone={state === 'short' ? 'warn' : state === 'ok' ? 'ok' : 'neutral'} icon={state === 'short' ? 'flag' : state === 'ok' ? 'check' : undefined}>{t('gap.' + state)}</Pill>
            </li>
          )
        })}
      </ul>
    </>
  )
}
