// Demo data. Every person and company here is invented.
import type { Employment, Role, School, Student } from './logic'

export const TODAY = '2026-11-10'

// small deterministic generator so the demo looks the same on every load
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

const FEMALE = ['Dilnoza', 'Madina', 'Nigora', 'Zarina', 'Shahzoda', 'Kamola', 'Laylo', 'Sevinch', 'Malika', 'Nodira', 'Iroda', 'Gulnoza']
const MALE = ['Javlon', 'Sardor', 'Bekzod', 'Timur', 'Rustam', 'Aziz', 'Jasur', 'Farrukh', 'Ulugbek', 'Sanjar', 'Davron', 'Shoxrux']
const SURNAMES = ['Yusupov', 'Rakhimov', 'Tursunov', 'Nazarov', 'Ismoilov', 'Khodjaev', 'Abdullaev', 'Mirzaev', 'Saidov', 'Kadirov', 'Ergashev', 'Normatov', 'Usmanov', 'Zokirov', 'Hamidov', 'Valiev']

const CATALOG: Record<School, { programs: Record<string, string[]>; years: number; salary: [number, number]; faculty: string[] }> = {
  eng: {
    programs: {
      ds: ['Python', 'SQL', 'Statistics', 'Machine learning', 'Data analysis', 'Power BI', 'Git'],
      se: ['React', 'TypeScript', 'Git', 'Figma', 'Docker', 'Java', 'SQL'],
      cs: ['Python', 'Java', 'Git', 'Docker', 'SQL', 'Machine learning', 'TypeScript'],
      me: ['AutoCAD', 'SolidWorks', 'PLC', 'Lean manufacturing', 'Technical drawing', 'Python'],
      ee: ['PLC', 'Embedded C', 'AutoCAD', 'Circuit design', 'Python', 'Technical drawing'],
    },
    years: 4,
    salary: [7, 14],
    faculty: ['Dr. A. Pulatov', 'Prof. L. Hartmann', 'Dr. S. Nematova'],
  },
  bus: {
    programs: {
      fin: ['Financial modeling', 'Excel', 'Accounting (IFRS)', 'SQL', 'Power BI', 'Presentation'],
      ba: ['SQL', 'Power BI', 'Excel', 'Statistics', 'Data analysis', 'Python'],
      mkt: ['Market research', 'SMM', 'Presentation', 'Excel', 'Copywriting', 'Figma'],
      mgmt: ['Project management', 'Presentation', 'Excel', 'Sales', 'Market research'],
    },
    years: 4,
    salary: [6, 12],
    faculty: ['Dr. M. Okafor', 'Prof. D. Sultanova', 'Dr. R. Bianchi'],
  },
  med: {
    programs: { gm: ['Clinical research', 'Patient care', 'Medical statistics', 'Lab diagnostics', 'Pharmacology', 'EMR systems'] },
    years: 6,
    salary: [5, 9],
    faculty: ['Prof. N. Alimova', 'Dr. J. Whitfield'],
  },
  den: {
    programs: { dn: ['Restorative dentistry', 'Dental radiology', 'Patient care', 'CAD/CAM dentistry', 'Sterilization protocols', 'Orthodontics basics'] },
    years: 5,
    salary: [5, 10],
    faculty: ['Dr. B. Rasulov', 'Prof. E. Lindqvist'],
  },
}

function build(): Student[] {
  const r = rng(20261110)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const plan: [School, number][] = [['eng', 14], ['bus', 11], ['med', 6], ['den', 5]]
  const out: Student[] = []
  const used = new Set<string>()
  const next = { f: 1, m: 0 } // portrait f[0] is reserved for the demo persona
  let n = 0
  for (const [school, count] of plan) {
    const cat = CATALOG[school]
    const programs = Object.keys(cat.programs)
    for (let i = 0; i < count; i++) {
      const female = r() < 0.5
      let name = ''
      do {
        name = `${pick(female ? FEMALE : MALE)} ${pick(SURNAMES)}${female ? 'a' : ''}`
      } while (used.has(name))
      used.add(name)
      const program = programs[i % programs.length]
      const pool = [...cat.programs[program]]
      const skills: string[] = []
      const take = 3 + Math.floor(r() * 3)
      while (skills.length < take && pool.length) skills.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
      const year = Math.max(2, cat.years - Math.floor(r() * 3))
      const gpa = Math.round((2.7 + r() * 1.3) * 100) / 100
      const cvScore = Math.round(420 + (gpa - 2.7) * 260 + r() * 240)
      const finalYear = year === cat.years
      const openTo: Employment[] = finalYear ? (r() < 0.7 ? ['full'] : ['full', 'part']) : r() < 0.6 ? ['intern'] : ['intern', 'part']
      const [lo, hi] = cat.salary
      const salary = Math.round((lo + r() * (hi - lo)) * (finalYear ? 1 : 0.55) * 2) / 2
      const two = r() < 0.55
      out.push({
        id: `s${++n}`,
        name,
        female,
        portrait: female ? next.f++ % 20 : next.m++ % 20,
        school,
        program,
        year,
        gradYear: 2027 + (cat.years - year),
        gpa,
        attendance: 78 + Math.floor(r() * 21),
        cvScore,
        rank: 0,
        skills,
        english: pick(['IELTS 6.5', 'IELTS 7.0', 'IELTS 7.5', 'IELTS 8.0', 'IELTS 6.0']),
        langs: r() < 0.75 ? ['uz', 'ru', 'en'] : ['uz', 'en'],
        openTo,
        availableFrom: finalYear ? '2027-06-15' : pick(['2026-12-01', '2027-01-15', '2027-06-01']),
        salary: salary * 1e6,
        projects: (two ? [1, 2] : [r() < 0.5 ? 1 : 2]).map((k) => ({ n: k, gradedBy: pick(cat.faculty) })),
      })
    }
  }
  // the student persona used in the demo
  Object.assign(out[0], {
    name: 'Dilnoza Yusupova', female: true, portrait: 0, program: 'ds', year: 4, gradYear: 2027, gpa: 3.86, attendance: 96, cvScore: 934,
    skills: ['Python', 'SQL', 'Statistics', 'Data analysis', 'Power BI', 'Machine learning'], english: 'IELTS 7.5', langs: ['uz', 'ru', 'en'],
    openTo: ['full'], availableFrom: '2027-06-15', salary: 11e6,
    projects: [{ n: 1, gradedBy: 'Dr. A. Pulatov' }, { n: 2, gradedBy: 'Prof. L. Hartmann' }],
  } satisfies Partial<Student>)
  const sorted = [...out].sort((a, b) => b.cvScore - a.cvScore)
  sorted.forEach((s, i) => (s.rank = i + 1))
  return out
}

export const STUDENTS = build()
export const ME_STUDENT = 's1'

export const COMPANY = { id: 'c1', name: 'Navro Systems', industry: 'software', user: 'Kamila Rashidova' }

export const ROLES: Role[] = [
  { id: 'r1', titleKey: 'role.r1', schools: ['eng', 'bus'], skills: ['SQL', 'Python', 'Power BI', 'Statistics', 'Data analysis'], employment: 'full', salaryMin: 9e6, salaryMax: 13e6 },
  { id: 'r2', titleKey: 'role.r2', schools: ['eng'], skills: ['React', 'TypeScript', 'Git', 'Figma'], employment: 'full', salaryMin: 10e6, salaryMax: 16e6 },
  { id: 'r3', titleKey: 'role.r3', schools: ['bus'], skills: ['Financial modeling', 'Excel', 'Accounting (IFRS)', 'SQL'], employment: 'intern', salaryMin: 4e6, salaryMax: 6e6 },
]

// roles other companies have open; the student sees them under "Jobs for you"
export const JOBS: Role[] = [
  { id: 'j1', titleKey: 'role.j1', company: 'Sirdaryo Capital', industry: 'finance', schools: ['eng', 'bus'], skills: ['SQL', 'Python', 'Statistics', 'Financial modeling'], employment: 'full', salaryMin: 10e6, salaryMax: 14e6 },
  { id: 'j2', titleKey: 'role.j2', company: 'Chinor Industries', industry: 'manufacturing', schools: ['eng'], skills: ['SQL', 'Power BI', 'Data analysis', 'Lean manufacturing'], employment: 'full', salaryMin: 8e6, salaryMax: 11e6 },
  { id: 'j3', titleKey: 'role.j3', company: 'Meros Retail', industry: 'retail', schools: ['eng', 'bus'], skills: ['Python', 'Machine learning', 'SQL', 'Docker'], employment: 'full', salaryMin: 12e6, salaryMax: 17e6 },
  { id: 'j4', titleKey: 'role.j4', company: 'Oqsaroy Clinics', industry: 'healthcare', schools: ['med', 'eng'], skills: ['Medical statistics', 'Python', 'Statistics', 'Clinical research'], employment: 'part', salaryMin: 5e6, salaryMax: 7e6 },
]

export interface Plan {
  code: 'scout' | 'team' | 'partner'
  name: string
  price: number
  seats: number | null
  intros: number | null
  roles: number | null
}

export const PLANS: Plan[] = [
  { code: 'scout', name: 'Scout', price: 2.4e6, seats: 1, intros: 10, roles: 1 },
  { code: 'team', name: 'Team', price: 6.9e6, seats: 5, intros: 40, roles: 10 },
  { code: 'partner', name: 'Campus Partner', price: 18e6, seats: null, intros: null, roles: null },
]

export const OTHER_COMPANIES = [
  { id: 'c2', name: 'Sirdaryo Capital', industry: 'finance', plan: 'team', status: 'approved' as const, hires: 14 },
  { id: 'c3', name: 'Oqsaroy Clinics', industry: 'healthcare', plan: 'partner', status: 'approved' as const, hires: 22 },
  { id: 'c4', name: 'Chinor Industries', industry: 'manufacturing', plan: 'scout', status: 'approved' as const, hires: 9 },
  { id: 'c5', name: 'Meros Retail', industry: 'retail', plan: 'team', status: 'pending' as const, hires: 0 },
  { id: 'c6', name: 'Lola Dental Group', industry: 'healthcare', plan: 'scout', status: 'pending' as const, hires: 0 },
]

// twelve months of platform revenue for the career office view, UZS millions (Dec 2025 to Nov 2026)
export const REVENUE = [
  { m: '2025-12', sub: 38, fee: 0 }, { m: '2026-01', sub: 52, fee: 31 }, { m: '2026-02', sub: 61, fee: 48 }, { m: '2026-03', sub: 74, fee: 66 },
  { m: '2026-04', sub: 88, fee: 54 }, { m: '2026-05', sub: 97, fee: 93 }, { m: '2026-06', sub: 118, fee: 214 }, { m: '2026-07', sub: 131, fee: 302 },
  { m: '2026-08', sub: 139, fee: 268 }, { m: '2026-09', sub: 152, fee: 187 }, { m: '2026-10', sub: 164, fee: 142 }, { m: '2026-11', sub: 171, fee: 96 },
]

export const FUNNEL = [1284, 2140, 1498, 902, 311, 214]

// class of 2026, six months after graduation
export const OUTCOMES: { school: School; grads: number; employed: number; via: number; salary: number }[] = [
  { school: 'eng', grads: 412, employed: 334, via: 96, salary: 9.8e6 },
  { school: 'bus', grads: 365, employed: 285, via: 71, salary: 8.9e6 },
  { school: 'med', grads: 148, employed: 130, via: 29, salary: 6.4e6 },
  { school: 'den', grads: 96, employed: 82, via: 18, salary: 7.2e6 },
]
