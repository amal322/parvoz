// The recruiting agent, as it runs in the prototype: a rule-based reading of a request in Russian,
// Uzbek or English, followed by the same filters, ranking and explanations the product uses.
// Nothing here is a language model. In production a model does the reading and the wording, and
// calls these same steps as tools under the caller's access rights (see docs/SYSTEM.md, section 9).
import { matchParts, matchScore, type Employment, type Role, type School, type Student } from './logic'
import { cohortRadar, insightOf, radarOf, standouts } from './insight'

export interface Criteria {
  skills: string[]
  schools: School[]
  employment?: Employment
  minEnglish?: number
  minGpa?: number
  maxSalary?: number // UZS a month
  finalYear?: boolean
  count: number
}
export interface Note { key: string; vars?: Record<string, string | number>; axes?: string[]; tone?: 'ok' | 'warn' }
export interface Hit { student: Student; score: number; matched: string[]; missing: string[]; notes: Note[] }
export interface Analysis { score: number; verdict: 'strong' | 'good' | 'stretch'; strengths: Note[]; gaps: Note[]; risks: Note[]; questions: Note[] }
export type Relaxed = 'salary' | 'english' | 'gpa' | 'year'
export type Reply =
  | { kind: 'search'; criteria: Criteria; pool: number; passed: number; relaxed: Relaxed[]; hits: Hit[] }
  | { kind: 'about'; student: Student; analysis: Analysis }
  | { kind: 'compare'; a: Student; b: Student; sa: number; sb: number }
  | { kind: 'draft'; student: Student; matched: string[] }
  | { kind: 'shortlist'; ids: string[] }
  | { kind: 'help' }

// ── reading the request
const ALIASES: [RegExp, string[]][] = [
  [/python|питон|пайтон/i, ['Python']],
  [/\bsql\b|скл|эскуэль/i, ['SQL']],
  [/power ?bi|дашборд|dashboard/i, ['Power BI']],
  [/excel|эксел/i, ['Excel']],
  [/statisti|статист/i, ['Statistics']],
  [/machine learning|\bml\b|машинн\S* обуч|mashinali/i, ['Machine learning']],
  [/data analy|analyst|анализ\S* данных|аналитик|analitik|tahlilchi/i, ['Data analysis', 'SQL']],
  [/react|фронтенд|front-?end/i, ['React', 'TypeScript']],
  [/typescript|тайпскрипт/i, ['TypeScript']],
  [/\bjava\b|джава/i, ['Java']],
  [/\bgit\b/i, ['Git']],
  [/docker|докер/i, ['Docker']],
  [/figma|фигма/i, ['Figma']],
  [/financ|финанс|moliya/i, ['Financial modeling', 'Excel']],
  [/ifrs|мсфо|бухгалт|accounting|buxgalter/i, ['Accounting (IFRS)']],
  [/market research|маркет|marketing/i, ['Market research', 'SMM']],
  [/\bsmm\b/i, ['SMM']],
  [/sales|продаж|sotuv/i, ['Sales']],
  [/project manag|управлени\S* проект|проектн\S* менедж|loyiha boshqar/i, ['Project management']],
  [/autocad|автокад/i, ['AutoCAD']],
  [/solidworks/i, ['SolidWorks']],
  [/\bplc\b|плк/i, ['PLC']],
  [/lean|бережлив/i, ['Lean manufacturing']],
  [/clinical|клиническ|klinik/i, ['Clinical research']],
  [/patient care|пациент|bemor/i, ['Patient care']],
  [/lab diag|лаборатор/i, ['Lab diagnostics']],
  [/orthodont|ортодонт/i, ['Orthodontics basics']],
  [/radiolog|рентген/i, ['Dental radiology']],
  [/copywrit|копирайт/i, ['Copywriting']],
  [/presentation|презентац|taqdimot/i, ['Presentation']],
  [/revit|ревит/i, ['Revit']],
  [/визуализ|3d vis/i, ['3D visualization']],
  [/brand|бренд/i, ['Branding']],
  [/guest|работ\S* с гостями|mehmonlar bilan/i, ['Guest service']],
  [/event|мероприят|tadbir/i, ['Event planning']],
]
const SCHOOL_RX: [RegExp, School][] = [
  [/стомат|dent|stomat/i, 'den'],
  [/архитект|дизайн|architect|design|arxitekt|dizayn/i, 'arc'],
  [/туризм|гостинич|гостеприим|отел|hospitality|tourism|hotel|turizm|mehmon/i, 'hos'],
  [/медиц|medic|врач|tibbiyot|shifokor/i, 'med'],
  [/инженер|engineer|muhandis|айти|\bit\b/i, 'eng'],
  [/бизнес|business|biznes|экономи|iqtisod/i, 'bus'],
]
const num = (s: string) => Number(s.replace(',', '.'))
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function findSkills(text: string, catalog: string[]): string[] {
  const out = new Set<string>()
  for (const k of catalog) if (new RegExp(`(^|[^a-zа-я0-9])${esc(k.toLowerCase())}([^a-zа-я0-9]|$)`, 'i').test(text.toLowerCase())) out.add(k)
  for (const [rx, ks] of ALIASES) if (rx.test(text)) ks.filter((k) => catalog.includes(k)).forEach((k) => out.add(k))
  return [...out]
}

export function parseCriteria(text: string, catalog: string[]): Criteria {
  const c: Criteria = { skills: findSkills(text, catalog), schools: [], count: 5 }
  for (const [rx, s] of SCHOOL_RX) if (rx.test(text) && !c.schools.includes(s)) c.schools.push(s)
  if (/стаж|intern|amaliyot/i.test(text)) c.employment = 'intern'
  else if (/частичн|part-?time|qisman|полставки/i.test(text)) c.employment = 'part'
  else if (/полн\S* занят|full-?time|to.liq|в штат/i.test(text)) c.employment = 'full'
  const en = text.match(/(?:ielts|английск\S*|english|ingliz\S*)\D{0,14}(\d(?:[.,]\d)?)/i)
  if (en) c.minEnglish = num(en[1])
  const gpa = text.match(/gpa\D{0,10}(\d(?:[.,]\d+)?)/i)
  if (gpa) c.minGpa = num(gpa[1])
  const sal = text.match(/(?:до|up to|under|below|не дороже|бюджет\S*|budget)\s*(\d+(?:[.,]\d+)?)\s*(?:млн|mln|m\b|million)/i) ?? text.match(/(\d+(?:[.,]\d+)?)\s*(?:млн|mln|m)\S*\s*(?:gacha|гача)/i)
  if (sal) c.maxSalary = num(sal[1]) * 1e6
  const n = text.match(/(?:топ|top)[-\s]?(\d+)/i) ?? text.match(/(\d+)\s*(?:кандидат|человек|студент|аналитик|candidate|people|student|analyst|engineer|nomzod|talaba|tahlilchi)/i)
  if (n) c.count = Math.min(8, Math.max(1, Number(n[1])))
  if (/выпускн|final[-\s]year|graduat|bitiruvchi/i.test(text)) c.finalYear = true
  return c
}
export const isEmpty = (c: Criteria) => !c.skills.length && !c.schools.length && !c.employment && c.minEnglish == null && c.minGpa == null && c.maxSalary == null && !c.finalYear

/** A follow-up such as "only with Python" narrows the previous request instead of starting over. */
export function mergeCriteria(prev: Criteria, next: Criteria): Criteria {
  return {
    skills: [...new Set([...prev.skills, ...next.skills])],
    schools: next.schools.length ? next.schools : prev.schools,
    employment: next.employment ?? prev.employment,
    minEnglish: next.minEnglish ?? prev.minEnglish,
    minGpa: next.minGpa ?? prev.minGpa,
    maxSalary: next.maxSalary ?? prev.maxSalary,
    finalYear: next.finalYear ?? prev.finalYear,
    count: next.count !== 5 ? next.count : prev.count,
  }
}

// ── filters and ranking
const ielts = (s: Student) => Number(s.english.replace(/[^\d.]/g, '')) || 0
const lastYear = (s: Student) => s.openTo.includes('full') && s.gradYear <= 2027
const roleOf = (c: Criteria, s: Student): Role => ({
  id: 'q', schools: c.schools.length ? c.schools : [s.school], skills: c.skills, employment: c.employment ?? s.openTo[0], salaryMin: 0, salaryMax: c.maxSalary ?? 0,
})

export function search(c: Criteria, students: Student[]): Extract<Reply, { kind: 'search' }> {
  const hard = students.filter((s) => (!c.schools.length || c.schools.includes(s.school)) && (!c.employment || s.openTo.includes(c.employment)))
  const soft: [Relaxed, (s: Student) => boolean][] = [
    ['salary', (s) => c.maxSalary == null || s.salary <= c.maxSalary],
    ['english', (s) => c.minEnglish == null || ielts(s) >= c.minEnglish],
    ['gpa', (s) => c.minGpa == null || s.gpa >= c.minGpa],
    ['year', (s) => !c.finalYear || lastYear(s)],
  ]
  // if nobody passes every condition, give up the softer ones one at a time and say so
  const relaxed: Relaxed[] = []
  let pool = hard.filter((s) => soft.every(([, f]) => f(s)))
  const strict = pool.length
  for (const [name] of soft) {
    if (pool.length) break
    relaxed.push(name)
    pool = hard.filter((s) => soft.filter(([n]) => !relaxed.includes(n)).every(([, f]) => f(s)))
  }
  const hits = pool
    .map((s) => {
      const matched = c.skills.filter((k) => s.skills.includes(k))
      const levels = insightOf(s).levels
      const notes: Note[] = []
      const best = matched.filter((k) => levels[k] >= 4)
      if (best.length) notes.push({ key: 'ag.n.level', vars: { list: best.map((k) => `${k} ${levels[k]}/5`).join(', ') }, tone: 'ok' })
      notes.push({ key: 'ag.n.record', vars: { gpa: s.gpa.toFixed(2), en: s.english } })
      if (c.maxSalary != null && s.salary > c.maxSalary) notes.push({ key: 'ag.n.oversalary', vars: { sum: s.salary }, tone: 'warn' })
      if (c.minEnglish != null && ielts(s) < c.minEnglish) notes.push({ key: 'ag.n.english', vars: { en: s.english }, tone: 'warn' })
      const score = c.skills.length ? matchScore(s, roleOf(c, s)) : Math.round(s.cvScore / 10)
      return { student: s, score, matched, missing: c.skills.filter((k) => !s.skills.includes(k)), notes }
    })
    .filter((h) => !c.skills.length || h.matched.length > 0)
    .sort((a, b) => b.score - a.score || b.student.cvScore - a.student.cvScore)
  return { kind: 'search', criteria: c, pool: students.length, passed: relaxed.length ? strict : hits.length, relaxed, hits: hits.slice(0, c.count) }
}

/** Why this score: what carries it, what is missing, what to check in the interview. */
export function analyze(s: Student, role: Role, all: Student[]): Analysis {
  const ins = insightOf(s)
  const parts = matchParts(s, role)
  const score = matchScore(s, role)
  const matched = role.skills.filter((k) => s.skills.includes(k))
  const missing = role.skills.filter((k) => !s.skills.includes(k))
  const out = standouts(radarOf(s), cohortRadar(all, s.school))
  const strengths: Note[] = [], gaps: Note[] = [], risks: Note[] = [], questions: Note[] = []

  const high = matched.filter((k) => ins.levels[k] >= 4)
  if (matched.length) strengths.push({ key: 'ai.s.skills', vars: { n: matched.length, m: role.skills.length, list: matched.join(', ') } })
  if (high.length) strengths.push({ key: 'ai.s.level', vars: { list: high.map((k) => `${k} ${ins.levels[k]}/5`).join(', ') } })
  if (out.strong.length) strengths.push({ key: 'ai.s.axes', axes: out.strong.map((x) => x.axis) })
  const trend = ins.terms[ins.terms.length - 1].gpa - ins.terms[0].gpa
  if (trend >= 0.15) strengths.push({ key: 'ai.s.trend', vars: { n: trend.toFixed(2) } })

  if (missing.length) gaps.push({ key: 'ai.g.missing', vars: { list: missing.join(', ') } })
  const low = matched.filter((k) => ins.levels[k] <= 2)
  if (low.length) gaps.push({ key: 'ai.g.level', vars: { list: low.map((k) => `${k} ${ins.levels[k]}/5`).join(', ') } })
  if (out.weak.length) gaps.push({ key: 'ai.g.axes', axes: out.weak.map((x) => x.axis) })
  if (parts.school < 1) gaps.push({ key: 'ai.g.school' })

  if (role.salaryMax && s.salary > role.salaryMax) risks.push({ key: 'ai.r.salary', vars: { sum: s.salary - role.salaryMax } })
  if (!s.openTo.includes(role.employment)) risks.push({ key: 'ai.r.type' })
  if (s.attendance < 85) risks.push({ key: 'ai.r.attendance', vars: { n: s.attendance } })
  if (trend <= -0.15) risks.push({ key: 'ai.r.trend', vars: { n: (-trend).toFixed(2) } })

  if (missing[0]) questions.push({ key: 'ai.q.missing', vars: { skill: missing[0] } })
  if (s.projects[0]) questions.push({ key: 'ai.q.project', vars: { n: s.projects[0].n } })
  if (high[0] ?? matched[0]) questions.push({ key: 'ai.q.depth', vars: { skill: high[0] ?? matched[0] } })
  if (questions.length < 3) questions.push({ key: 'ai.q.motivation' })

  return { score, verdict: score >= 80 ? 'strong' : score >= 60 ? 'good' : 'stretch', strengths, gaps, risks, questions: questions.slice(0, 3) }
}

/** Reads a pasted vacancy: title, skills, school, type and salary range. */
export function parseVacancy(text: string, students: Student[]) {
  const catalog = [...new Set(students.flatMap((s) => s.skills))]
  const skills = findSkills(text, catalog)
  const c = parseCriteria(text, catalog)
  // no school named: take the schools whose students actually have these skills
  const bySchool = new Map<School, number>()
  for (const s of students) for (const k of skills) if (s.skills.includes(k)) bySchool.set(s.school, (bySchool.get(s.school) ?? 0) + 1)
  const top = Math.max(0, ...bySchool.values())
  const schools = c.schools.length ? c.schools : [...bySchool].filter(([, n]) => n >= top * 0.4).map(([s]) => s)
  const range = text.match(/(\d+(?:[.,]\d+)?)\s*(?:–|—|-|до|to)\s*(\d+(?:[.,]\d+)?)\s*(?:млн|mln|m\b|million)/i)
  const from = text.match(/(?:от|from)\s*(\d+(?:[.,]\d+)?)\s*(?:млн|mln|m\b|million)/i)
  const title = (text.split('\n').map((l) => l.trim()).find(Boolean) ?? '').replace(/^[#*\s]+/, '').slice(0, 70)
  return {
    title, skills, schools, employment: c.employment ?? ('full' as Employment),
    min: range ? num(range[1]) : from ? num(from[1]) : undefined,
    max: range ? num(range[2]) : c.maxSalary ? c.maxSalary / 1e6 : undefined,
  }
}

// ── conversation
const mentioned = (text: string, students: Student[]) => {
  const low = text.toLowerCase()
  const full = students.filter((s) => low.includes(s.name.toLowerCase()))
  if (full.length) return full
  // a first name or a surname alone counts when it points at one person
  const words = new Set(low.split(/[^a-zа-яё'ʻʼ]+/i))
  const partial = students.filter((s) => s.name.toLowerCase().split(' ').some((w) => words.has(w)))
  return partial.length <= 2 ? partial : []
}

export interface Memory { criteria?: Criteria; hits?: string[]; student?: string }

export function ask(text: string, students: Student[], role: Role, memory: Memory): { reply: Reply; memory: Memory } {
  const catalog = [...new Set(students.flatMap((s) => s.skills))]
  const people = mentioned(text, students)
  const last = memory.student ? students.find((s) => s.id === memory.student) : undefined

  if (/шорт|shortlist|qisqa ro.yxat/i.test(text) && memory.hits?.length) return { reply: { kind: 'shortlist', ids: memory.hits }, memory }
  if (/напиши|сообщени|письмо|draft|write|message|xabar|yozib/i.test(text) && (people[0] ?? last)) {
    const s = people[0] ?? last!
    return { reply: { kind: 'draft', student: s, matched: role.skills.filter((k) => s.skills.includes(k)) }, memory: { ...memory, student: s.id } }
  }
  if (people.length >= 2) return { reply: { kind: 'compare', a: people[0], b: people[1], sa: matchScore(people[0], role), sb: matchScore(people[1], role) }, memory }
  if (people.length === 1) return { reply: { kind: 'about', student: people[0], analysis: analyze(people[0], role, students) }, memory: { ...memory, student: people[0].id } }

  let c = parseCriteria(text, catalog)
  if (isEmpty(c)) return { reply: { kind: 'help' }, memory }
  const narrows = memory.criteria && ((!c.skills.length && !c.schools.length) || /^(а |и |ещё|еще|только|and |also |only |faqat|yana )/i.test(text.trim()))
  if (narrows) c = mergeCriteria(memory.criteria!, c)
  const reply = search(c, students)
  return { reply, memory: { criteria: c, hits: reply.hits.map((h) => h.student.id), student: reply.hits[0]?.student.id } }
}
