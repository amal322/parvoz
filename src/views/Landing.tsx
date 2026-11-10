import React, { useMemo, useRef, useState } from 'react'
import { PLANS, ROLES, STUDENTS } from '../data/seed'
import { FEE_SALARIES, GUARANTEE_DAYS, SCHOOLS, matchScore, type School, type Student } from '../data/logic'
import { useLiveStats } from '../data/live'
import { enter } from '../data/store'
import { useT } from '../i18n'
import { Btn, Icon, LangSwitch, Odometer, Portrait, Reveal, StudentCard, Title } from '../ui/bits'

const bySchool = (s: School) => STUDENTS.filter((x) => x.school === s).sort((a, b) => b.cvScore - a.cvScore)
const eng = bySchool('eng'), bus = bySchool('bus'), med = bySchool('med'), den = bySchool('den')
const me = STUDENTS[0]
// seven cards on the hero table: [student, left %, top px, tilt deg]
const TABLE: [Student, number, number, number][] = [
  [eng.find((s) => s.id !== me.id)!, 1, 46, -7],
  [bus[0], 15, 4, 5],
  [med[0], 29, 58, -3],
  [me, 43, 0, 3],
  [den[0], 57, 52, -6],
  [bus[1], 71, 8, 6],
  [eng.filter((s) => s.id !== me.id)[1], 85, 44, -4],
]

function HeroCards() {
  const { t } = useT()
  const z = useRef(10)
  const drag = useRef<{ el: HTMLElement; x: number; y: number; ox: number; oy: number } | null>(null)
  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'touch') return // on a phone the row scrolls with the page instead
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    el.style.zIndex = String(++z.current)
    el.classList.add('is-drag')
    drag.current = { el, x: e.clientX, y: e.clientY, ox: Number(el.dataset.ox || 0), oy: Number(el.dataset.oy || 0) }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const ox = d.ox + e.clientX - d.x, oy = d.oy + e.clientY - d.y
    d.el.style.setProperty('--dx', ox + 'px')
    d.el.style.setProperty('--dy', oy + 'px')
    d.el.dataset.nx = String(ox)
    d.el.dataset.ny = String(oy)
  }
  const up = () => {
    const d = drag.current
    if (!d) return
    d.el.classList.remove('is-drag')
    const moved = Math.hypot(Number(d.el.dataset.nx ?? d.ox) - d.ox, Number(d.el.dataset.ny ?? d.oy) - d.oy) > 4
    d.el.dataset.ox = d.el.dataset.nx ?? String(d.ox)
    d.el.dataset.oy = d.el.dataset.ny ?? String(d.oy)
    d.el.dataset.moved = moved ? '1' : ''
    drag.current = null
  }
  const click = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.currentTarget.dataset.moved) return void (e.currentTarget.dataset.moved = '')
    enter('company')
  }
  return (
    <div className="table">
      {TABLE.map(([s, left, top, tilt], i) => (
        <button key={s.id} className="table-card" style={{ '--l': left + '%', '--t': top + 'px', '--r': tilt + 'deg', '--i': i } as React.CSSProperties}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click} aria-label={`${s.name}, ${t('prog.' + s.program)}`}>
          <StudentCard s={s} sticker={i === 3 ? <b>{matchScore(s, ROLES[0])}%</b> : undefined} />
          {i === 1 && <span className="tag-drag" aria-hidden="true">{t('hero.drag')}</span>}
        </button>
      ))}
    </div>
  )
}

function Marquee() {
  const { t } = useT()
  const items = ['ds', 'fin', 'gm', 'se', 'mkt', 'dn', 'me', 'ba', 'cs', 'mgmt', 'ee']
  const row = (hidden?: boolean) => (
    <div className="marquee-row" aria-hidden={hidden || undefined}>
      {items.map((p, i) => <span key={p} className={i % 2 ? 't-serif' : 't-sans'}>{t('prog.' + p)}<i aria-hidden="true">✦</i></span>)}
    </div>
  )
  return <div className="marquee">{row()}{row(true)}</div>
}

function Schools() {
  const { t } = useT()
  const groups: Record<School, Student[]> = { eng, bus, med, den }
  const live = useLiveStats()
  return (
    <section className="sec wrap" id="schools">
      <Title kicker={t('sch.kicker')} a={t('sch.a')} b={t('sch.b')} />
      {live && <p className="live"><i aria-hidden="true" />{t('live.line', { s: live.students, r: live.openRoles, c: live.companies })}</p>}
      <ul className="srows">
        {SCHOOLS.map((sc) => (
          <li key={sc}>
            <button className={'srow sch-' + sc} onClick={() => enter('company')}>
              <span className="srow-dot" aria-hidden="true" />
              <span className="srow-name">{t('school.' + sc)}</span>
              <span className="srow-count">{live ? t('sch.live', { n: live.bySchool[sc] }) : t('sch.count', { n: groups[sc].length })}</span>
              <span className="srow-peek" aria-hidden="true">
                {groups[sc].slice(0, 3).map((s, i) => <Portrait key={s.id} s={s} className={'peek peek-' + i} />)}
              </span>
              <Icon name="arrow" size={28} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function How() {
  const { t, mln } = useT()
  const ranked = useMemo(() => STUDENTS.map((s) => ({ s, m: matchScore(s, ROLES[0]) })).sort((a, b) => b.m - a.m).slice(0, 3), [])
  const minis = [
    <div className="mini mini-ok" key="1"><span className="mini-logo">N</span><div><b>Navro Systems</b><span>Team</span></div><em><Icon name="check" size={14} />{t('how.m.approved')}</em></div>,
    <div className="mini mini-rank" key="2">{ranked.map(({ s, m }) => <div key={s.id}><Portrait s={s} /><b>{s.name.split(' ')[0]}</b><i style={{ '--w': m + '%' } as React.CSSProperties} /><span>{m}%</span></div>)}</div>,
    <div className="mini mini-lock" key="3"><div><Icon name="lock" /><span>{t('how.m.locked')}</span></div><Icon name="arrow" size={22} /><div className="is-open"><Icon name="unlock" /><span>{t('how.m.open')}</span></div></div>,
    <div className="mini mini-split" key="4"><div><span>{t('how.m.day', { n: 10 })}</span><b>50%</b><em>{mln(15e6)}</em></div><div><span>{t('how.m.day', { n: GUARANTEE_DAYS })}</span><b>50%</b><em>{mln(15e6)}</em></div></div>,
  ]
  return (
    <section className="sec sec-black" id="how">
      <div className="wrap">
        <Title className="is-center" kicker={t('how.kicker')} a={t('how.a')} b={t('how.b')} />
        <ol className="stack">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className={'stack-card stack-' + n} style={{ '--i': n - 1 } as React.CSSProperties}>
              <div className="stack-text">
                <span className="stack-n t-serif">{n}</span>
                <h3>{t(`how.${n}.t`)}</h3>
                <p>{t(`how.${n}.d`)}</p>
              </div>
              <div className="stack-art">{minis[n - 1]}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Fee() {
  const { t, money, dec, lang, cur } = useT()
  const [salary, setSalary] = useState(10)
  const fee = salary * FEE_SALARIES * 1e6
  return (
    <section className="sec wrap" id="fee">
      <Title kicker={t('fee.kicker')} a={t('fee.a')} b={t('fee.b')} stack />
      <div className="fee">
        <Reveal className="fee-calc">
          <label htmlFor="calc-salary">{t('fee.salary')}</label>
          <output htmlFor="calc-salary">{money(salary * 1e6)}</output>
          <input id="calc-salary" type="range" min={4} max={25} step={0.5} value={salary} onChange={(e) => setSalary(Number(e.target.value))} style={{ '--p': ((salary - 4) / 21) * 100 + '%' } as React.CSSProperties} />
          <p className="fee-label">{t('fee.total')}</p>
          <p className="fee-big"><span className="t-serif"><Odometer value={dec(fee / 1e6)} /></span><small>{lang === 'en' ? 'M ' + cur : (lang === 'ru' ? 'млн ' : 'mln ') + cur}</small></p>
          <ol className="fee-halves">
            <li><b>{money(fee / 2)}</b><span>{t('fee.half1')}</span></li>
            <li><b>{money(fee / 2)}</b><span>{t('fee.half2')}</span></li>
          </ol>
        </Reveal>
        <ul className="fee-facts">
          {[1, 2, 3].map((n) => (
            <li key={n}><Reveal delay={n * 80}><h3>{t(`fee.f${n}.t`)}</h3><p>{t(`fee.f${n}.d`)}</p></Reveal></li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Record() {
  const { t } = useT()
  const rows: [string, string, string][] = [
    [t('l.gpa'), me.gpa.toFixed(2), t('rec.gpa')],
    [t('l.attendance'), me.attendance + '%', t('rec.att')],
    [t('l.projects'), String(me.projects.length), t('rec.proj')],
    [t('l.cvscore'), String(me.cvScore), t('rec.score')],
  ]
  return (
    <section className="sec sec-white" id="record">
      <div className="wrap rec">
        <div className="rec-card"><StudentCard s={me} className="scard-xl" sticker={<><Icon name="shield" size={15} />CAU</>} sub={t('prog.' + me.program) + ', ' + t('l.year', { n: me.year })} /></div>
        <div>
          <Title kicker={t('rec.kicker')} a={t('rec.a')} b={t('rec.b')} />
          <dl className="rec-rows">
            {rows.map(([k, v, d], i) => (
              <Reveal key={k} delay={i * 70}><dt>{k}</dt><dd className="rec-v t-serif">{v}</dd><dd className="rec-d">{d}</dd></Reveal>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

function Plans() {
  const { t, dec, lang, cur } = useT()
  const unit = (lang === 'en' ? 'M ' : lang === 'ru' ? 'млн ' : 'mln ') + cur
  const yn = (v: boolean) => (v ? <Icon name="check" /> : <span className="dash" aria-label={t('l.no')}>–</span>)
  return (
    <section className="sec sec-black" id="plans">
      <div className="wrap">
        <Title className="is-center" kicker={t('plans.kicker')} a={t('plans.a')} b={t('plans.b')} />
        <div className="plans">
          {PLANS.map((p, i) => (
            <Reveal key={p.code} delay={i * 90} className="plan">
              <h3>{p.name}</h3>
              <p className="plan-note">{t(`plan.${p.code}.note`)}</p>
              <p className="plan-price"><span className="t-serif">{dec(p.price / 1e6)}</span><small>{unit}<br />{t('l.permonth')}</small></p>
              <dl>
                <div><dt>{t('plans.seats')}</dt><dd>{p.seats ?? t('l.unlimited')}</dd></div>
                <div><dt>{t('plans.intros')}</dt><dd>{p.intros ?? t('l.unlimited')}</dd></div>
                <div><dt>{t('plans.roles')}</dt><dd>{p.roles ?? t('l.unlimited')}</dd></div>
                <div><dt>{t('plans.ats')}</dt><dd>{yn(p.code !== 'scout')}</dd></div>
                <div><dt>{t('plans.early')}</dt><dd>{yn(p.code === 'partner')}</dd></div>
              </dl>
              <Btn kind={i === 1 ? 'yellow' : 'white'} onClick={() => enter('company')}>{t('plans.choose')}</Btn>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const { t } = useT()
  const [open, setOpen] = useState<number | null>(1)
  return (
    <section className="sec wrap" id="faq">
      <Title kicker={t('faq.kicker')} a={t('faq.a')} b={t('faq.b')} />
      <ul className="faq">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <li key={n} className={open === n ? 'is-open' : ''}>
            <h3><button aria-expanded={open === n} aria-controls={'faq-' + n} onClick={() => setOpen(open === n ? null : n)}><span>{t('faq.q' + n)}</span><Icon name="plus" size={22} /></button></h3>
            <div className="faq-a" id={'faq-' + n} role="region"><div><p>{t('faq.a' + n)}</p></div></div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function Landing() {
  const { t } = useT()
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  return (
    <div className="landing">
      <header className="top">
        <span className="wordmark">Parvoz</span>
        <nav className="boxnav" aria-label="Sections">
          <button onClick={() => scrollTo('how')}>{t('nav.how')}</button>
          <button onClick={() => scrollTo('fee')}>{t('nav.fee')}</button>
          <button onClick={() => scrollTo('plans')}>{t('nav.plans')}</button>
          <button onClick={() => scrollTo('faq')}>{t('nav.faq')}</button>
        </nav>
        <div className="top-right">
          <LangSwitch />
          <button className="boxbtn" onClick={() => enter('company')}><i aria-hidden="true" />{t('nav.demo')}</button>
        </div>
      </header>

      <section className="hero">
        <div className="wrap hero-in">
          <Title as="h1" className="is-center hero-title" kicker={t('hero.kicker')} a={t('hero.a')} b={t('hero.b')} stack />
          <Reveal className="hero-sub" delay={260}>
            <p className="lede">{t('hero.lede')}</p>
            <div className="hero-cta">
              <Btn onClick={() => enter('company')}>{t('hero.cta')}</Btn>
              <button className="ulink" onClick={() => scrollTo('fee')}>{t('hero.cta2')}<Icon name="down" size={16} /></button>
            </div>
            <p className="hero-note">{t('hero.demo')}</p>
          </Reveal>
        </div>
        <HeroCards />
      </section>

      <Marquee />
      <Schools />
      <How />
      <Fee />
      <Record />
      <Plans />
      <Faq />

      <footer className="foot">
        <div className="wrap">
          <Title className="is-center" kicker={t('foot.kicker')} a={t('foot.a')} b={t('foot.b')} />
          <div className="foot-cta">
            <Btn kind="white" onClick={() => enter('company')}>{t('foot.as', { role: t('role.company') })}</Btn>
            <Btn kind="yellow" onClick={() => enter('student')}>{t('foot.as', { role: t('role.student') })}</Btn>
            <Btn kind="ink" onClick={() => enter('office')}>{t('foot.as', { role: t('role.office') })}</Btn>
          </div>
          <div className="foot-base">
            <span className="wordmark-big" aria-hidden="true">Parvoz</span>
            <p>{t('foot.note')}<br />{t('foot.portraits')}</p>
            <LangSwitch />
          </div>
        </div>
      </footer>
    </div>
  )
}
