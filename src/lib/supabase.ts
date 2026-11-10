// Live backend. The prototype runs on src/data/store.ts (in-memory); each function here is the
// Supabase call that replaces one store action. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use it.
// These calls match the SQL in supabase/migrations, which is covered by `npm run check:sql`.
// Live today: publicStats on the landing page. The role screens still run on the demo store.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// every Parvoz table and function lives in the `parvoz` schema
export const supabase = url && key ? (createClient(url, key, { db: { schema: 'parvoz' } }) as unknown as SupabaseClient) : null
export const isLive = supabase !== null

function client(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.')
  return supabase
}
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, args)
  if (error) throw new Error(error.message) // messages are written for the user in the SQL functions
  return data as T
}

export interface PublicStats {
  students: number
  by_school: Partial<Record<'engineering' | 'business' | 'medical' | 'dental', number>>
  open_roles: number
  companies: number
}

export const api = {
  /** Counts for the public site. The only call that works without signing in. */
  publicStats: () => rpc<PublicStats>('public_stats', {}),
  claimStudent: () => rpc<string | null>('claim_student', {}),
  signIn: (email: string) => client().auth.signInWithOtp({ email }),
  signOut: () => client().auth.signOut(),

  /** Employers read the talent view: opted-in students, no contacts. */
  async talent() {
    const { data, error } = await client().from('talent').select('*').order('cv_rank')
    if (error) throw new Error(error.message)
    return data
  },
  contact: (student: string) => rpc<{ email: string; phone: string; telegram: string }[]>('student_contact', { student }),

  requestIntro: (student: string, role?: string, message?: string) => rpc<string>('request_intro', { student, role: role ?? null, message: message ?? null }),
  respondIntro: (intro: string, accept: boolean) => rpc<void>('respond_intro', { intro, accept }),
  reportHire: (student: string, monthlySalary: number, starts: string, role?: string) =>
    rpc<string>('report_hire', { student, monthly_salary: monthlySalary, starts, role: role ?? null }),
  confirmHire: (placement: string, confirmed: boolean) => rpc<void>('confirm_hire', { placement, confirmed }),
  reportDeparture: (placement: string, leftDate: string) => rpc<string>('report_departure', { placement, left_date: leftDate }),

  proposeInterview: (student: string, slots: string[]) => rpc<string>('propose_interview', { student, slots }),
  pickInterview: (interview: string, slot: string) => rpc<void>('pick_interview', { interview, slot }),
  setInterest: (role: string, interested: boolean) => rpc<void>('set_interest', { role, interested }),
  recordView: (student: string) => rpc<void>('record_view', { student }),
  myViewCount: (days = 28) => rpc<number>('my_view_count', { days }),
  async openRoles() {
    const { data, error } = await client().from('open_roles').select('*')
    if (error) throw new Error(error.message)
    return data
  },
  async saveNote(companyId: string, studentId: string, body: string) {
    const { error } = await client().from('candidate_notes').upsert({ company_id: companyId, student_id: studentId, body })
    if (error) throw new Error(error.message)
  },

  async movePipeline(student: string, stage: string) {
    const { error } = await client().from('pipeline').update({ stage }).eq('student_id', student)
    if (error) throw new Error(error.message)
  },
  async setVisible(studentId: string, visible: boolean) {
    const { error } = await client().from('students').update({ visible }).eq('id', studentId)
    if (error) throw new Error(error.message)
  },
}
