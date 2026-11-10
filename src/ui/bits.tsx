import React, { useEffect, useRef, useState } from 'react'
import type { Student } from '../data/logic'
import { PORTRAITS } from '../data/portraits'
import { setLang, useStore } from '../data/store'
import { LANGS, useT } from '../i18n'

export const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// ── icons: one stroke weight, drawn on a 20px grid ────────────────────────
const PATHS: Record<string, string> = {
  arrow: 'M4 10h12M11 5l5 5-5 5',
  down: 'M10 4v12M5 11l5 5 5-5',
  plus: 'M10 4v12M4 10h12',
  check: 'M4 10.5l4 4 8-9',
  close: 'M5 5l10 10M15 5L5 15',
  lock: 'M5 9h10v8H5zM7 9V6a3 3 0 016 0v3',
  unlock: 'M5 9h10v8H5zM7 9V6a3 3 0 015.6-1.5',
  shield: 'M10 3l6 2v5c0 4-2.6 6-6 7-3.4-1-6-3-6-7V5z',
  search: 'M9 15A6 6 0 109 3a6 6 0 000 12zM13.5 13.5L17 17',
  clock: 'M10 17a7 7 0 100-14 7 7 0 000 14zM10 6v4l3 2',
  flag: 'M5 17V4M5 4h10l-2 3.5L15 11H5',
  star: 'M10 3l2.1 4.6 5 .6-3.7 3.4 1 4.9L10 14l-4.4 2.5 1-4.9L2.9 8.200l5-.6z',
  eye: 'M2 10s3-5.500 8-5.500S18 10 18 10s-3 5.500-8 5.500S2 10 2 10zM10 12.500a2.500 2.500 0 100-5 2.500 2.500 0 000 5z',
  talent: 'M3 5h14M3 10h14M3 15h9',
  pipeline: 'M3 4h4v12H3zM8 4h4v8H8zM13 4h4v5h-4z',
  roles: 'M4 7h12v9H4zM7 7V4h6v3',
  billing: 'M3 5h14v10H3zM3 9h14M6 13h3',
  inbox: 'M3 11l2-7h10l2 7v5H3zM3 11h4l1 2h4l1-2h4',
  jobs: 'M4 7h12v9H4zM7 7V4h6v3M4 11h12',
  me: 'M10 10a3.500 3.500 0 100-7 3.500 3.500 0 000 7zM3.500 17c.8-3 3.400-4.500 6.500-4.500s5.700 1.500 6.500 4.500',
  overview: 'M3 17V9M8 17V4M13 17v-6M18 17V7',
  outcomes: 'M3 16l5-5 3 3 6-8M13 6h4v4',
  placements: 'M4 10l4 4 8-9',
  companies: 'M4 17V5l6-2v14M10 8l6 2v7M3 17h14',
}
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

// ── portraits ─────────────────────────────────────────────────────────────
const uriCache = new Map<string, string>()
function portraitUri(s: Pick<Student, 'female' | 'portrait'>) {
  const k = (s.female ? 'f' : 'm') + s.portrait
  let u = uriCache.get(k)
  if (!u) uriCache.set(k, (u = 'data:image/svg+xml;utf8,' + encodeURIComponent(PORTRAITS[s.female ? 'f' : 'm'][s.portrait])))
  return u
}
/** Illustrated placeholder on the school colour. Real photos come from the Digital CV. */
export function Portrait({ s, className = '' }: { s: Student; className?: string }) {
  return (
    <span className={`portrait sch-${s.school} ${className}`}>
      <img src={portraitUri(s)} alt="" loading="lazy" draggable={false} />
    </span>
  )
}

/** The signature object: a print-like card with the portrait, name and program. */
export function StudentCard({ s, sticker, sub, className = '', style }: { s: Student; sticker?: React.ReactNode; sub?: string; className?: string; style?: React.CSSProperties }) {
  const { t } = useT()
  return (
    <span className={'scard ' + className} style={style}>
      <Portrait s={s} />
      {sticker && <span className="sticker">{sticker}</span>}
      <span className="scard-name">{s.name}</span>
      <span className="scard-sub">{sub ?? t('prog.' + s.program)}</span>
    </span>
  )
}

// ── headings: bold grotesque + serif, lines slide up out of a mask ────────
export function useReveal<E extends HTMLElement>() {
  const ref = useRef<E>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduceMotion() || !('IntersectionObserver' in window)) return el.classList.add('in')
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (el.classList.add('in'), io.disconnect())), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}
export function Title({ a, b, kicker, as: Tag = 'h2', stack, className = '' }: { a: string; b?: string; kicker?: string; as?: 'h1' | 'h2'; stack?: boolean; className?: string }) {
  const ref = useReveal<HTMLDivElement>()
  return (
    <div className={'title reveal ' + className} ref={ref}>
      {kicker && <p className="kicker"><span className="ln"><span className="ln-i">{kicker}</span></span></p>}
      <Tag className={stack ? 'is-stack' : ''}>
        <span className="ln"><span className="ln-i t-sans">{a}</span></span>{b && ' '}
        {b && <span className="ln"><span className="ln-i t-serif">{b}</span></span>}
      </Tag>
    </div>
  )
}
export function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>()
  return <div ref={ref} className={'fade reveal ' + className} style={delay ? ({ '--d': delay + 'ms' } as React.CSSProperties) : undefined}>{children}</div>
}

/** Digits roll to their new value. */
export function Odometer({ value }: { value: string }) {
  const chars = value.split('')
  return (
    <span className="odo" role="img" aria-label={value}>
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <span className="odo-col" key={chars.length - i} aria-hidden="true">
            <span className="odo-roll" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>{'0123456789'.split('').map((d) => <i key={d}>{d}</i>)}</span>
          </span>
        ) : (
          <span className="odo-ch" key={'c' + (chars.length - i)} aria-hidden="true">{ch}</span>
        ),
      )}
    </span>
  )
}

// ── controls ──────────────────────────────────────────────────────────────
export function Btn({ children, onClick, kind = 'blue', busy, disabled, icon = 'arrow', small, type = 'button', label }: {
  children: React.ReactNode; onClick?: () => void; kind?: 'blue' | 'ink' | 'white' | 'yellow' | 'line'; busy?: boolean; disabled?: boolean; icon?: string | null; small?: boolean; type?: 'button' | 'submit'; label?: string
}) {
  return (
    <button type={type} className={`btn btn-${kind}${small ? ' btn-s' : ''}${busy ? ' is-busy' : ''}`} onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined} aria-label={label}>
      {icon && <span className="btn-ar">{busy ? <span className="spinner" aria-hidden="true" /> : <Icon name={icon} size={small ? 14 : 16} />}</span>}
      <span className="btn-t">{children}</span>
    </button>
  )
}

export function Pill({ tone = 'neutral', children, icon }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'blue' | 'ink'; children: React.ReactNode; icon?: string }) {
  return <span className={'pill pill-' + tone}>{icon && <Icon name={icon} size={13} />}{children}</span>
}

/** Bar that fills from zero when it first appears. */
export function Meter({ value, max = 1, tone = 'blue', label }: { value: number; max?: number; tone?: 'blue' | 'ok' | 'ink'; label?: string }) {
  const [w, setW] = useState(reduceMotion() ? value / max : 0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.min(1, value / max)))
    return () => cancelAnimationFrame(id)
  }, [value, max])
  return <span className={'meter meter-' + tone} role="img" aria-label={label ?? `${Math.round((value / max) * 100)}%`}><i style={{ transform: `scaleX(${w})` }} /></span>
}

export function LangSwitch({ className = '' }: { className?: string }) {
  const lang = useStore((s) => s.lang)
  const { t } = useT()
  return (
    <div className={'lang ' + className} role="radiogroup" aria-label={t('l.language')}>
      {LANGS.map((l) => (
        <button key={l.id} role="radio" aria-checked={l.id === lang} aria-label={l.name} lang={l.id} onClick={() => l.id !== lang && setLang(l.id)}>{l.label}</button>
      ))}
    </div>
  )
}

/** Side sheet on desktop, bottom sheet on a phone. Closes on Escape and on the backdrop. */
export function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useT()
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); prev?.focus?.() }
  }, [onClose])
  return (
    <div className="sheet-wrap">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={'sheet' + (wide ? ' sheet-wide' : '')} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <button className="sheet-close" onClick={onClose} aria-label={t('l.close')}><Icon name="close" /></button>
        {children}
      </div>
    </div>
  )
}

/** Shows placeholder cards for a moment, the way the screen looks while Supabase answers. */
export function useLoading(ms = 650) {
  const [loading, setLoading] = useState(!reduceMotion())
  useEffect(() => {
    const id = setTimeout(() => setLoading(false), ms)
    return () => clearTimeout(id)
  }, [ms])
  return loading
}
export function SkeletonCards({ n = 8 }: { n?: number }) {
  const { t } = useT()
  return (
    <div className="tgrid" aria-label={t('l.loading')} role="status">
      {Array.from({ length: n }, (_, i) => (
        <div className="sk-card" key={i} style={{ animationDelay: i * 60 + 'ms' }}><i className="sk sk-img" /><i className="sk sk-a" /><i className="sk sk-b" /></div>
      ))}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{children && <p>{children}</p>}</div>
}
