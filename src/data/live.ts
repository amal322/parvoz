// What the public site reads from the real database: a few counts, no personal data.
import { useSyncExternalStore } from 'react'
import { api, isLive, type PublicStats } from '../lib/supabase'
import type { School } from './logic'

export interface LiveStats { students: number; bySchool: Record<School, number>; openRoles: number; companies: number }

let stats: LiveStats | null = null
let started = false
const listeners = new Set<() => void>()

function load() {
  if (started || !isLive) return
  started = true
  api.publicStats()
    .then((s: PublicStats) => {
      const b = s.by_school ?? {}
      stats = { students: s.students, bySchool: { eng: b.engineering ?? 0, bus: b.business ?? 0, med: b.medical ?? 0, den: b.dental ?? 0 }, openRoles: s.open_roles, companies: s.companies }
      listeners.forEach((l) => l())
    })
    .catch(() => { /* offline or blocked: the page keeps its demo figures */ })
}

/** null until the database answers, and for good when it cannot be reached. */
export function useLiveStats(): LiveStats | null {
  return useSyncExternalStore((l) => { listeners.add(l); load(); return () => listeners.delete(l) }, () => stats)
}
