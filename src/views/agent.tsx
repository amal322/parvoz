// The recruiting agent screen. The conversation lives outside React so the guided tour can speak to it.
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ask, type Criteria, type Memory, type Note, type Reply } from '../data/agent'
import { radarOf } from '../data/insight'
import { COMPANY } from '../data/seed'
import { cardOf, getState, go, openProfile, requestIntro, shortlist, toast, useStore } from '../data/store'
import { useT, type T } from '../i18n'
import { Btn, Icon, Pill, Portrait, Title, reduceMotion } from '../ui/bits'
import { RadarGlyph } from '../ui/charts'

type Msg = { id: number; from: 'me'; text: string } | { id: number; from: 'ai'; reply: Reply; fresh: boolean }
let log: Msg[] = []
let memory: Memory = {}
let seq = 0
const subs = new Set<() => void>()
const publish = (next: Msg[]) => { log = next; subs.forEach((f) => f()) }

/** Sends a request to the agent. Also called by the guided tour. */
export function sendToAgent(text: string) {
  const q = text.trim()
  if (!q) return
  const st = getState()
  const role = st.roles.find((r) => r.id === st.rankRoleId) ?? st.roles[0]
  const out = ask(q, st.students, role, memory)
  memory = out.memory
  if (out.reply.kind === 'shortlist') out.reply.ids.filter((id) => !cardOf(getState(), id)).forEach((id) => shortlist(id))
  publish([...log.map((m) => (m.from === 'ai' ? { ...m, fresh: false } : m)), { id: ++seq, from: 'me', text: q }, { id: ++seq, from: 'ai', reply: out.reply, fresh: true }])
}

const noteText = (tt: T, n: Note) => {
  const vars = { ...n.vars }
  if (typeof vars.sum === 'number') vars.sum = tt.mlnCur(vars.sum)
  if (typeof vars.n === 'number' && n.key === 'ai.q.project') return ''
  if (n.axes) vars.list = n.axes.map((a) => tt.t('ax.' + a)).join(', ')
  return tt.t(n.key, vars)
}

function Chips({ c }: { c: Criteria }) {
  const { t, mlnCur } = useT()
  const items = [
    ...c.skills, ...c.schools.map((s) => t('school.' + s)), c.employment && t('emp.' + c.employment),
    c.minEnglish != null && t('ag.c.english', { n: c.minEnglish }), c.minGpa != null && t('ag.c.gpa', { n: c.minGpa }),
    c.maxSalary != null && t('ag.c.salary', { n: mlnCur(c.maxSalary) }), c.finalYear && t('ag.c.final'), t('ag.c.count', { n: c.count }),
  ].filter(Boolean) as string[]
  return <div className="tags ag-crit">{items.map((x) => <span className="tag tag-hit" key={x}>{x}</span>)}</div>
}

/** What the agent did, in the order it did it. The numbers are the real ones from the run. */
function steps(tt: T, r: Reply, role: string): string[] {
  const { t } = tt
  if (r.kind === 'search') return [t('ag.t.read'), t('ag.t.filter', { passed: r.passed, pool: r.pool }), t('ag.t.rank')]
  if (r.kind === 'about') return [t('ag.t.profile', { name: r.student.name }), t('ag.t.school'), t('ag.t.role', { role })]
  if (r.kind === 'compare') return [t('ag.t.role', { role }), t('ag.t.school')]
  if (r.kind === 'draft') return [t('ag.t.draft')]
  return []
}

export function Analysis({ a, program }: { a: Extract<Reply, { kind: 'about' }>['analysis']; program: string }) {
  const tt = useT()
  const { t } = tt
  const block = (title: string, items: Note[], icon: string, cls = '') => items.length > 0 && (
    <div className={'ai-block ' + cls}>
      <h4>{title}</h4>
      <ul>{items.map((n, i) => <li key={i}><Icon name={icon} size={14} />{n.key === 'ai.q.project' ? t('ai.q.project', { title: t(`pj.${program}.${n.vars!.n}.t`) }) : noteText(tt, n)}</li>)}</ul>
    </div>
  )
  return (
    <div className="ai">
      <p className="ai-verdict"><Pill tone={a.verdict === 'strong' ? 'ok' : a.verdict === 'good' ? 'blue' : 'warn'} icon={a.verdict === 'stretch' ? 'flag' : 'check'}>{t('ai.v.' + a.verdict)}</Pill><b>{a.score}%</b></p>
      {block(t('ai.h.s'), a.strengths, 'check', 'is-s')}
      {block(t('ai.h.g'), a.gaps, 'close', 'is-g')}
      {block(t('ai.h.r'), a.risks, 'flag', 'is-r')}
      {block(t('ai.h.q'), a.questions, 'arrow', 'is-q')}
    </div>
  )
}

function Answer({ m }: { m: Extract<Msg, { from: 'ai' }> }) {
  const tt = useT()
  const { t, mlnCur, role: roleName } = tt
  const role = useStore((s) => s.roles.find((r) => r.id === s.rankRoleId) ?? s.roles[0])
  const cards = useStore((s) => s.cards)
  const r = m.reply
  const trace = steps(tt, r, roleName(role))
  const [shown, setShown] = useState(m.fresh && !reduceMotion() ? 0 : trace.length + 1)
  useEffect(() => {
    if (shown > trace.length) return
    const id = setTimeout(() => setShown(shown + 1), shown === 0 ? 250 : 520)
    return () => clearTimeout(id)
  }, [shown, trace.length])
  const ready = shown > trace.length
  const first = (name: string) => name.split(' ')[0]
  return (
    <div className="ag-msg ag-ai">
      <span className="ag-av" aria-hidden="true"><Icon name="agent" size={16} /></span>
      <div className="ag-body">
        {trace.length > 0 && <ol className="ag-trace">{trace.map((x, i) => <li key={i} className={i < shown ? 'is-in' : ''}>{i < shown - (ready ? 0 : 1) || ready ? <Icon name="check" size={13} /> : <span className="spinner" aria-hidden="true" />}{x}</li>)}</ol>}
        {ready && (
          <div className="ag-out">
            {r.kind === 'help' && <p>{t('ag.help')}</p>}
            {r.kind === 'shortlist' && <><p>{t('ag.shortlisted', { n: r.ids.length })}</p><Btn small kind="line" onClick={() => go('pipeline')}>{t('ag.act.pipeline')}</Btn></>}
            {r.kind === 'search' && (
              <>
                <Chips c={r.criteria} />
                {r.relaxed.length > 0 && <p className="ag-warn"><Icon name="flag" size={15} />{t('ag.relaxed', { list: r.relaxed.map((x) => t('ag.rx.' + x)).join(', ') })}</p>}
                {r.hits.length === 0 ? <p>{t('ag.none')}</p> : (
                  <>
                    <p className="ag-lead">{t('ag.found', { n: r.hits.length })}</p>
                    <ul className="ag-hits">
                      {r.hits.map((h, i) => (
                        <li key={h.student.id} style={{ '--i': i } as React.CSSProperties}>
                          <button className="ag-hit" onClick={() => openProfile(h.student.id)} aria-label={t('tal.open', { name: h.student.name })}>
                            <Portrait s={h.student} />
                            <span className="ag-who"><b>{h.student.name}</b><small>{t('prog.' + h.student.program)}, {t('l.year', { n: h.student.year })} · {mlnCur(h.student.salary)}</small></span>
                            <span className={'ag-glyph sch-' + h.student.school}><RadarGlyph values={radarOf(h.student)} /></span>
                            <b className="ag-score">{h.score}%</b>
                          </button>
                          <div className="ag-why">
                            <span className="tags">{h.matched.map((k) => <span className="tag tag-hit" key={k}>{k}</span>)}{h.missing.map((k) => <span className="tag tag-miss" key={k}>{k}</span>)}</span>
                            {h.notes.map((n, j) => <span key={j} className={'ag-note' + (n.tone ? ' is-' + n.tone : '')}>{noteText(tt, n)}</span>)}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="row">
                      {r.hits.some((h) => !cards.some((c) => c.studentId === h.student.id)) && <Btn small icon="plus" onClick={() => sendToAgent(t('ag.cmd.shortlist'))}>{t('ag.act.shortlist', { n: r.hits.length })}</Btn>}
                      <Btn small kind="line" onClick={() => sendToAgent(t('ag.cmd.about', { name: r.hits[0].student.name }))}>{t('ag.act.why', { name: first(r.hits[0].student.name) })}</Btn>
                    </div>
                  </>
                )}
              </>
            )}
            {r.kind === 'about' && (
              <>
                <button className="ag-hit ag-hit-solo" onClick={() => openProfile(r.student.id)} aria-label={t('tal.open', { name: r.student.name })}>
                  <Portrait s={r.student} />
                  <span className="ag-who"><b>{r.student.name}</b><small>{t('prog.' + r.student.program)}, {t('l.year', { n: r.student.year })}</small></span>
                  <span className={'ag-glyph sch-' + r.student.school}><RadarGlyph values={radarOf(r.student)} /></span>
                </button>
                <Analysis a={r.analysis} program={r.student.program} />
                <div className="row">
                  <Btn small onClick={() => openProfile(r.student.id)}>{t('ag.act.profile')}</Btn>
                  <Btn small kind="line" onClick={() => sendToAgent(t('ag.cmd.draft', { name: r.student.name }))}>{t('ag.act.draft')}</Btn>
                </div>
              </>
            )}
            {r.kind === 'compare' && (
              <>
                <div className="ag-cmp">
                  {[[r.a, r.sa] as const, [r.b, r.sb] as const].map(([s, sc]) => (
                    <button key={s.id} className={'ag-hit' + (sc === Math.max(r.sa, r.sb) ? ' is-best' : '')} onClick={() => openProfile(s.id)}>
                      <Portrait s={s} /><span className="ag-who"><b>{s.name}</b><small>GPA {s.gpa.toFixed(2)} · {s.english} · {mlnCur(s.salary)}</small></span>
                      <span className={'ag-glyph sch-' + s.school}><RadarGlyph values={radarOf(s)} /></span><b className="ag-score">{sc}%</b>
                    </button>
                  ))}
                </div>
                <p>{r.sa === r.sb ? t('ag.cmp.tie', { role: roleName(role) }) : t('ag.cmp', { role: roleName(role), name: (r.sa > r.sb ? r.a : r.b).name, a: Math.max(r.sa, r.sb), b: Math.min(r.sa, r.sb) })}</p>
              </>
            )}
            {r.kind === 'draft' && (() => {
              const body = t('ag.draft.body', { first: first(r.student.name), user: COMPANY.user, company: COMPANY.name, role: roleName(role), skills: (r.matched.length ? r.matched : r.student.skills.slice(0, 3)).join(', ') })
              const sent = cards.find((c) => c.studentId === r.student.id && c.intro !== 'none')
              return (
                <>
                  <p className="ag-lead">{t('ag.draft.t', { name: r.student.name })}</p>
                  <blockquote className="ag-draft">{body}</blockquote>
                  <p className="sec-note-b">{t('ag.draft.note', { first: first(r.student.name) })}</p>
                  <div className="row">
                    {!sent && <Btn small onClick={() => requestIntro(r.student.id)}>{t('pro.request')}</Btn>}
                    <Btn small kind="line" icon="check" onClick={() => { try { navigator.clipboard?.writeText(body) } catch { /* copying is a convenience */ } toast('ag.copied') }}>{t('ag.act.copy')}</Btn>
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

export function Agent() {
  const { t } = useT()
  const msgs = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => log)
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { if (msgs.length) end.current?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'end' }) }, [msgs.length])
  const send = (q: string) => { sendToAgent(q); setText('') }
  const tries = ['ag.s1', 'ag.s2', 'ag.s3', 'ag.s4']
  return (
    <>
      <div className="page-head"><Title as="h1" a={t('ag.a')} b={t('ag.b')} /><p>{t('ag.sub')}</p></div>
      <section className="panel agent">
        {msgs.length === 0 && (
          <div className="ag-empty">
            <h2>{t('ag.try')}</h2>
            <ul>{tries.map((k) => <li key={k}><button className="ag-try" onClick={() => send(t(k))}><Icon name="arrow" size={15} />{t(k)}</button></li>)}</ul>
          </div>
        )}
        <div className="ag-log" role="log" aria-live="polite">
          {msgs.map((m) => (m.from === 'me' ? <div key={m.id} className="ag-msg ag-me"><p>{m.text}</p></div> : <Answer key={m.id} m={m} />))}
          <div ref={end} />
        </div>
        <form className="ag-form" onSubmit={(e) => { e.preventDefault(); send(text) }}>
          <label className="vh" htmlFor="ag-input">{t('ag.send')}</label>
          <input id="ag-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ag.ph')} autoComplete="off" />
          <Btn type="submit" disabled={!text.trim()}>{t('ag.send')}</Btn>
        </form>
        <p className="ag-fine"><Icon name="shield" size={14} />{t('ag.fine')}</p>
      </section>
    </>
  )
}
