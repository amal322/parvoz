// Pure business rules. The same rules are enforced in supabase/migrations.

export type School = 'eng' | 'bus' | 'med' | 'den'
export type Employment = 'full' | 'intern' | 'part'
export const SCHOOLS: School[] = ['eng', 'bus', 'med', 'den']
export const EMPLOYMENTS: Employment[] = ['full', 'intern', 'part']

export interface Student {
  id: string
  name: string
  female: boolean
  portrait: number
  school: School
  program: string // program id, see i18n `prog.*`
  year: number
  gradYear: number
  gpa: number
  attendance: number
  cvScore: number
  rank: number
  skills: string[]
  english: string
  langs: ('uz' | 'ru' | 'en')[]
  openTo: Employment[]
  availableFrom: string
  salary: number // expectation, UZS per month
  projects: { n: number; gradedBy: string }[] // text lives in i18n `pj.<program>.<n>`
}

export interface Role {
  id: string
  title?: string // typed in by the employer
  titleKey?: string // demo roles, translated
  company?: string
  industry?: string
  schools: School[]
  skills: string[]
  employment: Employment
  salaryMin: number
  salaryMax: number
}

export const FEE_SALARIES = 3 // placement fee, in gross monthly salaries
export const GUARANTEE_DAYS = 90
export const FIRST_HALF_DUE_DAYS = 10
export const ATTRIBUTION_MONTHS = 12

export interface MatchParts {
  skills: number
  school: number
  record: number
  gpa: number
  availability: number
}
export const MATCH_WEIGHTS: MatchParts = { skills: 0.5, school: 0.15, record: 0.15, gpa: 0.1, availability: 0.1 }

export function matchParts(s: Student, r: Role): MatchParts {
  const hit = r.skills.filter((k) => s.skills.includes(k)).length
  return {
    skills: r.skills.length ? hit / r.skills.length : 0,
    school: r.schools.includes(s.school) ? 1 : 0.35,
    record: s.cvScore / 1000,
    gpa: s.gpa / 4,
    availability: s.openTo.includes(r.employment) ? 1 : 0.4,
  }
}

export function matchScore(s: Student, r: Role): number {
  const p = matchParts(s, r)
  const w = MATCH_WEIGHTS
  return Math.round(
    100 * (p.skills * w.skills + p.school * w.school + p.record * w.record + p.gpa * w.gpa + p.availability * w.availability),
  )
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000)
}

export interface FeePlan {
  fee: number
  firstHalf: number
  secondHalf: number
  firstDue: string
  secondDue: string
  guaranteeUntil: string
}

export function feePlan(monthlySalary: number, startDate: string): FeePlan {
  const fee = monthlySalary * FEE_SALARIES
  const firstHalf = Math.floor(fee / 2)
  const guaranteeUntil = addDays(startDate, GUARANTEE_DAYS)
  return {
    fee,
    firstHalf,
    secondHalf: fee - firstHalf,
    firstDue: addDays(startDate, FIRST_HALF_DUE_DAYS),
    secondDue: guaranteeUntil,
    guaranteeUntil,
  }
}

/** Interview slots an employer can offer: the next working days at three fixed times. */
export function upcomingSlots(today: string, days = 4): string[] {
  const out: string[] = []
  let d = today
  while (out.length < days * 3) {
    d = addDays(d, 1)
    const wd = new Date(d + 'T00:00:00Z').getUTCDay()
    if (wd === 0 || wd === 6) continue
    for (const t of ['10:00', '14:00', '16:30']) out.push(`${d}T${t}`)
  }
  return out
}
