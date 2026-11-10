// In-memory demo backend. Each action mirrors an RPC in supabase/migrations
// (request_intro, respond_intro, propose_interview, pick_interview, report_hire, confirm_hire, report_departure, set_interest).
import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { COMPANY, JOBS, ME_STUDENT, OTHER_COMPANIES, PLANS, ROLES, STUDENTS, TODAY } from './seed'
import { addDays, feePlan, matchScore, upcomingSlots, type Employment, type Role, type Student } from './logic'

export type Lang = 'uz' | 'ru' | 'en'
export type Viewer = 'company' | 'student' | 'office'
export type Stage = 'shortlisted' | 'intro' | 'interview' | 'offer' | 'hired'
export type IntroStatus = 'none' | 'requested' | 'accepted' | 'declined'
export const STAGES: Stage[] = ['shortlisted', 'intro', 'interview', 'offer', 'hired']

export interface Card { studentId: string; roleId: string; stage: Stage; intro: IntroStatus; slots?: string[]; interviewAt?: string }
export interface Placement {
  id: string; studentId: string; company: string; roleId: string; salary: number; start: string
  status: 'awaiting' | 'active' | 'disputed' | 'left'
}
export interface Invoice {
  id: string; kind: 'sub' | 'half1' | 'half2'; month?: string; amount: number; due: string
  status: 'paid' | 'due' | 'scheduled' | 'void'; placementId?: string
}
export interface ExternalIntro { id: string; jobId: string; msgKey: string; status: IntroStatus; slots?: string[]; interviewAt?: string }
export interface Toast { id: number; key: string; vars?: Record<string, string | number>; tone: 'ok' | 'info' | 'warn' }

export interface State {
  lang: Lang
  viewer: Viewer | null // null = public landing
  route: string
  profileId: string | null
  rankRoleId: string
  students: Student[]
  roles: Role[]
  cards: Card[]
  placements: Placement[]
  invoices: Invoice[]
  plan: 'scout' | 'team' | 'partner'
  introsUsed: number
  visible: boolean
  external: ExternalIntro[]
  interest: { studentId: string; roleId: string }[]
  notes: Record<string, string>
  compare: string[]
  companies: typeof OTHER_COMPANIES
  toasts: Toast[]
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('parvoz.lang')
    if (saved === 'uz' || saved === 'ru' || saved === 'en') return saved
  } catch { /* storage is a convenience only */ }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2).toLowerCase()
  return nav === 'uz' || nav === 'ru' ? nav : 'en'
}

const top = (role: Role, skip: string[] = []) =>
  STUDENTS.filter((s) => s.id !== ME_STUDENT && !skip.includes(s.id))
    .sort((a, b) => matchScore(b, role) - matchScore(a, role))
    .map((s) => s.id)

function initial(): State {
  const a = top(ROLES[0])
  const b = top(ROLES[1], a.slice(0, 6))
  const slots = upcomingSlots(TODAY)
  const cards: Card[] = [
    { studentId: a[0], roleId: 'r1', stage: 'hired', intro: 'accepted' },
    { studentId: a[1], roleId: 'r1', stage: 'offer', intro: 'accepted' },
    { studentId: a[2], roleId: 'r1', stage: 'interview', intro: 'accepted', interviewAt: slots[1] },
    { studentId: b[0], roleId: 'r2', stage: 'interview', intro: 'accepted' },
    { studentId: b[1], roleId: 'r2', stage: 'intro', intro: 'requested' },
    { studentId: a[3], roleId: 'r1', stage: 'intro', intro: 'requested' },
    { studentId: b[2], roleId: 'r2', stage: 'shortlisted', intro: 'none' },
    { studentId: a[4], roleId: 'r1', stage: 'shortlisted', intro: 'none' },
    { studentId: b[3], roleId: 'r2', stage: 'shortlisted', intro: 'none' },
  ]
  const start = '2026-09-30'
  const fp = feePlan(12e6, start)
  return {
    lang: initialLang(),
    viewer: null,
    route: '',
    profileId: null,
    rankRoleId: 'r1',
    students: STUDENTS,
    roles: ROLES,
    cards,
    placements: [{ id: 'p1', studentId: a[0], company: COMPANY.name, roleId: 'r1', salary: 12e6, start, status: 'active' }],
    invoices: [
      { id: 'i1', kind: 'sub', month: '2026-09', amount: 6.9e6, due: '2026-09-05', status: 'paid' },
      { id: 'i2', kind: 'sub', month: '2026-10', amount: 6.9e6, due: '2026-10-05', status: 'paid' },
      { id: 'i3', kind: 'half1', amount: fp.firstHalf, due: fp.firstDue, status: 'paid', placementId: 'p1' },
      { id: 'i4', kind: 'sub', month: '2026-11', amount: 6.9e6, due: '2026-11-05', status: 'paid' },
      { id: 'i5', kind: 'half2', amount: fp.secondHalf, due: fp.secondDue, status: 'scheduled', placementId: 'p1' },
    ],
    plan: 'team',
    introsUsed: 9,
    visible: true,
    external: [
      { id: 'e1', jobId: 'j1', msgKey: 'msg.e1', status: 'requested' },
      { id: 'e2', jobId: 'j2', msgKey: 'msg.e2', status: 'accepted', slots: [slots[0], slots[4], slots[8]] },
    ],
    interest: [
      { studentId: a[5], roleId: 'r1' }, { studentId: a[7], roleId: 'r1' }, { studentId: b[4], roleId: 'r2' }, { studentId: b[5], roleId: 'r2' },
    ],
    notes: { [a[1]]: '' },
    compare: [],
    companies: OTHER_COMPANIES,
    toasts: [],
  }
}

let state = initial()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
function set(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  emit()
}
export const getState = () => state
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => sel(state))
}

const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Run a state change inside a view transition so the old and new screens morph instead of cutting. */
export function transition(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (!d.startViewTransition || reduceMotion()) return fn()
  d.startViewTransition(() => flushSync(fn))
}

let toastId = 0
export function toast(key: string, vars?: Toast['vars'], tone: Toast['tone'] = 'ok') {
  const id = ++toastId
  set((s) => ({ toasts: [...s.toasts.slice(-2), { id, key, vars, tone }] }))
  setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4800)
}

export function setLang(lang: Lang) {
  try { localStorage.setItem('parvoz.lang', lang) } catch { /* fine without it */ }
  set({ lang })
  document.documentElement.lang = lang
}

const HOME: Record<Viewer, string> = { company: 'talent', student: 'inbox', office: 'overview' }
export const ROUTES: Record<Viewer, string[]> = {
  company: ['talent', 'pipeline', 'roles', 'billing'],
  student: ['inbox', 'jobs', 'my-profile'],
  office: ['overview', 'outcomes', 'placements', 'companies'],
}
const viewerOf = (route: string) => (Object.keys(ROUTES) as Viewer[]).find((v) => ROUTES[v].includes(route)) ?? null

function setHash(h: string) {
  try {
    if (location.hash.replace('#', '') !== h) history.replaceState(null, '', h ? '#' + h : location.pathname)
  } catch { /* hash is a convenience only */ }
}

export function go(route: string) {
  const viewer = viewerOf(route)
  transition(() => set({ route: viewer ? route : '', viewer, profileId: null }))
  setHash(viewer ? route : '')
  window.scrollTo({ top: 0 })
}
export const enter = (v: Viewer) => go(HOME[v])
export const openProfile = (id: string | null) => transition(() => set({ profileId: id }))
export const setRankRole = (id: string) => transition(() => set({ rankRoleId: id }))
export function syncFromHash() {
  const h = location.hash.replace('#', '')
  const viewer = viewerOf(h)
  set({ route: viewer ? h : '', viewer })
}

export const studentOf = (s: State, id: string) => s.students.find((x) => x.id === id)!
const first = (id: string) => studentOf(state, id).name.split(' ')[0]
export const planOf = (s: State) => PLANS.find((p) => p.code === s.plan)!
export const cardOf = (s: State, studentId: string) => s.cards.find((c) => c.studentId === studentId)
export const isInterested = (s: State, studentId: string, roleId: string) => s.interest.some((i) => i.studentId === studentId && i.roleId === roleId)
export const jobOf = (s: State, id: string) => s.roles.find((r) => r.id === id) ?? JOBS.find((r) => r.id === id)

// ── company actions ──────────────────────────────────────────────
export function shortlist(studentId: string) {
  if (cardOf(state, studentId)) return
  transition(() => set((s) => ({ cards: [...s.cards, { studentId, roleId: s.rankRoleId, stage: 'shortlisted', intro: 'none' }] })))
  toast('to.shortlisted', { name: first(studentId) })
}

export function toggleCompare(studentId: string) {
  if (state.compare.includes(studentId)) return set((s) => ({ compare: s.compare.filter((x) => x !== studentId) }))
  if (state.compare.length >= 3) return toast('to.compare.max', undefined, 'warn')
  set((s) => ({ compare: [...s.compare, studentId] }))
}
export const clearCompare = () => set({ compare: [] })

export function saveNote(studentId: string, text: string) {
  set((s) => ({ notes: { ...s.notes, [studentId]: text } }))
  toast('to.note')
}

/** request_intro: checks the plan limit, opens the 12-month attribution window, moves the card. */
export function requestIntro(studentId: string): Promise<boolean> {
  const plan = planOf(state)
  if (plan.intros !== null && state.introsUsed >= plan.intros) {
    toast('to.limit', { used: state.introsUsed, max: plan.intros }, 'warn')
    return Promise.resolve(false)
  }
  return new Promise((resolve) =>
    setTimeout(() => {
      transition(() =>
        set((s) => {
          const exists = cardOf(s, studentId)
          const card: Card = { studentId, roleId: exists?.roleId ?? s.rankRoleId, stage: 'intro', intro: 'requested' }
          return { introsUsed: s.introsUsed + 1, cards: exists ? s.cards.map((c) => (c.studentId === studentId ? card : c)) : [...s.cards, card] }
        }),
      )
      toast('to.introsent', { name: first(studentId) }, 'info')
      // every student but the demo persona answers on their own after a moment
      if (studentId !== ME_STUDENT) setTimeout(() => respondIntro(studentId, Number(studentId.slice(1)) % 9 !== 0), 3200)
      resolve(true)
    }, 900),
  )
}

/** respond_intro: only the student can answer. */
export function respondIntro(studentId: string, accept: boolean) {
  const card = cardOf(state, studentId)
  if (!card || card.intro !== 'requested') return
  transition(() =>
    set((s) => ({
      cards: s.cards.map((c) => (c.studentId === studentId ? { ...c, intro: accept ? 'accepted' : 'declined', stage: accept ? 'interview' : 'intro' } : c)),
    })),
  )
  if (state.viewer === 'company') toast(accept ? 'to.accepted' : 'to.declined', { name: first(studentId) }, accept ? 'ok' : 'warn')
}

/** propose_interview: the employer offers up to three times; the student picks one. */
export function proposeSlots(studentId: string, slots: string[]) {
  set((s) => ({ cards: s.cards.map((c) => (c.studentId === studentId ? { ...c, slots, interviewAt: undefined } : c)) }))
  toast('to.slots.sent', { name: first(studentId) }, 'info')
  if (studentId !== ME_STUDENT) setTimeout(() => pickSlot(studentId, slots[0]), 3000)
}
/** pick_interview */
export function pickSlot(studentId: string, slot: string) {
  const card = cardOf(state, studentId)
  if (!card?.slots?.includes(slot)) return
  transition(() => set((s) => ({ cards: s.cards.map((c) => (c.studentId === studentId ? { ...c, interviewAt: slot, slots: undefined } : c)) })))
  // `d` holds a raw timestamp; the toast formats it in the viewer's language
  if (state.viewer === 'student') toast('to.slot.you', { d: slot })
  else if (state.viewer === 'company') toast('to.slot.picked', { name: first(studentId), d: slot })
}
export function pickExternalSlot(id: string, slot: string) {
  transition(() => set((s) => ({ external: s.external.map((e) => (e.id === id ? { ...e, interviewAt: slot, slots: undefined } : e)) })))
  toast('to.slot.you', { d: slot })
}

/** Mirrors the pipeline guard trigger: no interview, offer or hire before the student accepts. */
export function moveCard(studentId: string, stage: Stage): 'moved' | 'blocked' | 'needs-hire-form' {
  const card = cardOf(state, studentId)
  if (!card || card.stage === stage) return 'moved'
  if (card.stage === 'hired') {
    toast('to.hiredlocked', undefined, 'warn')
    return 'blocked'
  }
  if (stage === 'intro' && card.intro === 'none') {
    requestIntro(studentId)
    return 'moved'
  }
  if (['interview', 'offer', 'hired'].includes(stage) && card.intro !== 'accepted') {
    toast('to.needintro', { name: first(studentId) }, 'warn')
    return 'blocked'
  }
  if (stage === 'hired') return 'needs-hire-form'
  transition(() => set((s) => ({ cards: s.cards.map((c) => (c.studentId === studentId ? { ...c, stage } : c)) })))
  return 'moved'
}

/** report_hire: creates the placement and both invoices; the student still has to confirm. */
export function reportHire(studentId: string, salary: number, start: string) {
  const fp = feePlan(salary, start)
  const id = 'p' + (state.placements.length + 1)
  const roleId = cardOf(state, studentId)?.roleId ?? state.rankRoleId
  transition(() =>
    set((s) => ({
      cards: s.cards.map((c) => (c.studentId === studentId ? { ...c, stage: 'hired' } : c)),
      placements: [...s.placements, { id, studentId, company: COMPANY.name, roleId, salary, start, status: 'awaiting' }],
      invoices: [
        ...s.invoices,
        { id: id + 'a', kind: 'half1', amount: fp.firstHalf, due: fp.firstDue, status: 'scheduled', placementId: id },
        { id: id + 'b', kind: 'half2', amount: fp.secondHalf, due: fp.secondDue, status: 'scheduled', placementId: id },
      ],
    })),
  )
  if (studentId !== ME_STUDENT) setTimeout(() => confirmHire(id, true), 3600)
  return id
}

/** confirm_hire: the second signature. Activates the placement and the first invoice. */
export function confirmHire(placementId: string, confirmed: boolean) {
  const p = state.placements.find((x) => x.id === placementId)
  if (!p || p.status !== 'awaiting') return
  transition(() =>
    set((s) => ({
      placements: s.placements.map((x) => (x.id === placementId ? { ...x, status: confirmed ? 'active' : 'disputed' } : x)),
      invoices: s.invoices.map((i) => (i.placementId === placementId && i.kind === 'half1' && confirmed ? { ...i, status: 'due' } : i)),
    })),
  )
  if (state.viewer === 'company') toast(confirmed ? 'to.hireconfirmed' : 'to.hiredisputed', { name: first(p.studentId) }, confirmed ? 'ok' : 'warn')
}

/** report_departure: inside the guarantee the unpaid second half is cancelled. */
export function reportDeparture(placementId: string) {
  const p = state.placements.find((x) => x.id === placementId)
  if (!p) return
  const inGuarantee = TODAY <= addDays(p.start, 90)
  transition(() =>
    set((s) => ({
      placements: s.placements.map((x) => (x.id === placementId ? { ...x, status: 'left' } : x)),
      invoices: s.invoices.map((i) => (i.placementId === placementId && i.status !== 'paid' && inGuarantee ? { ...i, status: 'void' } : i)),
    })),
  )
  const cancelled = state.invoices.filter((i) => i.placementId === placementId && i.status === 'void').reduce((a, i) => a + i.amount, 0)
  if (inGuarantee && cancelled) toast('to.departure.in', { sum: cancelled }, 'info') // `sum` is formatted as money by the toast
  else toast('to.departure.out', undefined, 'info')
}

export function payInvoice(id: string) {
  set((s) => ({ invoices: s.invoices.map((i) => (i.id === id ? { ...i, status: 'paid' } : i)) }))
  toast('to.paid')
}
export function changePlan(code: State['plan']) {
  transition(() => set({ plan: code }))
  toast('to.plan', { plan: PLANS.find((p) => p.code === code)!.name })
}
export function addRole(role: Omit<Role, 'id'>): boolean {
  const plan = planOf(state)
  if (plan.roles !== null && state.roles.length >= plan.roles) {
    toast('to.rolelimit', { plan: plan.name, n: plan.roles }, 'warn')
    return false
  }
  const id = 'r' + Date.now()
  transition(() => set((s) => ({ roles: [...s.roles, { ...role, id }], rankRoleId: id })))
  toast('to.roleopen', { role: role.title ?? '' })
  return true
}
export function closeRole(id: string) {
  if (state.roles.length === 1) return toast('to.keeprole', undefined, 'warn')
  transition(() => set((s) => ({ roles: s.roles.filter((r) => r.id !== id), rankRoleId: s.rankRoleId === id ? s.roles.find((r) => r.id !== id)!.id : s.rankRoleId })))
}

// ── student actions ──────────────────────────────────────────────
export function setVisible(v: boolean) {
  set({ visible: v })
  toast(v ? 'to.visible.on' : 'to.visible.off', undefined, 'info')
}
export function respondExternal(id: string, accept: boolean) {
  transition(() => set((s) => ({ external: s.external.map((e) => (e.id === id ? { ...e, status: accept ? 'accepted' : 'declined' } : e)) })))
  const company = JOBS.find((j) => j.id === state.external.find((x) => x.id === id)!.jobId)!.company!
  toast(accept ? 'to.ext.accept' : 'to.ext.decline', { company }, accept ? 'ok' : 'info')
}
/** set_interest: the student tells a company a role interests them; the employer sees a flag. */
export function toggleInterest(roleId: string) {
  const on = isInterested(state, ME_STUDENT, roleId)
  set((s) => ({ interest: on ? s.interest.filter((i) => !(i.studentId === ME_STUDENT && i.roleId === roleId)) : [...s.interest, { studentId: ME_STUDENT, roleId }] }))
  const job = jobOf(state, roleId)
  if (on) toast('to.interest.off', undefined, 'info')
  else toast('to.interest.on', { company: job?.company ?? COMPANY.name })
}
export function savePrefs(salary: number, openTo: Employment[]) {
  set((s) => ({ students: s.students.map((x) => (x.id === ME_STUDENT ? { ...x, salary, openTo } : x)) }))
  toast('to.prefs')
}

// ── career office actions ────────────────────────────────────────
export function reviewCompany(id: string, approve: boolean) {
  transition(() =>
    set((s) => ({ companies: approve ? s.companies.map((c) => (c.id === id ? { ...c, status: 'approved' as const } : c)) : s.companies.filter((c) => c.id !== id) })),
  )
  toast(approve ? 'to.co.approved' : 'to.co.rejected', undefined, approve ? 'ok' : 'info')
}
