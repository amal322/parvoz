import React, { useEffect, useState } from 'react'
import { COMPANY, ME_STUDENT } from './data/seed'
import { ROUTES, enter, go, studentOf, syncFromHash, useStore, type Viewer } from './data/store'
import { useT } from './i18n'
import { Icon, LangSwitch, Portrait, reduceMotion } from './ui/bits'
import { Landing } from './views/Landing'
import { Billing, Pipeline, ProfileSheet, Roles, Talent } from './views/company'
import { Inbox, Jobs, MyProfile } from './views/student'
import { Companies, Outcomes, Overview, Placements } from './views/office'

const VIEWS: Record<string, () => React.JSX.Element> = {
  talent: Talent, pipeline: Pipeline, roles: Roles, billing: Billing,
  inbox: Inbox, jobs: Jobs, 'my-profile': MyProfile,
  overview: Overview, outcomes: Outcomes, placements: Placements, companies: Companies,
}
const NAV_KEY: Record<string, string> = { 'my-profile': 'me' }
const VIEWERS: Viewer[] = ['company', 'student', 'office']

function useBadges(): Record<string, number> {
  return {
    pipeline: useStore((s) => s.cards.filter((c) => c.stage !== 'hired').length),
    inbox: useStore((s) =>
      s.external.filter((e) => e.status === 'requested' || e.slots).length +
      (s.cards.some((c) => c.studentId === ME_STUDENT && (c.intro === 'requested' || c.slots)) ? 1 : 0) +
      (s.placements.some((p) => p.studentId === ME_STUDENT && p.status === 'awaiting') ? 1 : 0)),
    companies: useStore((s) => s.companies.filter((c) => c.status === 'pending').length),
    placements: useStore((s) => s.placements.filter((p) => p.status === 'awaiting' || p.status === 'disputed').length),
  }
}

function Shell({ viewer, route }: { viewer: Viewer; route: string }) {
  const { t } = useT()
  const badges = useBadges()
  const me = useStore((s) => studentOf(s, ME_STUDENT))
  const View = VIEWS[route]
  return (
    <div className="app">
      <header className="appbar">
        <button className="wordmark" onClick={() => go('')} aria-label={t('app.exit')}>Parvoz</button>
        <nav className="boxnav" aria-label={t('role.' + viewer)}>
          {ROUTES[viewer].map((r) => {
            const key = NAV_KEY[r] ?? r
            return (
              <button key={r} className={r === route ? 'is-on' : ''} aria-current={r === route ? 'page' : undefined} onClick={() => go(r)}>
                <Icon name={key} />{t('n.' + key)}{badges[r] > 0 && <span className="badge">{badges[r]}</span>}
              </button>
            )
          })}
        </nav>
        <div className="bar-right">
          <div className="viewer" role="radiogroup" aria-label={t('app.viewas')}>
            {VIEWERS.map((v) => <button key={v} role="radio" aria-checked={v === viewer} onClick={() => v !== viewer && enter(v)}>{t('role.' + v)}</button>)}
          </div>
          <LangSwitch />
        </div>
      </header>
      <main className="content" key={route}>
        <div className="subbar">
          <div className="who">
            {viewer === 'student' ? <Portrait s={me} /> : <span className="logo" aria-hidden="true">{viewer === 'company' ? 'N' : 'C'}</span>}
            <span>
              {viewer === 'company' ? COMPANY.user : viewer === 'student' ? me.name : t('role.office')}
              <small>{viewer === 'company' ? COMPANY.name : viewer === 'student' ? t('prog.' + me.program) : 'Central Asian University'}</small>
            </span>
          </div>
          <span className="demo-tag">{t('l.demo')}</span>
        </div>
        <View />
      </main>
      {viewer === 'company' && <ProfileSheet />}
    </div>
  )
}

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const { t, date, dateTime, money } = useT()
  const fmt = (vars?: Record<string, string | number>) => {
    if (!vars) return vars
    const out = { ...vars }
    if (typeof out.d === 'string') out.d = /T\d\d:/.test(out.d) ? dateTime(out.d) : /^\d{4}-\d\d-\d\d$/.test(out.d) ? date(out.d) : out.d
    if (typeof out.sum === 'number') out.sum = money(out.sum)
    return out
  }
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((x) => <div className="toast" key={x.id}><Icon name={x.tone === 'warn' ? 'flag' : x.tone === 'info' ? 'clock' : 'check'} size={16} /><span>{t(x.key, fmt(x.vars))}</span></div>)}
    </div>
  )
}

/** Opening curtain: the counter runs to 100, the curtain lifts and the hero lines rise out of their masks. */
function Preloader({ onDone }: { onDone: () => void }) {
  const { t } = useT()
  const [n, setN] = useState(0)
  const [out, setOut] = useState(false)
  useEffect(() => {
    const t0 = performance.now(), dur = 1100
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      setN(Math.round((1 - Math.pow(1 - p, 3)) * 100))
      if (p < 1) raf = requestAnimationFrame(tick)
      else { setOut(true); setTimeout(onDone, 250) }
    }
    raf = requestAnimationFrame(tick)
    // if the tab is in the background rAF may never run: finish anyway
    const safety = setTimeout(() => { setOut(true); onDone() }, 2600)
    return () => { cancelAnimationFrame(raf); clearTimeout(safety) }
  }, [onDone])
  return (
    <div className={'pre' + (out ? ' is-out' : '')} aria-hidden="true">
      <span className="wordmark">Parvoz</span>
      <span className="pre-l">{t('hero.kicker')}</span>
      <span className="pre-n">{n}</span>
      <i className="pre-bar" style={{ transform: `scaleX(${n / 100})` }} />
    </div>
  )
}

const wantsIntro = () => !reduceMotion() && !location.hash.replace('#', '')

export function App() {
  const viewer = useStore((s) => s.viewer)
  const route = useStore((s) => s.route)
  const lang = useStore((s) => s.lang)
  const [boot, setBoot] = useState(wantsIntro)
  useEffect(() => {
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const done = React.useCallback(() => {
    document.documentElement.classList.remove('booting')
    setTimeout(() => setBoot(false), 900)
  }, [])
  return (
    <>
      {boot && <Preloader onDone={done} />}
      {viewer && <i className="progress" key={route} />}
      {viewer ? <Shell viewer={viewer} route={route} /> : <Landing />}
      <Toasts />
    </>
  )
}
