// The record behind the charts on a student profile: grades by semester, skill levels and the
// three parts of the Digital CV score. In production these come from the registrar feed
// (tables student_terms, student_skills.level and students.score_* in supabase/migrations/0003).
import type { School, Student } from './logic'

export const AXES = ['acad', 'skills', 'proj', 'act', 'eng', 'att'] as const
export type Axis = (typeof AXES)[number]
export type Radar = Record<Axis, number>
export const SCORE_MAX = { acad: 560, proj: 280, act: 160 } as const

export interface Insight {
  /** completed semesters, oldest first */
  terms: { n: number; gpa: number; att: number }[]
  /** 2 to 5, set by the grade for the course that teaches the skill */
  levels: Record<string, number>
  /** the three parts add up to the Digital CV score */
  score: { acad: number; proj: number; act: number }
}

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const r2 = (x: number) => Math.round(x * 100) / 100

const cache = new Map<string, Insight>()
export function insightOf(s: Student): Insight {
  const key = `${s.id}|${s.gpa}|${s.cvScore}|${s.year}|${s.skills.join()}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = rng(7919 * Number(s.id.slice(1)) + 13)

  // Digital CV score = academics (up to 560) + projects (up to 280) + campus activity (up to 160)
  const acad = Math.min(SCORE_MAX.acad, Math.round((s.gpa / 4) * SCORE_MAX.acad))
  const rest = Math.max(0, s.cvScore - acad)
  const share = 0.55 + r() * 0.17
  const proj = clamp(Math.round(rest * share), Math.max(0, rest - SCORE_MAX.act), Math.min(SCORE_MAX.proj, rest))
  const score = s.id === 's1' ? { acad: 541, proj: 238, act: 155 } : { acad, proj, act: rest - proj }

  // semester grades that average to the cumulative GPA, with a mild trend
  const n = Math.max(2, (s.year - 1) * 2)
  const slope = (r() - 0.3) * 0.1
  let g = Array.from({ length: n }, (_, i) => slope * (i - (n - 1) / 2) + (r() - 0.5) * 0.32)
  const m = avg(g)
  g = g.map((x) => x - m)
  const top = Math.max(...g)
  if (s.gpa + top > 4) g = g.map((x) => (x * (4 - s.gpa)) / top)
  const terms = g.map((x, i) => ({ n: i + 1, gpa: r2(clamp(s.gpa + x, 2, 4)), att: clamp(s.attendance + Math.round((r() - 0.5) * 8), 60, 100) }))

  const base = 2.4 + ((s.gpa - 2.7) / 1.3) * 1.6
  const levels: Record<string, number> = {}
  for (const k of s.skills) levels[k] = clamp(Math.round(base + (r() - 0.5) * 2.2), 2, 5)

  const out = { terms, levels, score }
  cache.set(key, out)
  return out
}

const ielts = (english: string) => Number(english.replace(/[^\d.]/g, '')) || 0

/** Six measures on one 0 to 100 scale, so they can share a radar. */
export function radarOf(s: Student): Radar {
  const i = insightOf(s)
  return {
    acad: Math.round((s.gpa / 4) * 100),
    skills: Math.round((avg(Object.values(i.levels)) / 5) * 100),
    proj: Math.round((i.score.proj / SCORE_MAX.proj) * 100),
    act: Math.round((i.score.act / SCORE_MAX.act) * 100),
    eng: Math.round((ielts(s.english) / 9) * 100),
    att: s.attendance,
  }
}

const inSchool = (students: Student[], school: School) => students.filter((x) => x.school === school)

export function cohortRadar(students: Student[], school: School): Radar {
  const rs = inSchool(students, school).map(radarOf)
  return Object.fromEntries(AXES.map((a) => [a, Math.round(avg(rs.map((x) => x[a])))])) as Radar
}

/** Average GPA of the school in each semester, where at least three students have one. */
export function cohortTerms(students: Student[], school: School): (number | null)[] {
  const all = inSchool(students, school).map((x) => insightOf(x).terms)
  const len = Math.max(0, ...all.map((t) => t.length))
  return Array.from({ length: len }, (_, i) => {
    const xs = all.filter((t) => t[i]).map((t) => t[i].gpa)
    return xs.length >= 3 ? r2(avg(xs)) : null
  })
}

export function cohortScores(students: Student[], s: Student) {
  const scores = inSchool(students, s.school).map((x) => x.cvScore).sort((a, b) => a - b)
  const below = scores.filter((x) => x < s.cvScore).length
  const mid = scores.length >> 1
  return {
    scores,
    median: scores.length % 2 ? scores[mid] : Math.round((scores[mid - 1] + scores[mid]) / 2),
    place: scores.length - below,
    size: scores.length,
  }
}

/** Where the student stands out from the school, largest gap first. */
export function standouts(mine: Radar, school: Radar) {
  const diff = AXES.map((a) => ({ axis: a, d: mine[a] - school[a] }))
  return {
    strong: diff.filter((x) => x.d >= 5).sort((a, b) => b.d - a.d).slice(0, 2),
    weak: diff.filter((x) => x.d <= -5).sort((a, b) => a.d - b.d).slice(0, 2),
  }
}

/** Share of open roles asking for each skill against the share of students who have it. */
export function skillGap(students: Student[], roles: { skills: string[] }[], top = 8) {
  const names = [...new Set(roles.flatMap((r) => r.skills))]
  return names
    .map((name) => {
      const asked = roles.filter((r) => r.skills.includes(name)).length
      const have = students.filter((s) => s.skills.includes(name)).length
      return { name, asked, have, demand: Math.round((asked / roles.length) * 100), supply: Math.round((have / Math.max(1, students.length)) * 100) }
    })
    .sort((a, b) => b.demand - a.demand || a.supply - b.supply)
    .slice(0, top)
}
