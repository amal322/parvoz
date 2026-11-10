import React, { useState } from 'react'
import { COMPANY, FUNNEL, JOBS, OUTCOMES, PLANS, REVENUE, TODAY } from '../data/seed'
import { skillGap } from '../data/insight'
import { GapChart } from '../ui/charts'
import { FEE_SALARIES, GUARANTEE_DAYS, daysBetween, type Student } from '../data/logic'
import { reviewCompany, toast, useStore } from '../data/store'
import { useT } from '../i18n'
import { Btn, Empty, Icon, Meter, Pill, Portrait, Title } from '../ui/bits'

const feesYtd = REVENUE.reduce((a, r) => a + r.fee, 0)
const subsYtd = REVENUE.reduce((a, r) => a + r.sub, 0)

function RevenueChart() {
  const { t, monthShort, month, mln, cur } = useT()
  const [table, setTable] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const max = 500
  const ticks = [0, 100, 200, 300, 400, 500]
  const m = (n: number) => mln(n * 1e6)
  return (
    <section className="panel">
      <div className="panel-head">
        <div><h2>{t('rev.t')}</h2><p>{t('rev.d')}</p></div>
        <Btn small kind="line" icon={null} onClick={() => setTable(!table)}>{t(table ? 'rev.chart' : 'rev.table')}</Btn>
      </div>
      <ul className="legend"><li><i className="sw sw-a" />{t('rev.sub')}</li><li><i className="sw sw-b" />{t('rev.fee')}</li></ul>
      {table ? (
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>{t('rev.month')}</th><th className="num">{t('rev.sub')}</th><th className="num">{t('rev.fee')}</th><th className="num">{t('rev.total')}</th></tr></thead>
            <tbody>{REVENUE.map((r) => <tr key={r.m}><td>{month(r.m)}</td><td className="num">{m(r.sub)}</td><td className="num">{m(r.fee)}</td><td className="num">{m(r.sub + r.fee)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="chart" role="img" aria-label={t('rev.aria')}>
          <div className="chart-y" aria-hidden="true">{ticks.map((x) => <span key={x} style={{ bottom: (x / max) * 100 + '%' }}>{x}</span>)}</div>
          <div className="chart-plot">
            {ticks.map((x) => <i key={x} className="grid" style={{ bottom: (x / max) * 100 + '%' }} />)}
            {REVENUE.map((r, i) => (
              <button key={r.m} className={'bar' + (hover === i ? ' is-on' : '')} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${month(r.m)}: ${t('rev.sub')} ${m(r.sub)}, ${t('rev.fee')} ${m(r.fee)}`}>
                <span className="bar-stack">
                  {r.fee > 0 && <i className="seg seg-b" style={{ height: (r.fee / max) * 100 + '%' }} />}
                  <i className="seg seg-a" style={{ height: (r.sub / max) * 100 + '%' }} />
                </span>
                <span className="bar-x">{monthShort(r.m) === 'мая' ? 'май' : monthShort(r.m)}</span>
                {hover === i && (
                  <span className={'tip' + (i > 8 ? ' tip-left' : '')} role="tooltip">
                    <b>{month(r.m)}: {m(r.sub + r.fee)} {cur}</b>
                    <span><i className="sw sw-a" />{t('rev.sub')} {m(r.sub)}</span>
                    <span><i className="sw sw-b" />{t('rev.fee')} {m(r.fee)}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function Overview() {
  const { t, mlnCur, dec, cur } = useT()
  const pending = useStore((s) => s.companies.filter((c) => c.status === 'pending').length)
  const top = Math.max(...FUNNEL)
  return (
    <>
      <div className="page-head"><Title as="h1" a={t('ov.a')} b={t('ov.b')} /><p>{t('ov.sub')}</p></div>
      <dl className="kpis">
        <div><dt>{t('kpi.companies')}</dt><dd className="t-serif">41</dd><small>{t('kpi.pending', { n: pending })}</small></div>
        <div><dt>{t('kpi.subs')}</dt><dd className="t-serif">{t('l.bn', { n: dec(Math.round(subsYtd / 10) / 100) })}<small> {cur}</small></dd><small>{t('kpi.subs.d', { n: mlnCur(171e6) })}</small></div>
        <div><dt>{t('kpi.fees')}</dt><dd className="t-serif">{t('l.bn', { n: dec(Math.round(feesYtd / 10) / 100) })}<small> {cur}</small></dd><small>{t('kpi.fees.d')}</small></div>
        <div><dt>{t('kpi.hires')}</dt><dd className="t-serif">214</dd><small>{t('kpi.hires.d', { s: mlnCur(9.5e6) })}</small></div>
      </dl>
      <RevenueChart />
      <section className="panel">
        <div className="panel-head"><div><h2>{t('fun.t')}</h2><p>{t('fun.d')}</p></div></div>
        <ul className="funnel">
          {FUNNEL.map((n, i) => (
            <li key={i}>
              <span>{t('fun.' + i)}</span>
              <Meter value={n} max={top} tone="ink" label={`${t('fun.' + i)}: ${n}`} />
              <b>{n.toLocaleString('en-US').replace(',', ' ')}</b>
              <small>{i > 1 ? t('fun.prev', { n: Math.round((n / FUNNEL[i - 1]) * 100) }) : ''}</small>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

export function Outcomes() {
  const { t, mlnCur } = useT()
  const companies = useStore((s) => s.companies)
  const tot = OUTCOMES.reduce((a, o) => ({ grads: a.grads + o.grads, employed: a.employed + o.employed, via: a.via + o.via }), { grads: 0, employed: 0, via: 0 })
  const pct = (a: number, b: number) => Math.round((a / b) * 100)
  const top = [...companies.filter((c) => c.status === 'approved')].sort((a, b) => b.hires - a.hires)
  const students = useStore((s) => s.students)
  const ownRoles = useStore((s) => s.roles)
  const openRoles = [...ownRoles, ...JOBS]
  const gap = skillGap(students, openRoles)
  return (
    <>
      <div className="page-head"><Title as="h1" a={t('out.a')} b={t('out.b')} /><p>{t('out.sub')}</p></div>
      <section className="panel">
        <div className="panel-head"><h2>{t('out.t')}</h2></div>
        <div className="table-scroll">
          <table className="table out">
            <thead><tr><th>{t('part.school')}</th><th className="num">{t('out.c.grads')}</th><th>{t('out.c.employed')}</th><th className="num">{t('out.c.via')}</th><th className="num">{t('out.c.salary')}</th></tr></thead>
            <tbody>
              {OUTCOMES.map((o) => (
                <tr key={o.school}>
                  <td><span className={'dot sch-' + o.school} />{t('school.' + o.school)}</td>
                  <td className="num">{o.grads}</td>
                  <td><span className="out-bar"><Meter value={o.employed} max={o.grads} tone="ink" label={`${pct(o.employed, o.grads)}%`} /><b>{pct(o.employed, o.grads)}%</b></span></td>
                  <td className="num">{o.via}</td>
                  <td className="num">{mlnCur(o.salary)}</td>
                </tr>
              ))}
              <tr className="is-total"><td>{t('rev.total')}</td><td className="num">{tot.grads}</td><td><span className="out-bar"><Meter value={tot.employed} max={tot.grads} label={`${pct(tot.employed, tot.grads)}%`} /><b>{pct(tot.employed, tot.grads)}%</b></span></td><td className="num">{tot.via}</td><td /></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>{t('gap.t')}</h2><p>{t('gap.d')}</p></div></div>
        <GapChart rows={gap} roles={openRoles.length} students={students.length} />
      </section>
      <section className="panel">
        <div className="panel-head"><h2>{t('out.top.t')}</h2></div>
        <ul className="tops">
          {top.map((c) => <li key={c.id}><span className="logo" aria-hidden="true">{c.name[0]}</span><b>{c.name}</b><span>{t('ind.' + c.industry)}</span><Meter value={c.hires} max={top[0].hires} tone="ink" label={t('out.top.hires', { n: c.hires })} /><em>{t('out.top.hires', { n: c.hires })}</em></li>)}
        </ul>
      </section>
    </>
  )
}

export function Placements() {
  const { t, date, money } = useT()
  const students = useStore((s) => s.students)
  const mine = useStore((s) => s.placements)
  const invoices = useStore((s) => s.invoices)
  const pickStudent = (school: string, n: number) => students.filter((s) => s.school === school)[n]
  const [cases, setCases] = useState(['k1', 'k2'])
  const ledger: { id: string; company: string; student: Student; salary: number; start: string; paid: number; status: string }[] = [
    ...mine.map((p) => ({ id: p.id, company: p.company, student: students.find((x) => x.id === p.studentId)!, salary: p.salary, start: p.start, status: p.status as string, paid: invoices.filter((i) => i.placementId === p.id && i.status === 'paid').length })),
    { id: 'x1', company: 'Oqsaroy Clinics', student: pickStudent('med', 0), salary: 7.5e6, start: '2026-07-01', paid: 2, status: 'active' },
    { id: 'x2', company: 'Sirdaryo Capital', student: pickStudent('bus', 1), salary: 11e6, start: '2026-09-01', paid: 1, status: 'active' },
    { id: 'x3', company: 'Oqsaroy Clinics', student: pickStudent('den', 0), salary: 8e6, start: '2026-10-12', paid: 1, status: 'active' },
    { id: 'x4', company: 'Chinor Industries', student: pickStudent('eng', 3), salary: 9e6, start: '2026-10-26', paid: 0, status: 'active' },
  ].sort((a, b) => b.start.localeCompare(a.start))
  const caseText: Record<string, { text: string; action: string; done: string; who: Student }> = {
    k1: { text: t('pl.case1', { name: pickStudent('bus', 4).name, company: 'Sirdaryo Capital' }), action: t('pl.case.open'), done: 'to.case.open', who: pickStudent('bus', 4) },
    k2: { text: t('pl.case2', { name: pickStudent('eng', 5).name, company: 'Chinor Industries' }), action: t('pl.case.ask'), done: 'to.case.update', who: pickStudent('eng', 5) },
  }
  return (
    <>
      <div className="page-head"><Title as="h1" a={t('pl.a')} b={t('pl.b')} /><p>{t('pl.sub')}</p></div>
      <section className="panel">
        <div className="panel-head"><div><h2>{t('pl.checks.t')}</h2><p>{t('pl.checks.d')}</p></div></div>
        {cases.length === 0 ? <Empty title={t('pl.nocase.t')}>{t('pl.nocase.d')}</Empty> : (
          <ul className="cases">
            {cases.map((id) => (
              <li key={id}><Portrait s={caseText[id].who} /><p>{caseText[id].text}</p><Btn small kind="ink" icon="flag" onClick={() => { setCases(cases.filter((x) => x !== id)); toast(caseText[id].done, undefined, 'info') }}>{caseText[id].action}</Btn></li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>{t('pl.ledger')}</h2></div>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>{t('role.student')}</th><th>{t('pl.c.company')}</th><th>{t('pl.c.start')}</th><th className="num">{t('pl.c.salary')}</th><th className="num">{t('pl.c.fee')}</th><th>{t('pl.c.paid')}</th><th>{t('pl.c.guar')}</th></tr></thead>
            <tbody>
              {ledger.map((r) => {
                const day = daysBetween(r.start, TODAY)
                return (
                  <tr key={r.id}>
                    <td><span className="cell-who"><Portrait s={r.student} /><span>{r.student.name}<small>{t('school.' + r.student.school)}</small></span></span></td>
                    <td>{r.company}</td>
                    <td>{date(r.start)}</td>
                    <td className="num">{money(r.salary)}</td>
                    <td className="num">{money(r.salary * FEE_SALARIES)}</td>
                    <td>{t('pl.halves', { n: r.paid })}</td>
                    <td>
                      {r.status === 'awaiting' ? <Pill tone="blue" icon="clock">{t('pl.g.await')}</Pill>
                        : r.status === 'disputed' ? <Pill tone="bad" icon="flag">{t('pl.g.disputed')}</Pill>
                        : r.status === 'left' ? <Pill>{t('pl.g.left')}</Pill>
                        : day < 0 ? <Pill>{t('pl.g.startsin', { n: -day })}</Pill>
                        : day >= GUARANTEE_DAYS ? <Pill tone="ok" icon="check">{t('pl.g.passed')}</Pill>
                        : <Pill tone="ink">{t('pl.g.day', { a: day, b: GUARANTEE_DAYS })}</Pill>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export function Companies() {
  const { t } = useT()
  const companies = useStore((s) => s.companies)
  const pending = companies.filter((c) => c.status === 'pending')
  const planName = (code: string) => PLANS.find((p) => p.code === code)!.name
  return (
    <>
      <div className="page-head"><Title as="h1" a={t('co.a')} b={t('co.b')} /><p>{t('co.sub')}</p></div>
      <section className="panel">
        <div className="panel-head"><h2>{t('co.pending')}</h2></div>
        {pending.length === 0 ? <Empty title={t('co.none.t')}>{t('co.none.d')}</Empty> : (
          <ul className="requests">
            {pending.map((c) => (
              <li className="request" key={c.id} style={{ viewTransitionName: 'co-' + c.id } as React.CSSProperties}>
                <span className="logo" aria-hidden="true">{c.name[0]}</span>
                <div className="request-main"><h3>{c.name}<small>{t('ind.' + c.industry)}</small></h3><p className="request-role">{t('co.applied', { plan: planName(c.plan) })}</p></div>
                <div className="request-act"><Btn small icon="check" onClick={() => reviewCompany(c.id, true)}>{t('co.approve')}</Btn><button className="ulink" onClick={() => reviewCompany(c.id, false)}>{t('req.decline')}</button></div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <div className="panel-head"><h2>{t('co.approved')}</h2></div>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>{t('pl.c.company')}</th><th>{t('co.c.industry')}</th><th>{t('co.c.plan')}</th><th className="num">{t('co.c.hires')}</th></tr></thead>
            <tbody>
              <tr><td>{COMPANY.name}</td><td>{t('ind.' + COMPANY.industry)}</td><td>Team</td><td className="num">1</td></tr>
              {companies.filter((c) => c.status === 'approved').map((c) => <tr key={c.id}><td>{c.name}</td><td>{t('ind.' + c.industry)}</td><td>{planName(c.plan)}</td><td className="num">{c.hires}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
