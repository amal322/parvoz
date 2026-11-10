import { cohortRadar, cohortScores, cohortTerms, insightOf, radarOf, standouts } from '../data/insight'
import { CohortStrip, Radar, SalaryFit, SkillLevels, TermChart } from '../ui/charts'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { COMPANY, ME_STUDENT, PLANS, TODAY } from '../data/seed'
import {
  EMPLOYMENTS, FEE_SALARIES, GUARANTEE_DAYS, MATCH_WEIGHTS, SCHOOLS, addDays, daysBetween, feePlan, matchParts, matchScore, upcomingSlots,
  type Employment, type MatchParts, type Role, type School, type Student,
} from '../data/logic'
import {
  STAGES, addRole, cardOf, changePlan, clearCompare, closeRole, go, moveCard, openProfile, payInvoice, planOf, proposeSlots, reportDeparture,
  reportHire, requestIntro, saveNote, setRankRole, shortlist, studentOf, toggleCompare, useStore, type Card, type Stage,
} from '../data/store'
import { useT } from '../i18n'
import { Btn, Empty, Icon, Meter, Pill, Portrait, Sheet, SkeletonCards, StudentCard, Title, useLoading } from '../ui/bits'

// ───────────────────────────────────────────────────────── Talent
export function Talent() {
  const { t, role: roleName } = useT()
  const loading = useLoading()
  const students = useStore((s) => s.students)
  const roles = useStore((s) => s.roles)
  const rankRoleId = useStore((s) => s.rankRoleId)
  const cards = useStore((s) => s.cards)
  const interest = useStore((s) => s.interest)
  const compare = useStore((s) => s.compare)
  const role = roles.find((r) => r.id === rankRoleId) ?? roles[0]
  const [q, setQ] = useState('')
  const [school, setSchool] = useState<School | 'all'>('all')
  const [openTo, setOpenTo] = useState<Employment | 'any'>('any')
  const [minGpa, setMinGpa] = useState(2.7)
  const [sort, setSort] = useState<'match' | 'gpa' | 'score'>('match')
  const [cmpOpen, setCmpOpen] = useState(false)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return students
      .filter((s) => school === 'all' || s.school === school)
      .filter((s) => openTo === 'any' || s.openTo.includes(openTo))
      .filter((s) => s.gpa >= minGpa)
      .filter((s) => !needle || [s.name, t('prog.' + s.program), ...s.skills].some((x) => x.toLowerCase().includes(needle)))
      .map((s) => ({ s, score: matchScore(s, role) }))
      .sort((a, b) => (sort === 'gpa' ? b.s.gpa - a.s.gpa : sort === 'score' ? b.s.cvScore - a.s.cvScore : b.score - a.score) || a.s.rank - b.s.rank)
  }, [students, q, school, openTo, minGpa, sort, role, t])

  return (
    <>
      <div className="page-head">
        <Title as="h1" a={t('tal.a')} b={t('tal.b')} />
        <p>{t('tal.sub', { n: students.length })}</p>
      </div>
      <div className="toolbar">
        <label className="field field-grow">
          <span>{t('tal.rankfor')}</span>
          <select id="rank-role" value={role.id} onChange={(e) => setRankRole(e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.id}>{roleName(r)}</option>)}
          </select>
        </label>
        <label className="field field-grow field-search">
          <span>{t('tal.search')}</span>
          <Icon name="search" size={16} />
          <input id="talent-search" type="search" placeholder={t('tal.search.ph')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('tal.opento')}</span>
          <select id="open-to" value={openTo} onChange={(e) => setOpenTo(e.target.value as Employment | 'any')}>
            <option value="any">{t('l.any')}</option>
            {EMPLOYMENTS.map((o) => <option key={o} value={o}>{t('emp.' + o)}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('tal.sort')}</span>
          <select id="talent-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="match">{t('tal.sort.match')}</option><option value="gpa">{t('tal.sort.gpa')}</option><option value="score">{t('tal.sort.score')}</option>
          </select>
        </label>
        <label className="field field-range">
          <span>{t('tal.mingpa', { n: minGpa.toFixed(1) })}</span>
          <input id="min-gpa" type="range" min={2.7} max={3.9} step={0.1} value={minGpa} onChange={(e) => setMinGpa(Number(e.target.value))} style={{ '--p': ((minGpa - 2.7) / 1.2) * 100 + '%' } as React.CSSProperties} />
        </label>
      </div>
      <div className="chips" role="radiogroup" aria-label={t('part.school')}>
        {(['all', ...SCHOOLS] as const).map((s) => (
          <button key={s} role="radio" aria-checked={school === s} className={'chip' + (school === s ? ' is-on' : '') + (s !== 'all' ? ' sch-' + s : '')} onClick={() => setSchool(s)}>
            {s !== 'all' && <i aria-hidden="true" />}{s === 'all' ? t('tal.allschools') : t('school.' + s)}
          </button>
        ))}
      </div>

      {loading ? <SkeletonCards /> : rows.length === 0 ? (
        <Empty title={t('tal.empty.t')}>{t('tal.empty.d')}</Empty>
      ) : (
        <ul className="tgrid">
          {rows.map(({ s, score }) => {
            const card = cards.find((c) => c.studentId === s.id)
            const keen = interest.some((i) => i.studentId === s.id && i.roleId === role.id)
            const picked = compare.includes(s.id)
            return (
              <li key={s.id} className={'tcard' + (picked ? ' is-picked' : '')}>
                <button className="tcard-main" onClick={() => openProfile(s.id)} aria-label={t('tal.open', { name: s.name })}>
                  <Portrait s={s} />
                  <span className="sticker"><b>{score}%</b></span>
                  {keen && <span className="keen"><Icon name="star" size={13} />{t('tal.interested')}</span>}
                  <span className="tcard-name">{s.name}</span>
                  <span className="tcard-sub">{t('prog.' + s.program)}, {t('l.year', { n: s.year })}</span>
                  <span className="tags">{s.skills.slice(0, 3).map((k) => <span key={k} className={'tag' + (role.skills.includes(k) ? ' tag-hit' : '')}>{k}</span>)}</span>
                  <span className="tcard-stats"><span><b>{s.gpa.toFixed(2)}</b> GPA</span><span><b>{s.attendance}%</b> {t('l.attendance').toLowerCase()}</span></span>
                </button>
                <div className="tcard-act">
                  {card ? <Pill tone={card.stage === 'hired' ? 'ok' : 'blue'}>{t('st.' + card.stage)}</Pill> : <Btn kind="line" small icon="plus" onClick={() => shortlist(s.id)}>{t('tal.shortlist')}</Btn>}
                  <button className={'cmp-toggle' + (picked ? ' is-on' : '')} role="checkbox" aria-checked={picked} aria-label={`${t('tal.compare.pick')}: ${s.name}`} onClick={() => toggleCompare(s.id)}><Icon name={picked ? 'check' : 'plus'} size={14} /></button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {compare.length > 0 && (
        <div className="cmp-bar" role="region" aria-label={t('tal.compare')}>
          <div className="cmp-faces">{compare.map((id) => <Portrait key={id} s={students.find((x) => x.id === id)!} />)}</div>
          <Btn kind="white" small onClick={() => setCmpOpen(true)} disabled={compare.length < 2}>{t('tal.compare.n', { n: compare.length })}</Btn>
          <button className="ulink ulink-inv" onClick={clearCompare}>{t('tal.compare.clear')}</button>
        </div>
      )}
      {cmpOpen && <CompareSheet ids={compare} role={role} onClose={() => setCmpOpen(false)} />}
    </>
  )
}

function CompareSheet({ ids, role, onClose }: { ids: string[]; role: Role; onClose: () => void }) {
  const { t, date, mlnCur, role: roleName } = useT()
  const students = useStore((s) => s.students).filter((x) => ids.includes(x.id))
  const best = (f: (s: Student) => number) => Math.max(...students.map(f))
  const row = (label: string, f: (s: Student) => React.ReactNode, num?: (s: Student) => number) => (
    <tr><th scope="row">{label}</th>{students.map((s) => <td key={s.id} className={num && num(s) === best(num) ? 'is-best' : ''}>{f(s)}</td>)}</tr>
  )
  return (
    <Sheet title={t('cmp.title')} onClose={onClose} wide>
      <h2 className="sheet-h">{t('cmp.title')}</h2>
      <p className="sheet-sub">{t('pro.matchfor', { role: roleName(role) })}</p>
      <section className="cmp-radar">
        <h3>{t('cmp.radar')}</h3>
        <Radar label={t('cmp.radar')} series={students.map((s) => ({ name: s.name, values: radarOf(s) }))} />
      </section>
      <div className="table-scroll">
        <table className="cmp">
          <thead><tr><td />{students.map((s) => <th scope="col" key={s.id}><StudentCard s={s} className="scard-s" /></th>)}</tr></thead>
          <tbody>
            {row(t('l.match'), (s) => <b>{matchScore(s, role)}%</b>, (s) => matchScore(s, role))}
            {row(t('cmp.program'), (s) => t('prog.' + s.program))}
            {row(t('l.gpa'), (s) => s.gpa.toFixed(2), (s) => s.gpa)}
            {row(t('l.attendance'), (s) => s.attendance + '%', (s) => s.attendance)}
            {row(t('l.cvscore'), (s) => s.cvScore, (s) => s.cvScore)}
            {row(t('l.skills'), (s) => <span className="tags">{s.skills.map((k) => <span key={k} className={'tag' + (role.skills.includes(k) ? ' tag-hit' : '')}>{k}</span>)}</span>)}
            {row(t('cmp.english'), (s) => s.english)}
            {row(t('cmp.salary'), (s) => mlnCur(s.salary))}
            {row(t('cmp.from'), (s) => date(s.availableFrom))}
          </tbody>
        </table>
      </div>
    </Sheet>
  )
}

// ───────────────────────────────────────────────────────── Profile sheet
const PART_KEY: Record<keyof MatchParts, string> = { skills: 'part.skills', school: 'part.school', record: 'l.cvscore', gpa: 'l.gpa', availability: 'part.availability' }

function InterviewBlock({ s, card }: { s: Student; card: Card }) {
  const { t, dateTime } = useT()
  const [picking, setPicking] = useState(false)
  const [chosen, setChosen] = useState<string[]>([])
  const first = s.name.split(' ')[0]
  const options = useMemo(() => upcomingSlots(TODAY), [])
  if (card.interviewAt) return <p className="iv-set"><Icon name="clock" />{t('pro.interview.at', { d: dateTime(card.interviewAt) })}</p>
  if (card.slots) return <p className="iv-wait"><span className="spinner" aria-hidden="true" />{t('pro.slots.sent', { name: first })}</p>
  if (!picking) return <Btn kind="line" small icon="clock" onClick={() => setPicking(true)}>{t('pro.propose')}</Btn>
  const toggle = (x: string) => setChosen(chosen.includes(x) ? chosen.filter((y) => y !== x) : chosen.length < 3 ? [...chosen, x] : chosen)
  return (
    <div className="iv-pick">
      <p>{t('pro.propose.hint', { name: first })}</p>
      <div className="slots">{options.map((x) => <button key={x} role="checkbox" aria-checked={chosen.includes(x)} className={'slot' + (chosen.includes(x) ? ' is-on' : '')} onClick={() => toggle(x)}>{dateTime(x)}</button>)}</div>
      <div className="row"><Btn small disabled={!chosen.length} onClick={() => { proposeSlots(s.id, [...chosen].sort()); setPicking(false) }}>{t('pro.propose.send')}</Btn><button className="ulink" onClick={() => setPicking(false)}>{t('l.cancel')}</button></div>
    </div>
  )
}

export function ProfileBody({ s, role, card, asStudent }: { s: Student; role?: Role; card?: Card; asStudent?: boolean }) {
  const { t, date, mlnCur, role: roleName, lang } = useT()
  const dec2 = (n: number) => (lang === 'en' ? n.toFixed(2) : n.toFixed(2).replace('.', ','))
  const [busy, setBusy] = useState(false)
  const savedNote = useStore((st) => st.notes[s.id] ?? '')
  const [note, setNote] = useState(savedNote)
  useEffect(() => setNote(savedNote), [savedNote, s.id])
  const all = useStore((st) => st.students)
  const total = all.length
  const first = s.name.split(' ')[0]
  const insight = insightOf(s)
  const mine = radarOf(s)
  const school = useMemo(() => cohortRadar(all, s.school), [all, s.school])
  const schoolTerms = useMemo(() => cohortTerms(all, s.school), [all, s.school])
  const pos = cohortScores(all, s)
  const out = standouts(mine, school)
  const schoolName = t('school.' + s.school)
  const trend = Math.round((insight.terms[insight.terms.length - 1].gpa - insight.terms[0].gpa) * 100) / 100
  const axisList = (xs: { axis: string; d: number }[]) => xs.map((x) => `${t('ax.' + x.axis)} (${x.d > 0 ? '+' : '−'}${Math.abs(x.d)})`).join(', ')
  const [fn, ln] = s.name.toLowerCase().split(' ')
  const parts = role && matchParts(s, role)
  const unlocked = asStudent || card?.intro === 'accepted'
  const ask = async () => { setBusy(true); await requestIntro(s.id); setBusy(false) }
  return (
    <div className="profile">
      <header className="profile-head">
        <StudentCard s={s} className="scard-l" sticker={role ? <b>{matchScore(s, role)}%</b> : undefined} sub={t('school.' + s.school)} />
        <div>
          <h2>{s.name}</h2>
          <p className="t-serif profile-line">{t('hl.' + s.program)}</p>
          <p>{t('prog.' + s.program)}, {t('l.year', { n: s.year })}. {t('l.grad', { y: s.gradYear })}.</p>
          <div className="tags">{s.langs.map((l) => <span className="tag" key={l}>{t('lang.' + l)}</span>)}<span className="tag">{s.english}</span></div>
        </div>
      </header>

      <dl className="stats">
        <div><dt>{t('l.gpa')}</dt><dd className="t-serif">{s.gpa.toFixed(2)}</dd><small>{t('l.of', { n: '4.00' })}</small></div>
        <div><dt>{t('l.attendance')}</dt><dd className="t-serif">{s.attendance}%</dd></div>
        <div><dt>{t('l.cvscore')}</dt><dd className="t-serif">{s.cvScore}</dd><small>{t('l.of', { n: 1000 })}</small></div>
        <div><dt>{t('l.rank')}</dt><dd className="t-serif">{s.rank}</dd><small>{t('l.of', { n: total })}</small></div>
      </dl>
      <p className="verified"><Icon name="shield" size={15} />{t('pro.verified', { d: date('2026-10-28') })}</p>

      <section>
        <h3>{t('ch.radar.t')}</h3>
        <p className="sec-note">{t('ch.radar.d', { school: schoolName })}</p>
        <Radar label={t('ch.radar.aria', { name: s.name })} series={[{ name: asStudent ? t('ch.you') : first, values: mine }, { name: t('ch.avg'), values: school, ref: true }]} />
        <ul className="takeaways">
          {out.strong.length > 0 && <li><Icon name="star" size={15} />{t(asStudent ? 'ch.radar.strong.me' : 'ch.radar.strong', { list: axisList(out.strong) })}</li>}
          {out.weak.length > 0 && <li className="is-weak"><Icon name="flag" size={15} />{t(asStudent ? 'ch.radar.weak.me' : 'ch.radar.weak', { list: axisList(out.weak) })}</li>}
          {!out.weak.length && <li><Icon name="check" size={15} />{t('ch.radar.allabove')}</li>}
        </ul>
      </section>

      {parts && role && (
        <section>
          <h3>{t('pro.matchfor', { role: roleName(role) })}</h3>
          <ul className="parts">
            {(Object.keys(parts) as (keyof MatchParts)[]).map((k) => (
              <li key={k}>
                <span>{t(PART_KEY[k])}<small>{t('pro.weight', { n: Math.round(MATCH_WEIGHTS[k] * 100) })}</small></span>
                <Meter value={parts[k]} label={`${t(PART_KEY[k])} ${Math.round(parts[k] * 100)}%`} />
                <b>{Math.round(parts[k] * 100)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>{t('ch.gpa.t')}</h3>
        <p className="sec-note">{trend >= 0.05 ? t('ch.trend.up', { n: dec2(trend) }) : trend <= -0.05 ? t('ch.trend.down', { n: dec2(-trend) }) : t('ch.trend.flat')}</p>
        <TermChart name={asStudent ? t('ch.you') : first} terms={insight.terms} cohort={schoolTerms} label={t('ch.gpa.t') + ': ' + s.name} />
      </section>

      <section>
        <h3>{t('ch.pos.t')}</h3>
        <p className="sec-note">{t('ch.pos.line', { r: pos.place, n: pos.size, school: schoolName })}</p>
        <CohortStrip scores={pos.scores} mine={s.cvScore} median={pos.median} label={t('ch.pos.aria', { n: s.cvScore, m: pos.median })} />
      </section>

      <section>
        <h3>{t('l.skills')}</h3>
        <SkillLevels levels={insight.levels} wanted={role?.skills} />
        <p className="sec-note sec-note-b">{t('ch.skills.note')}</p>
      </section>

      <section>
        <h3>{t('l.projects')}</h3>
        <ul className="projects">
          {s.projects.map((p) => <li key={p.n}><b>{t(`pj.${s.program}.${p.n}.t`)}</b><p>{t(`pj.${s.program}.${p.n}.d`)}</p><small><Icon name="check" size={13} />{t('pro.gradedby', { name: p.gradedBy })}</small></li>)}
        </ul>
      </section>

      <section>
        <h3>{t('pro.availability')}</h3>
        <p>{t('pro.avail', { types: s.openTo.map((o) => t('emp.' + o)).join(', '), d: date(s.availableFrom), s: mlnCur(s.salary) })}</p>
        {role && !asStudent && <SalaryFit expects={s.salary} min={role.salaryMin} max={role.salaryMax} />}
      </section>

      <section className={'contacts' + (unlocked ? ' is-open' : '')}>
        <h3><Icon name={unlocked ? 'unlock' : 'lock'} size={15} />{t('pro.contacts')}</h3>
        {unlocked ? (
          <dl><div><dt>Email</dt><dd>{fn[0]}.{ln}@students.example</dd></div><div><dt>Telegram</dt><dd>@{fn}_{ln.slice(0, 3)}</dd></div></dl>
        ) : (
          <p>{t(card?.intro === 'requested' ? 'pro.waiting' : card?.intro === 'declined' ? 'pro.declined' : 'pro.locked', { name: first })}</p>
        )}
      </section>

      {!asStudent && card?.intro === 'accepted' && card.stage !== 'hired' && (
        <section><h3>{t('pro.interview')}</h3><InterviewBlock s={s} card={card} /></section>
      )}

      {!asStudent && (
        <section className="note">
          <h3><label htmlFor={'note-' + s.id}>{t('pro.note')}</label></h3>
          <textarea id={'note-' + s.id} rows={2} placeholder={t('pro.note.ph')} value={note} onChange={(e) => setNote(e.target.value)} />
          {note !== savedNote && <Btn kind="line" small icon="check" onClick={() => saveNote(s.id, note)}>{t('pro.note.save')}</Btn>}
        </section>
      )}

      {!asStudent && (
        <footer className="profile-foot">
          {!card || card.intro === 'none' ? (
            <>
              <Btn busy={busy} onClick={ask}>{t('pro.request')}</Btn>
              {!card && <Btn kind="line" icon="plus" onClick={() => shortlist(s.id)}>{t('tal.shortlist')}</Btn>}
              <small>{t('pro.request.note', { name: first })}</small>
            </>
          ) : (
            <>
              <Pill tone={card.intro === 'accepted' ? 'ok' : card.intro === 'declined' ? 'warn' : 'blue'}>{card.intro === 'accepted' ? t('st.' + card.stage) : card.intro === 'declined' ? t('pro.introdeclined') : t('pro.introsent')}</Pill>
              <Btn kind="line" onClick={() => go('pipeline')}>{t('pro.openpipeline')}</Btn>
              {s.id === ME_STUDENT && card.intro === 'requested' && <small>{t('pro.demo.student')}</small>}
            </>
          )}
        </footer>
      )}
    </div>
  )
}

export function ProfileSheet() {
  const id = useStore((s) => s.profileId)
  const s = useStore((st) => (id ? studentOf(st, id) : undefined))
  const card = useStore((st) => (id ? cardOf(st, id) : undefined))
  const role = useStore((st) => st.roles.find((r) => r.id === (card?.roleId ?? st.rankRoleId)))
  if (!id || !s) return null
  return <Sheet title={s.name} onClose={() => openProfile(null)}><ProfileBody s={s} role={role} card={card} /></Sheet>
}

// ───────────────────────────────────────────────────────── Pipeline
function HireSheet({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { t, date, money, mlnCur, role: roleName } = useT()
  const s = useStore((st) => studentOf(st, studentId))
  const role = useStore((st) => st.roles.find((r) => r.id === cardOf(st, studentId)?.roleId))
  const [salary, setSalary] = useState(role ? Math.round(((role.salaryMin + role.salaryMax) / 2e6) * 2) / 2 : 10)
  const [start, setStart] = useState(addDays(TODAY, 21))
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const first = s.name.split(' ')[0]
  const valid = salary >= 1 && start >= TODAY
  const fp = feePlan(Math.max(0, salary) * 1e6, start)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setTimeout(() => { reportHire(studentId, salary * 1e6, start); setBusy(false); setDone(true) }, 1100)
  }
  return (
    <Sheet title={t('hire.title')} onClose={onClose}>
      {done ? (
        <div className="hired">
          <div className="hired-card"><StudentCard s={s} className="scard-l" sticker={<b>{t('st.hired')}</b>} sub={COMPANY.name} /></div>
          <h2>{t('hire.done.t', { name: s.name, company: COMPANY.name })}</h2>
          <p>{t('hire.done.d', { name: first, sum: money(fp.firstHalf), d: date(fp.firstDue) })}</p>
          <div className="row"><Btn onClick={() => { onClose(); go('billing') }}>{t('hire.tobilling')}</Btn><Btn kind="line" onClick={onClose}>{t('hire.back')}</Btn></div>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <h2 className="sheet-h">{t('hire.title')}</h2>
          <p className="sheet-sub">{s.name}, {roleName(role)}</p>
          <div className="form-row">
            <label className="field"><span>{t('hire.salary')}</span><input id="hire-salary" type="number" min={1} max={100} step={0.5} value={salary} onChange={(e) => setSalary(Number(e.target.value))} required /></label>
            <label className="field"><span>{t('hire.start')}</span><input id="hire-start" type="date" min={TODAY} value={start} onChange={(e) => setStart(e.target.value)} required /></label>
          </div>
          {!valid && <p className="form-error">{t('hire.error')}</p>}
          <div className="fee-box" aria-live="polite">
            <div className="fee-total"><span>{t('hire.fee', { s: mlnCur(salary * 1e6) })}</span><b className="t-serif">{money(fp.fee)}</b></div>
            <ol className="fee-plan">
              <li><b>{money(fp.firstHalf)}</b><span>{t('hire.h1', { d: date(fp.firstDue) })}</span></li>
              <li><b>{money(fp.secondHalf)}</b><span>{t('hire.h2', { d: date(fp.secondDue), name: first })}</span></li>
            </ol>
            <p><Icon name="shield" size={15} />{t('hire.guar', { d: date(fp.guaranteeUntil), name: first })}</p>
          </div>
          <div className="row"><Btn type="submit" busy={busy} disabled={!valid}>{t('hire.title')}</Btn><button type="button" className="ulink" onClick={onClose}>{t('l.cancel')}</button></div>
        </form>
      )}
    </Sheet>
  )
}

export function Pipeline() {
  const { t, dateTime, role: roleName } = useT()
  const cards = useStore((s) => s.cards)
  const roles = useStore((s) => s.roles)
  const students = useStore((s) => s.students)
  const [hire, setHire] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; over: Stage | null } | null>(null)
  const start = useRef<{ x: number; y: number; el: HTMLElement; moved: boolean } | null>(null)

  const move = (id: string, stage: Stage) => { if (moveCard(id, stage) === 'needs-hire-form') setHire(id) }
  const stageAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-stage]') as HTMLElement | null)?.dataset.stage as Stage | undefined

  const down = (e: React.PointerEvent, id: string) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as HTMLElement).closest('select')) return
    start.current = { x: e.clientX, y: e.clientY, el: e.currentTarget as HTMLElement, moved: false }
    setDrag({ id, over: null })
  }
  const moveP = (e: React.PointerEvent) => {
    const st = start.current
    if (!st || !drag) return
    const dx = e.clientX - st.x, dy = e.clientY - st.y
    if (!st.moved && Math.hypot(dx, dy) < 5) return
    if (!st.moved) st.el.setPointerCapture(e.pointerId) // capture only once it is a drag, so a plain click still reaches the card
    st.moved = true
    st.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-5, Math.min(5, dx / 30))}deg)`
    st.el.style.pointerEvents = 'none'
    const over = stageAt(e.clientX, e.clientY) ?? null
    if (over !== drag.over) setDrag({ id: drag.id, over })
  }
  const up = (e: React.PointerEvent, id: string) => {
    const st = start.current
    if (!st) return
    start.current = null
    const target = st.moved ? stageAt(e.clientX, e.clientY) : undefined
    st.el.style.transform = ''
    st.el.style.pointerEvents = ''
    setDrag(null)
    if (st.moved && target) move(id, target)
  }

  return (
    <>
      <div className="page-head"><Title as="h1" a={t('pipe.a')} b={t('pipe.b')} /><p>{t('pipe.sub')}</p></div>
      <div className="kanban">
        {STAGES.map((st) => {
          const list = cards.filter((c) => c.stage === st)
          return (
            <section key={st} className={'col' + (drag?.over === st ? ' is-over' : '')} data-stage={st} aria-label={t('st.' + st)}>
              <h2>{t('st.' + st)}<span>{list.length}</span></h2>
              {list.length === 0 && <p className="col-empty">{t(st === 'hired' ? 'pipe.empty.hired' : 'pipe.empty')}</p>}
              {list.map((c) => {
                const s = students.find((x) => x.id === c.studentId)!
                const role = roles.find((r) => r.id === c.roleId)
                return (
                  <article key={c.studentId} className={'kcard' + (drag?.id === c.studentId ? ' is-drag' : '')} style={{ viewTransitionName: 'card-' + c.studentId } as React.CSSProperties}
                    onPointerDown={(e) => down(e, c.studentId)} onPointerMove={moveP} onPointerUp={(e) => up(e, c.studentId)} onPointerCancel={(e) => up(e, c.studentId)}>
                    <div className="kcard-top">
                      <Portrait s={s} />
                      <button className="kcard-name" onClick={() => openProfile(s.id)}><b>{s.name}</b><span>{role ? roleName(role) : t('prog.' + s.program)}</span></button>
                      {role && <span className="kcard-score">{matchScore(s, role)}%</span>}
                    </div>
                    <div className="kcard-meta">
                      {c.intro === 'requested' && <Pill tone="blue" icon="clock">{t('pipe.waiting')}</Pill>}
                      {c.intro === 'declined' && <Pill tone="warn">{t('pipe.declined')}</Pill>}
                      {c.intro === 'accepted' && c.stage !== 'hired' && !c.interviewAt && <Pill tone="ok" icon="unlock">{t('pipe.contacts')}</Pill>}
                      {c.interviewAt && c.stage !== 'hired' && <Pill tone="ink" icon="clock">{dateTime(c.interviewAt)}</Pill>}
                      {c.stage === 'hired' && <Pill tone="ok" icon="check">{t('pipe.reported')}</Pill>}
                    </div>
                    {c.stage !== 'hired' && (
                      <label className="kcard-move">
                        <span className="sr">{t('pipe.move.label', { name: s.name })}</span>
                        <select id={'move-' + c.studentId} value={c.stage} onChange={(e) => move(c.studentId, e.target.value as Stage)}>
                          {STAGES.map((o) => <option key={o} value={o}>{t(o === c.stage ? 'pipe.in' : 'pipe.moveto', { stage: t('st.' + o) })}</option>)}
                        </select>
                      </label>
                    )}
                  </article>
                )
              })}
            </section>
          )
        })}
      </div>
      {hire && <HireSheet studentId={hire} onClose={() => setHire(null)} />}
    </>
  )
}

// ───────────────────────────────────────────────────────── Roles
export function Roles() {
  const { t, mln, role: roleName } = useT()
  const roles = useStore((s) => s.roles)
  const students = useStore((s) => s.students)
  const interest = useStore((s) => s.interest)
  const plan = useStore(planOf)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [schools, setSchools] = useState<School[]>(['eng'])
  const [skills, setSkills] = useState('')
  const [employment, setEmployment] = useState<Employment>('full')
  const [min, setMin] = useState(8)
  const [max, setMax] = useState(12)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const list = skills.split(',').map((x) => x.trim()).filter(Boolean)
    if (!title.trim() || !list.length || !schools.length || max < min) return
    if (addRole({ title: title.trim(), schools, skills: list, employment, salaryMin: min * 1e6, salaryMax: max * 1e6 })) { setOpen(false); setTitle(''); setSkills(''); go('talent') }
  }
  const allSkills = useMemo(() => [...new Set(students.flatMap((s) => s.skills))].sort(), [students])
  return (
    <>
      <div className="page-head">
        <Title as="h1" a={t('roles.a')} b={t('roles.b')} />
        <p>{t('roles.sub', { plan: plan.name, n: roles.length, max: plan.roles ?? t('l.unlimited') })}</p>
        <Btn icon="plus" onClick={() => setOpen(true)}>{t('roles.new')}</Btn>
      </div>
      <ul className="roles">
        {roles.map((r) => {
          const strong = students.filter((s) => matchScore(s, r) >= 70)
          const keen = interest.filter((i) => i.roleId === r.id).length
          return (
            <li key={r.id} style={{ viewTransitionName: 'role-' + r.id } as React.CSSProperties}>
              <div className="roles-main">
                <h2>{roleName(r)}</h2>
                <p>{t('emp.' + r.employment)}. {t('roles.range', { a: mln(r.salaryMin), b: mln(r.salaryMax) })}. {r.schools.map((s) => t('school.' + s)).join(', ')}.</p>
                <div className="tags">{r.skills.map((k) => <span className="tag tag-hit" key={k}>{k}</span>)}</div>
              </div>
              <div className="roles-faces" aria-hidden="true">{strong.slice(0, 4).map((s) => <Portrait key={s.id} s={s} />)}</div>
              <dl className="roles-nums">
                <div><dd className="t-serif">{strong.length}</dd><dt>{t('roles.strong')}</dt></div>
                <div><dd className="t-serif">{keen}</dd><dt>{t('roles.interested')}</dt></div>
              </dl>
              <div className="roles-act"><Btn small onClick={() => { setRankRole(r.id); go('talent') }}>{t('roles.rank')}</Btn><button className="ulink" onClick={() => closeRole(r.id)}>{t('roles.close')}</button></div>
            </li>
          )
        })}
      </ul>
      {open && (
        <Sheet title={t('roles.new')} onClose={() => setOpen(false)}>
          <form className="form" onSubmit={submit}>
            <h2 className="sheet-h">{t('roles.new')}</h2>
            <label className="field"><span>{t('roles.f.title')}</span><input id="role-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('roles.f.title.ph')} required /></label>
            <fieldset className="field"><legend>{t('roles.f.schools')}</legend>
              <div className="chips">{SCHOOLS.map((s) => <button type="button" key={s} role="checkbox" aria-checked={schools.includes(s)} className={'chip sch-' + s + (schools.includes(s) ? ' is-on' : '')} onClick={() => setSchools(schools.includes(s) ? schools.filter((x) => x !== s) : [...schools, s])}><i aria-hidden="true" />{t('school.' + s)}</button>)}</div>
            </fieldset>
            <label className="field"><span>{t('roles.f.skills')}</span><input id="role-skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, SQL, Git" list="skill-list" required /><datalist id="skill-list">{allSkills.map((k) => <option key={k} value={k} />)}</datalist></label>
            <div className="form-row">
              <label className="field"><span>{t('roles.f.type')}</span><select id="role-type" value={employment} onChange={(e) => setEmployment(e.target.value as Employment)}>{EMPLOYMENTS.map((o) => <option key={o} value={o}>{t('emp.' + o)}</option>)}</select></label>
              <label className="field"><span>{t('roles.f.from')}</span><input id="role-min" type="number" min={1} step={0.5} value={min} onChange={(e) => setMin(Number(e.target.value))} /></label>
              <label className="field"><span>{t('roles.f.to')}</span><input id="role-max" type="number" min={1} step={0.5} value={max} onChange={(e) => setMax(Number(e.target.value))} /></label>
            </div>
            {max < min && <p className="form-error">{t('roles.f.error')}</p>}
            <div className="row"><Btn type="submit">{t('roles.new')}</Btn><button type="button" className="ulink" onClick={() => setOpen(false)}>{t('l.cancel')}</button></div>
          </form>
        </Sheet>
      )}
    </>
  )
}

// ───────────────────────────────────────────────────────── Billing
const INV_TONE = { paid: 'ok', due: 'warn', scheduled: 'neutral', void: 'neutral' } as const

export function Billing() {
  const { t, date, money, mlnCur, month, lang, role: roleName } = useT()
  const plan = useStore(planOf)
  const used = useStore((s) => s.introsUsed)
  const roles = useStore((s) => s.roles)
  const students = useStore((s) => s.students)
  const placements = useStore((s) => s.placements)
  const invoices = useStore((s) => s.invoices)
  const sorted = [...invoices].sort((a, b) => b.due.localeCompare(a.due))
  const name = (id: string) => students.find((x) => x.id === id)!
  const xofy = (a: number, b: number | null) => (b === null ? `${a}, ${t('l.unlimited').toLowerCase()}` : t('bill.xofy', { a, b }))
  return (
    <>
      <div className="page-head"><Title as="h1" a={t('bill.a')} b={t('bill.b')} /><p>{t('bill.sub')}</p></div>

      <section className="panel">
        <div className="panel-head"><h2>{t('bill.plan', { plan: plan.name })}</h2><b className="price t-serif">{mlnCur(plan.price)}<small> {t('l.permonth')}</small></b></div>
        <div className="usage">
          <div><span>{t('bill.intros')}</span><b>{xofy(used, plan.intros)}</b><Meter value={plan.intros ? used : 0} max={plan.intros ?? 1} /></div>
          <div><span>{t('plans.roles')}</span><b>{xofy(roles.length, plan.roles)}</b><Meter value={plan.roles ? roles.length : 0} max={plan.roles ?? 1} /></div>
          <div><span>{t('bill.renew')}</span><b>{date('2026-12-05')}</b></div>
        </div>
        <div className="plan-switch" role="radiogroup" aria-label={t('co.c.plan')}>
          {PLANS.map((p) => (
            <button key={p.code} role="radio" aria-checked={p.code === plan.code} className={'plan-opt' + (p.code === plan.code ? ' is-on' : '')} onClick={() => p.code !== plan.code && changePlan(p.code)}>
              <b>{p.name}</b><span>{mlnCur(p.price)}</span><small>{t(`plan.${p.code}.note`)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>{t('bill.hires')}</h2></div>
        {placements.length === 0 ? <Empty title={t('bill.nohires.t')}>{t('bill.nohires.d')}</Empty> : (
          <ul className="placements">
            {placements.map((p) => {
              const s = name(p.studentId)
              const day = Math.max(0, Math.min(GUARANTEE_DAYS, daysBetween(p.start, TODAY)))
              const future = p.start > TODAY
              return (
                <li key={p.id} style={{ viewTransitionName: 'pl-' + p.id } as React.CSSProperties}>
                  <Portrait s={s} />
                  <div className="pl-who"><b>{s.name}</b><span>{roleName(roles.find((r) => r.id === p.roleId))} · {mlnCur(p.salary)} {t('l.permonth')}</span></div>
                  <div className="pl-guar">
                    {p.status === 'awaiting' && <Pill tone="blue" icon="clock">{t('bill.await', { name: s.name.split(' ')[0] })}</Pill>}
                    {p.status === 'disputed' && <Pill tone="bad" icon="flag">{t('bill.disputed')}</Pill>}
                    {p.status === 'left' && <Pill>{t('bill.left')}</Pill>}
                    {p.status === 'active' && (<>
                      <span>{future ? t('bill.starts', { d: date(p.start) }) : t('bill.gday', { a: day, b: GUARANTEE_DAYS })}</span>
                      <Meter value={future ? 0 : day} max={GUARANTEE_DAYS} tone="ok" label={t('bill.gday', { a: day, b: GUARANTEE_DAYS })} />
                    </>)}
                  </div>
                  <div className="pl-fee"><b>{money(p.salary * FEE_SALARIES)}</b><span>{t('bill.fee')}</span></div>
                  {p.status === 'active' && <Btn small kind="line" icon={null} onClick={() => reportDeparture(p.id)}>{t('bill.depart')}</Btn>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2>{t('bill.invoices')}</h2></div>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>{t('bill.c.invoice')}</th><th>{t('bill.c.due')}</th><th className="num">{t('bill.c.amount')}</th><th>{t('bill.c.status')}</th><th><span className="sr">{t('bill.markpaid')}</span></th></tr></thead>
            <tbody>
              {sorted.map((i) => (
                <tr key={i.id} className={i.status === 'void' ? 'is-void' : ''}>
                  <td>{i.kind === 'sub' ? t('inv.sub', { plan: 'Team', month: lang === 'en' ? month(i.month!) : month(i.month!).toLowerCase() }) : t('inv.' + i.kind)}{i.placementId && <small>{name(placements.find((p) => p.id === i.placementId)!.studentId).name}</small>}</td>
                  <td>{date(i.due)}</td>
                  <td className="num">{money(i.amount)}</td>
                  <td><Pill tone={INV_TONE[i.status]}>{t('inv.' + i.status)}</Pill></td>
                  <td>{i.status === 'due' && <Btn small kind="line" icon="check" onClick={() => payInvoice(i.id)}>{t('bill.markpaid')}</Btn>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
