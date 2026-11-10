// Runs the migration on an in-process Postgres (PGlite) with a stub of Supabase's auth schema,
// then plays one hire end to end and checks the access rules and the fee maths.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const db = new PGlite()
const sql = (q) => db.exec(q)
const one = async (q) => (await db.query(q)).rows[0]
const as = (id) => sql(`reset role; select set_config('request.jwt.claim.sub', '${id}', false); set role authenticated;`)
const admin = () => sql(`reset role;`)
const anon = () => sql(`reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;`)

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`)
  if (!ok) failed++
}
const rejects = async (name, q) => {
  try { await sql(q); check(name, false, '(was allowed)') }
  catch (e) { check(name, true, `→ ${e.message}`) }
}

// stub of what Supabase provides
await sql(`
  create role authenticated; create role anon; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant select on auth.users to authenticated; -- stub only; Supabase keeps auth.users private
  grant usage on schema auth to authenticated, anon;
`)
for (const f of ['0001_init.sql', '0002_features.sql']) await sql(readFileSync(new URL('../supabase/migrations/' + f, import.meta.url), 'utf8'))
await sql('set search_path = parvoz')
check('migrations apply', true)

const U = { office: '00000000-0000-0000-0000-0000000000a1', hr: '00000000-0000-0000-0000-0000000000b1',
  rival: '00000000-0000-0000-0000-0000000000b2', stu: '00000000-0000-0000-0000-0000000000c1', hidden: '00000000-0000-0000-0000-0000000000c2',
  fresh: '00000000-0000-0000-0000-0000000000c3', unclaimed: '00000000-0000-0000-0000-0000000000e1' }
const C = { navro: '00000000-0000-0000-0000-0000000000d1', rival: '00000000-0000-0000-0000-0000000000d2' }

await sql(`
  insert into auth.users (id) values ('${U.office}'), ('${U.hr}'), ('${U.rival}'), ('${U.stu}'), ('${U.hidden}');
  insert into profiles (id, role, full_name) values
    ('${U.office}', 'office', 'Career Office'), ('${U.hr}', 'employer', 'Kamila Rashidova'),
    ('${U.rival}', 'employer', 'Rival HR'), ('${U.stu}', 'student', 'Dilnoza Yusupova'), ('${U.hidden}', 'student', 'Hidden Student');
  insert into companies (id, name, status) values ('${C.navro}', 'Navro Systems', 'approved'), ('${C.rival}', 'Rival LLC', 'approved');
  insert into company_members values ('${C.navro}', '${U.hr}', true), ('${C.rival}', '${U.rival}', true);
  insert into subscriptions (company_id, plan_code) values ('${C.navro}', 'scout');
  insert into students (id, user_id, student_no, full_name, school, program, year_of_study, grad_year, gpa, cv_score, visible, consent_at, email, phone)
    values ('${U.stu}', '${U.stu}', 'ENG-001', 'Dilnoza Yusupova', 'engineering', 'Data Science', 4, 2027, 3.8, 912, true, now(), 'dilnoza@example.edu', '+998 90 000 00 00'),
           ('${U.hidden}', '${U.hidden}', 'ENG-002', 'Hidden Student', 'engineering', 'Computer Science', 3, 2028, 3.1, 640, false, null, 'hidden@example.edu', null);
  -- loaded from the registrar, has never signed in
  insert into auth.users (id, email) values ('${U.fresh}', 'Madina@Example.edu');
  insert into students (id, student_no, full_name, school, program, year_of_study, grad_year, visible, consent_at, email)
    values ('${U.unclaimed}', 'BUS-900', 'Madina Tursunova', 'business', 'Finance', 4, 2027, true, now(), 'madina@example.edu');
`)

// visitor without an account
await anon()
const stats = (await one('select public_stats() as s')).s
check('visitor reads public counts only', stats.students === 2 && stats.by_school.engineering === 1 && stats.companies === 2, JSON.stringify(stats))
check('visitor reads plans', (await db.query('select * from plans')).rows.length === 3)
await rejects('visitor cannot read the talent view', 'select * from talent')
await rejects('visitor cannot call request_intro', `select request_intro('${U.stu}')`)

// first sign-in of a student the registrar loaded earlier
await as(U.fresh)
check('unclaimed student has no record yet', (await db.query('select * from students')).rows.length === 0)
check('sign-in links the record by email', (await one('select claim_student() as id')).id === U.unclaimed)
check('linked student sees own record and gets the student role',
  (await db.query('select * from students')).rows.length === 1 && (await one('select my_role() as r')).r === 'student')
await sql(`update students set user_id = '${U.fresh}' where id = '${U.stu}'`)
await admin()
check('a student cannot take over another record', (await one(`select user_id from students where id = '${U.stu}'`)).user_id === U.stu)
await as(U.fresh)
await rejects('audit log cannot be written directly', `select log_event('fake', 'placements', null)`)

// employer with a subscription
await as(U.hr)
check('employer cannot read students table', (await db.query('select * from students')).rows.length === 0)
const talent = (await db.query('select * from talent')).rows
check('talent view shows opted-in students only', talent.length === 2 && talent.every((r) => r.full_name !== 'Hidden Student'))
check('talent view has no contact columns', !('email' in talent[0]) && !('phone' in talent[0]))
check('contacts locked before intro', (await db.query(`select * from student_contact('${U.stu}')`)).rows.length === 0)
await rejects('hire without accepted intro is rejected', `select report_hire('${U.stu}', 10000000, '2026-12-01')`)
await rejects('intro to a hidden student is rejected', `select request_intro('${U.hidden}')`)
const intro = (await one(`select request_intro('${U.stu}') as id`)).id
await rejects('moving to interview before acceptance is rejected',
  `update pipeline set stage = 'interview' where student_id = '${U.stu}'`)

// employer without a subscription
await as(U.rival)
check('no subscription → empty talent view', (await db.query('select * from talent')).rows.length === 0)
await rejects('no subscription → cannot request intro', `select request_intro('${U.stu}')`)

// student
await as(U.stu)
await rejects('student cannot raise own GPA', `update students set gpa = 4.0 where id = '${U.stu}'`)
await sql(`update students set headline = 'Data analyst in training' where id = '${U.stu}'`)
check('student can edit own headline', true)
await sql(`select respond_intro('${intro}', true)`)

// employer again
await as(U.hr)
const contact = (await db.query(`select * from student_contact('${U.stu}')`)).rows
check('contacts unlock after acceptance', contact.length === 1 && contact[0].email === 'dilnoza@example.edu')
// interviews, notes, profile views (employer side)
await rejects('more than three interview times are rejected', `select propose_interview('${U.stu}', array['2026-11-11 10:00+05','2026-11-11 14:00+05','2026-11-12 10:00+05','2026-11-12 14:00+05']::timestamptz[])`)
const interview = (await one(`select propose_interview('${U.stu}', array['2026-11-11 10:00+05','2026-11-12 14:00+05']::timestamptz[]) as id`)).id
await sql(`insert into candidate_notes (company_id, student_id, body) values ('${C.navro}', '${U.stu}', 'Strong SQL, ask about the churn model')`)
await sql(`select record_view('${U.stu}')`)
const roleId = (await one(`insert into job_roles (company_id, title, schools, skills) values ('${C.navro}', 'Junior data analyst', '{engineering}', '{SQL,Python}') returning id`)).id
await rejects('employer cannot pick the interview time for the student', `select pick_interview('${interview}', '2026-11-11 10:00+05')`)
await rejects('employer cannot mark interest', `select set_interest('${roleId}', true)`)

await as(U.rival)
await rejects('interview without an accepted intro is rejected', `select propose_interview('${U.stu}', array['2026-11-11 10:00+05']::timestamptz[])`)
check('another company cannot read team notes', (await db.query('select * from candidate_notes')).rows.length === 0)

await as(U.stu)
check('student cannot read team notes', (await db.query('select * from candidate_notes')).rows.length === 0)
check('student sees how many companies viewed, not who', Number((await one('select my_view_count() as n')).n) === 1 && (await db.query('select * from profile_views')).rows.length === 0)
await rejects('a time that was not offered is rejected', `select pick_interview('${interview}', '2026-11-20 10:00+05')`)
await sql(`select pick_interview('${interview}', '2026-11-12 14:00+05')`)
check('student sees open roles and marks interest', (await db.query('select * from open_roles')).rows.length === 1)
await sql(`select set_interest('${roleId}', true)`)

await as(U.hr)
check('picked time is saved and the card moves to interview',
  (await one(`select scheduled_at is not null as ok from interviews where id = '${interview}'`)).ok &&
  (await one(`select stage from pipeline where student_id = '${U.stu}'`)).stage === 'interview')
check('employer sees the student\'s interest', (await db.query(`select * from role_interest where role_id = '${roleId}'`)).rows.length === 1)
check('employer does not see the student-side roles view', (await db.query('select * from open_roles')).rows.length === 0)

const placement = (await one(`select report_hire('${U.stu}', 11000000, '2026-12-01') as id`)).id
const p = await one(`select fee_uzs, guarantee_until::text, status from placements where id = '${placement}'`)
check('fee is 3 monthly salaries', Number(p.fee_uzs) === 33000000, `(${p.fee_uzs})`)
check('guarantee ends on day 90', p.guarantee_until === '2027-03-01', `(${p.guarantee_until})`)
const inv = (await db.query(`select kind, amount_uzs, due_date::text, status from invoices where placement_id = '${placement}' order by due_date`)).rows
check('two invoices of half the fee', inv.length === 2 && inv.every((r) => Number(r.amount_uzs) === 16500000))
check('first half due start + 10 days, second on day 90', inv[0].due_date === '2026-12-11' && inv[1].due_date === '2027-03-01')
await rejects('employer cannot confirm on the student\'s behalf', `select confirm_hire('${placement}', true)`)

await as(U.stu)
await sql(`select confirm_hire('${placement}', true)`)
await as(U.hr)
check('student confirmation activates placement and first invoice',
  (await one(`select status from placements where id = '${placement}'`)).status === 'active' &&
  (await one(`select status from invoices where placement_id = '${placement}' and kind = 'placement_first_half'`)).status === 'due')

const left = (await one(`select report_departure('${placement}', '2027-01-20') as s`)).s
check('leaving inside the guarantee voids the second half',
  left === 'left_in_guarantee' &&
  (await one(`select status from invoices where placement_id = '${placement}' and kind = 'placement_second_half'`)).status === 'void')

// intro quota (scout = 10 per period)
await admin()
await sql(`
  insert into auth.users (id) select ('00000000-0000-0000-0000-0000000001' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 10) g;
  insert into profiles (id, role, full_name) select ('00000000-0000-0000-0000-0000000001' || lpad(g::text, 2, '0'))::uuid, 'student', 'Student ' || g from generate_series(1, 10) g;
  insert into students (id, student_no, full_name, school, program, year_of_study, grad_year, visible, consent_at)
    select ('00000000-0000-0000-0000-0000000001' || lpad(g::text, 2, '0'))::uuid, 'BUS-' || g, 'Student ' || g, 'business', 'Finance', 4, 2027, true, now() from generate_series(1, 10) g;
`)
await as(U.hr)
for (let g = 1; g <= 9; g++) await sql(`select request_intro('00000000-0000-0000-0000-0000000001${String(g).padStart(2, '0')}')`)
await rejects('11th intro in the period hits the plan limit', `select request_intro('00000000-0000-0000-0000-000000000110')`)

await as(U.office)
check('office sees the audit trail', (await db.query('select * from audit_log')).rows.length >= 14)
check('office sees every student', (await db.query('select * from students')).rows.length === 13)

// demo data and the live-check script, on a clean database
await admin()
const seed = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8')
await sql(seed); await sql(seed) // twice: it must be safe to re-run
await sql('set search_path = parvoz')
const c = await one(`select (select count(*) from students where student_no ~ '^(ENG|BUS|MED|DEN)-[0-9]{4}$') as students, (select count(*) from companies where tin like 'DEMO-%') as companies,
  (select count(*) from job_roles r join companies c on c.id = r.company_id where c.tin like 'DEMO-%') as roles, (select count(*) from projects) as projects, (select count(*) from student_skills) as skills`)
check('seed loads once however often it runs', Number(c.students) === 36 && Number(c.companies) === 6 && Number(c.roles) === 7 && Number(c.projects) === 72, JSON.stringify(c))
let verdict = ''
try { await sql(readFileSync(new URL('../supabase/verify.sql', import.meta.url), 'utf8')) } catch (e) { verdict = e.message }
check('verify.sql passes and rolls itself back', /PARVOZ VERIFY 14\/14 passed/.test(verdict) && Number((await one(`select count(*) as n from companies where tin = 'VERIFY-0001'`)).n) === 0, verdict.split('\n')[0])
if (!/14\/14/.test(verdict)) console.log(verdict)

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
