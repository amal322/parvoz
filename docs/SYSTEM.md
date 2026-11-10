# Parvoz: system design

Parvoz ("takeoff" in Uzbek) is the hiring platform of Central Asian University. Companies subscribe to
reach students, and pay a placement fee of three gross monthly salaries for each student they hire.
The candidate base is the existing CAU Digital CV.

## 1. Benchmarks and what was taken from each

| Benchmark | How it earns | What Parvoz takes | What Parvoz does differently |
|---|---|---|---|
| Handshake (US, 18M students, 1,600+ universities) | Universities pay about $8k a year, employers have a free tier and premium from $15k a year. No success fee. | Students never pay. The university supplies the verified base. Employer tiers by seats and reach. | Adds a success fee, so revenue follows hires, not only seats. |
| hh.uz (239k active CVs, about 33k vacancies a quarter) | Paid vacancy posts (66k to 164k UZS in the 2023 price list) and paid CV database access. | Subscription for database access is a habit Uzbek HR teams already have. | Records are verified by the registrar, not self-written. |
| Recruiting agencies | 15 to 22% of annual salary for general roles, 20 to 30% for IT. Guarantee of 60 to 90 days. Paid on hire. | Success fee, 90-day guarantee. | Fee is split in two, and the second half is tied to the guarantee. |
| Hired / Wellfound | Companies apply to candidates, salary shown up front. | Intro requests carry the role and salary range. The student decides. | Contacts stay closed until the student accepts. |

Three monthly salaries equal 25% of annual salary. That sits at the top of the agency range for
general roles, and it is charged on top of a subscription, which agencies do not have. See section 8.

Design benchmark: Awwwards scores design 40%, usability 30%, creativity 20%, content 10%. Jurors
reward one clear point of view, motion that is choreographed and continuous between screens, and
60 fps on mid-range phones.

Visual direction, set after reviewing extrafazant.nl (Awwwards nominee): paper ground with black
bands, one electric blue, and display type that pairs a heavy grotesque with a narrow serif in the
same headline. The recurring object is a print-like student card on its school colour (blue for
Engineering, yellow for Business, green for Medicine, pink for Dentistry). Motion: an opening
curtain with a counter, headline lines rising out of masks, cards dealt onto the hero and draggable,
steps that stack as you scroll, digits that roll in the fee calculator.

## 2. Roles

- **Student.** Opts in to be visible. Sees who asks for an intro, with role and salary range. Accepts
  or declines. Confirms a reported hire. Pays nothing.
- **Employer.** Subscribes. Opens roles, ranks students for a role, shortlists, requests intros, runs a
  pipeline, reports hires, pays invoices.
- **Career office.** Approves companies, sees revenue and the funnel, keeps the placement ledger,
  reviews disputes and attribution cases.

### Features by role

| Employer | Student | Career office |
|---|---|---|
| Talent base ranked for a role, with filters and sort | Visibility switch | Revenue by month, subscriptions and fees |
| Compare up to three candidates | Intro requests: accept or decline | Funnel from visible profile to hire |
| Profile with verified record and match breakdown | Pick one of the offered interview times | Graduate outcomes by school |
| Profile charts: six-measure radar against the school, GPA by semester, place in the school, skill levels | The same charts on the student's own profile, with what to raise first | Skills: demand from open roles against supply among students |
| Salary expectation against the role's range | | |
| Team note on a candidate | Confirm or dispute a reported hire | Placement ledger with guarantee status |
| Intro request, then interview times | Jobs ranked for the student, "I am interested" | Attribution checks |
| Pipeline with drag and drop | Profile views (a count, never who) | Company approval |
| Open roles, with interested students counted | CV score breakdown and a tip to raise it | |
| Billing, guarantees, invoices | Salary and work type preferences | |

Languages: Uzbek, Russian, English. The choice is stored per user (`profiles.lang`).

## 3. The hiring flow

1. A company applies and signs the service agreement. The career office approves it.
2. The company opens a role: title, schools, skills, type, salary range.
3. The board ranks every visible student for that role (section 5).
4. The company requests an intro. This uses one intro from the monthly limit and starts a
   12-month attribution window for that company and student.
5. The student accepts or declines. Only acceptance opens email and Telegram.
6. Interview and offer happen outside the platform. The company moves the card along the pipeline.
   A card cannot pass "Intro requested" before the student accepts.
7. The company reports the hire with the gross monthly salary and first working day.
8. The student confirms. The placement becomes active and the first invoice becomes due.
9. Day 90: if the hire is still employed, the second invoice is due. If not, it is cancelled.

## 4. Money

**Subscription** (per month, before VAT; a proposal to calibrate with five to ten pilot companies):

| | Scout | Team | Campus Partner |
|---|---|---|---|
| Price | 2.4M UZS | 6.9M UZS | 18M UZS, billed yearly |
| Seats | 1 | 5 | Unlimited |
| Intros per month | 10 | 40 | Unlimited |
| Open roles | 1 | 10 | Unlimited |
| Early access to graduates | No | No | 14 days |

**Placement fee** = 3 × gross monthly salary in the signed offer.

- First half: due 10 days after the first working day.
- Second half: due on day 90, only if the hire is still employed.
- Guarantee: 90 days. It matches the three-month probation limit most employers use.
- Internships carry no fee. The fee applies when an intern moves to a full-time contract.
- Example: salary 11M UZS, fee 33M UZS, two invoices of 16.5M UZS.

## 5. Ranking

`match = 50% skills + 15% school + 15% Digital CV score + 10% GPA + 10% availability`

- Skills: share of the role's skills the student has.
- School: 1 if the role lists the student's school, otherwise 0.35.
- Digital CV score: score / 1000. GPA: gpa / 4.
- Availability: 1 if the student is open to the role's employment type, otherwise 0.4.

The formula is shown to employers on every profile, so the ranking can be questioned.
Code: `src/data/logic.ts`.

### What the profile charts show

Six measures share one 0 to 100 scale so they can sit on one radar: academics (GPA out of 4),
skills (average verified level out of 5), projects and campus activity (their parts of the Digital CV
score, out of 280 and 160), English (IELTS out of 9) and attendance. The dashed outline is the average
of the student's school. The same record feeds GPA by semester, the student's place among the school's
Digital CV scores, and a level for each skill. Code: `src/data/insight.ts`, `src/ui/charts.tsx`.
In the prototype this record is generated; in production it comes from the registrar feed (migration 0003).

## 6. How the fee is protected

The fee only works if hires cannot quietly move off the platform. Controls, in order of strength:

1. **Contacts are closed.** Employers read a view with no email, phone or Telegram. Contacts come
   from a function that checks for an accepted intro.
2. **Every intro is logged** with a 12-month attribution window. This is the evidence for a fee claim.
3. **Two signatures.** The company reports, the student confirms. A student can dispute.
4. **Cross-check.** The career office compares the alumni employment survey with intro records and
   opens a case when a student works at a company that was introduced but reported no hire.
5. **Contract.** The service agreement should set the fee, the attribution window and a penalty for
   an unreported hire. A lawyer needs to draft this clause.

## 7. Data model

Everything lives in the Postgres schema `parvoz`. Students are loaded from the registrar before they
ever sign in; `students.user_id` links a login later, by email, through `claim_student()`.

Tables: `profiles`, `companies`, `company_members`, `plans`, `subscriptions`, `students`, `skills`,
`student_skills`, `projects`, `job_roles`, `intros`, `pipeline`, `placements`, `invoices`, `audit_log`,
`interviews`, `role_interest`, `candidate_notes`, `profile_views`, `student_terms`.

Rules enforced in the database, not in the browser:

| Rule | Where |
|---|---|
| A visitor without an account reads counts and plans, nothing else | `public_stats()`, grants |
| Employers never read `students`; they read the `talent` view | RLS + view |
| Only approved companies with an active subscription see talent | `has_access()` |
| Students cannot edit GPA, attendance, score or school | `guard_verified_fields` trigger |
| Intro limit per plan and period | `request_intro()` |
| No interview, offer or hire before the student accepts | `guard_pipeline_stage` trigger |
| Fee is 3 × salary, guarantee is start + 90 days | generated columns on `placements` |
| Two invoices are created with the hire | `report_hire()` |
| Only the student can confirm a hire | `confirm_hire()` |
| Leaving inside the guarantee cancels the second half | `report_departure()` |
| Every action is recorded | `audit_log` |
| Interview times only after an accepted intro, one to three per offer | `propose_interview()` |
| Only the student picks the time, and only from the offered ones | `pick_interview()` |
| Only students mark interest in a role | `set_interest()` |
| Team notes are visible to that company only | RLS on `candidate_notes` |
| A student sees how many companies viewed the profile, never which | `my_view_count()` |
| Semester grades, skill levels and score parts are written by the registrar feed, never by the student | RLS on `student_terms`, `sskills_self`, guard trigger |
| School averages are aggregates over opted-in students; a semester average needs three students | `cohort_stats()`, `cohort_terms()`, `school_scores()` |

`npm run check:sql` applies the migrations to an in-process Postgres and plays a full hire with
61 assertions on these rules, including the seed and `supabase/verify.sql`. The same verify script
ran on the deployed database and passed 14 of 14.

## 8. Open decisions

1. **Price level.** Subscription plus 25% of annual salary is more than either a job board or an
   agency charges alone. Graduate salaries in Uzbekistan average about 4.9M UZS, so many fees will be
   15 to 30M UZS. Options if pilots push back: credit one month of subscription against each fee,
   or drop the fee to two salaries for Campus Partners.
0. **Shared Supabase project.** The free plan was full, so Parvoz sits in schema `parvoz` of the
   `cau-pgc` project next to the problem registry. Its tables are separate, but sign-in users are
   shared. Move it to its own project before real students or employers sign in.
2. **Where the data lives.** Uzbekistan's personal data law requires personal data of its citizens
   to be processed on servers located in the country. Supabase Cloud has no region there. Check this
   with a lawyer before real student data is loaded. Supabase can be self-hosted on a local server
   with the same schema.
3. **Consent.** Students must opt in before employers see them. The schema stores the consent time.
   The consent text needs legal review.
4. **Feed from the Digital CV.** GPA, attendance and score need a nightly sync from the registrar and
   the CAU App. The sync writes with the service role, so the guard trigger lets it through.
6. **Student photos.** The prototype uses illustrated portraits. Real photos need the students'
   consent to show them to employers, and a decision on whether a photo is shown before an intro is
   accepted (some universities hide photos until then to reduce bias).
7. **Uzbek copy.** It was written without a native speaker's review.
5. **Payments.** Invoices are records only. Paying by bank transfer and marking as paid by the career
   office is enough for the pilot; Payme, Click or bank acquiring can follow.

## 9. Sources

- Handshake business model: https://sacra.com/c/handshake/
- Agency fees and guarantees: https://www.leonar.app/blog/how-much-do-recruitment-agencies-charge/
- hh.uz market, Q3 2025: https://www.spot.uz/ru/2025/10/09/job-search/
- hh.uz vacancy prices, 2023: https://hh.uz/article/31019
- Wages in Uzbekistan, Jan to Sep 2026: https://www.spot.uz/ru/2026/10/27/wages
- Graduate pay: https://daryo.uz/ru/2026/08/27/uzbekistan-zarplata-vypusknikov-vuzov
- Awwwards evaluation: https://awwwards.com/about-evaluation
- Juror notes on 2026 winners: https://www.hontran.dev/blog/best-award-winning-websites-2026
- Style reference: https://www.extrafazant.nl/ (Awwwards nominee, design by Dylan Brouwer)
