import { SCORE_MAX, insightOf } from '../data/insight'
import React, { useMemo, useState } from 'react'
import { COMPANY, JOBS, ME_STUDENT } from '../data/seed'
import { EMPLOYMENTS, matchScore, type Employment, type Role } from '../data/logic'
import {
  cardOf, confirmHire, pickExternalSlot, pickSlot, respondExternal, respondIntro, savePrefs, setVisible, studentOf, toggleInterest, useStore,
} from '../data/store'
import { useT } from '../i18n'
import { Btn, Empty, Icon, Meter, Pill, Title } from '../ui/bits'
import { ProfileBody } from './company'

function Request({ company, industry, role, range, message, status, stage, slots, interviewAt, onAnswer, onPick }: {
  company: string; industry: string; role: string; range: string; message?: string; status: string; stage?: string
  slots?: string[]; interviewAt?: string; onAnswer: (accept: boolean) => void; onPick: (slot: string) => void
}) {
  const { t, dateTime } = useT()
  return (
    <li className="request" style={{ viewTransitionName: 'req-' + company.replace(/\W/g, '') } as React.CSSProperties}>
      <span className="logo" aria-hidden="true">{company[0]}</span>
      <div className="request-main">
        <h3>{company}<small>{industry}</small></h3>
        <p className="request-role">{role} · {range}</p>
        {message && <p className="request-msg t-serif">{message}</p>}
        {status === 'accepted' && slots && (
          <div className="iv-pick">
            <p>{t('req.pick')}</p>
            <div className="slots">{slots.map((x) => <button key={x} className="slot" onClick={() => onPick(x)}>{dateTime(x)}</button>)}</div>
          </div>
        )}
        {interviewAt && <p className="iv-set"><Icon name="clock" />{t('pro.interview.at', { d: dateTime(interviewAt) })}</p>}
      </div>
      <div className="request-act">
        {status === 'requested' ? (
          <><Btn small icon="check" onClick={() => onAnswer(true)}>{t('req.accept')}</Btn><button className="ulink" onClick={() => onAnswer(false)}>{t('req.decline')}</button></>
        ) : status === 'accepted' ? (
          <Pill tone="ok" icon="unlock">{stage ?? t('req.shared')}</Pill>
        ) : (
          <Pill>{t('pipe.declined')}</Pill>
        )}
      </div>
    </li>
  )
}

export function Inbox() {
  const { t, date, mln, mlnCur, role: roleName } = useT()
  const me = useStore((s) => studentOf(s, ME_STUDENT))
  const visible = useStore((s) => s.visible)
  const external = useStore((s) => s.external)
  const card = useStore((s) => cardOf(s, ME_STUDENT))
  const role = useStore((s) => s.roles.find((r) => r.id === card?.roleId))
  const placement = useStore((s) => s.placements.find((p) => p.studentId === ME_STUDENT))
  const placedRole = useStore((s) => s.roles.find((r) => r.id === placement?.roleId))
  const hasNavro = card && card.intro !== 'none'
  const pending = external.filter((e) => e.status === 'requested').length + (card?.intro === 'requested' ? 1 : 0)
  const range = (r: Role) => `${mln(r.salaryMin)} – ${mlnCur(r.salaryMax)}`
  return (
    <>
      <div className="page-head"><Title as="h1" a={t('inbox.a')} b={me.name.split(' ')[0]} /><p>{t('inbox.sub', { n: pending })}</p></div>

      <section className={'panel visibility' + (visible ? ' is-on' : '')}>
        <div>
          <h2>{t(visible ? 'vis.on.t' : 'vis.off.t')}</h2>
          <p>{t(visible ? 'vis.on.d' : 'vis.off.d')}</p>
        </div>
        <button id="visible-switch" role="switch" aria-checked={visible} className={'switch' + (visible ? ' is-on' : '')} onClick={() => setVisible(!visible)}><span className="sr">{t('vis.switch')}</span><i /></button>
      </section>

      {placement?.status === 'awaiting' && (
        <section className="panel confirm">
          <Icon name="flag" size={22} />
          <div>
            <h2>{t('conf.t', { company: placement.company })}</h2>
            <p>{t('conf.d', { role: roleName(placedRole), salary: mlnCur(placement.salary), d: date(placement.start) })}</p>
            <div className="row"><Btn icon="check" onClick={() => confirmHire(placement.id, true)}>{t('conf.yes')}</Btn><button className="ulink" onClick={() => confirmHire(placement.id, false)}>{t('conf.no')}</button></div>
          </div>
        </section>
      )}
      {placement?.status === 'active' && (
        <section className="panel confirm is-done"><Icon name="check" size={22} /><div><h2>{t('conf.done.t', { company: placement.company, d: date(placement.start) })}</h2><p>{t('conf.done.d', { role: roleName(placedRole) })}</p></div></section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>{t('req.title')}</h2></div>
        {!hasNavro && external.length === 0 ? <Empty title={t('req.empty.t')}>{t('req.empty.d')}</Empty> : (
          <ul className="requests">
            {hasNavro && role && (
              <Request company={COMPANY.name} industry={t('ind.' + COMPANY.industry)} role={roleName(role)} range={range(role)} status={card.intro} stage={t('st.' + card.stage)}
                slots={card.slots} interviewAt={card.interviewAt} onAnswer={(a) => respondIntro(ME_STUDENT, a)} onPick={(x) => pickSlot(ME_STUDENT, x)} />
            )}
            {external.map((e) => {
              const job = JOBS.find((j) => j.id === e.jobId)!
              return (
                <Request key={e.id} company={job.company!} industry={t('ind.' + job.industry)} role={roleName(job)} range={range(job)} message={t(e.msgKey)} status={e.status}
                  slots={e.slots} interviewAt={e.interviewAt} onAnswer={(a) => respondExternal(e.id, a)} onPick={(x) => pickExternalSlot(e.id, x)} />
              )
            })}
          </ul>
        )}
        {!hasNavro && <p className="hint">{t('req.hint')}</p>}
      </section>
    </>
  )
}

export function Jobs() {
  const { t, mln, mlnCur, role: roleName } = useT()
  const me = useStore((s) => studentOf(s, ME_STUDENT))
  const roles = useStore((s) => s.roles)
  const interest = useStore((s) => s.interest)
  const jobs = useMemo(
    () => [...roles.map((r) => ({ ...r, company: COMPANY.name, industry: COMPANY.industry })), ...JOBS].map((r) => ({ r, m: matchScore(me, r) })).sort((a, b) => b.m - a.m),
    [roles, me],
  )
  return (
    <>
      <div className="page-head"><Title as="h1" a={t('jobs.a')} b={t('jobs.b')} /><p>{t('jobs.sub')}</p></div>
      <ul className="jobs">
        {jobs.map(({ r, m }) => {
          const on = interest.some((i) => i.studentId === ME_STUDENT && i.roleId === r.id)
          const missing = r.skills.filter((k) => !me.skills.includes(k))
          return (
            <li key={r.id} className={on ? 'is-on' : ''}>
              <span className="logo" aria-hidden="true">{r.company![0]}</span>
              <div className="jobs-main">
                <h2>{roleName(r)}</h2>
                <p>{r.company} · {t('ind.' + r.industry)} · {t('emp.' + r.employment)} · {mln(r.salaryMin)} – {mlnCur(r.salaryMax)}</p>
                <div className="tags">{r.skills.map((k) => <span key={k} className={'tag' + (me.skills.includes(k) ? ' tag-hit' : '')}>{k}</span>)}</div>
                <p className="jobs-tip">{missing.length ? t('jobs.missing', { skills: missing.join(', ') }) : t('jobs.fit')}</p>
              </div>
              <div className="jobs-match"><b className="t-serif">{m}%</b><Meter value={m} max={100} label={`${t('l.match')} ${m}%`} /><span>{t('l.match')}</span></div>
              <Btn small kind={on ? 'ink' : 'blue'} icon={on ? 'check' : 'star'} onClick={() => toggleInterest(r.id)}>{t(on ? 'jobs.interested' : 'jobs.interest')}</Btn>
            </li>
          )
        })}
      </ul>
    </>
  )
}

const VIEWS = [1, 3, 2, 4]

export function MyProfile() {
  const { t } = useT()
  const me = useStore((s) => studentOf(s, ME_STUDENT))
  const [salary, setSalary] = useState(me.salary / 1e6)
  const [openTo, setOpenTo] = useState<Employment[]>(me.openTo)
  const sc = insightOf(me).score
  const SCORE: [string, number, number][] = [['me.score.acad', sc.acad, SCORE_MAX.acad], ['l.projects', sc.proj, SCORE_MAX.proj], ['me.score.act', sc.act, SCORE_MAX.act]]
  const dirty = salary !== me.salary / 1e6 || openTo.join() !== me.openTo.join()
  return (
    <>
      <div className="page-head"><Title as="h1" a={t('me.a')} b={t('me.b')} /><p>{t('me.sub')}</p></div>
      <div className="me">
        <section className="panel panel-profile"><ProfileBody s={me} asStudent /></section>
        <div className="me-side">
          <section className="panel">
            <div className="panel-head"><h2>{t('me.views.t')}</h2><Icon name="eye" /></div>
            <p className="me-big t-serif">{VIEWS.reduce((a, b) => a + b, 0)}</p>
            <p className="me-note">{t('me.views.d', { n: VIEWS.reduce((a, b) => a + b, 0) })}</p>
            <ul className="weeks">{VIEWS.map((v, i) => <li key={i}><i style={{ height: v * 22 + '%' }} /><span>{t('me.views.week', { n: i + 1 })}</span><b>{v}</b></li>)}</ul>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>{t('me.score.t')}</h2><b className="t-serif me-score">{me.cvScore}</b></div>
            <ul className="parts">
              {SCORE.map(([k, v, max]) => <li key={k}><span>{t(k)}<small>{t('l.of', { n: max })}</small></span><Meter value={v} max={max} label={`${t(k)}: ${v}`} /><b>{v}</b></li>)}
            </ul>
            <p className="me-tip"><Icon name="star" size={15} />{t('me.score.tip', { n: 42 })}</p>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>{t('me.prefs.t')}</h2></div>
            <form className="form" onSubmit={(e) => { e.preventDefault(); if (openTo.length && salary >= 1) savePrefs(salary * 1e6, openTo) }}>
              <label className="field"><span>{t('me.prefs.salary')}</span><input id="pref-salary" type="number" min={1} max={60} step={0.5} value={salary} onChange={(e) => setSalary(Number(e.target.value))} /></label>
              <fieldset className="field"><legend>{t('me.prefs.opento')}</legend>
                <div className="chips">{EMPLOYMENTS.map((o) => <button type="button" key={o} role="checkbox" aria-checked={openTo.includes(o)} className={'chip' + (openTo.includes(o) ? ' is-on' : '')} onClick={() => setOpenTo(openTo.includes(o) ? openTo.filter((x) => x !== o) : EMPLOYMENTS.filter((x) => x === o || openTo.includes(x)))}>{t('emp.' + o)}</button>)}</div>
              </fieldset>
              <Btn type="submit" small icon="check" disabled={!dirty || !openTo.length || salary < 1}>{t('me.prefs.save')}</Btn>
            </form>
          </section>
        </div>
      </div>
    </>
  )
}
