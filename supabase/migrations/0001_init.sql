-- Parvoz · initial schema
-- Hiring marketplace on top of the CAU Digital CV.
-- Everything lives in its own schema, `parvoz`, so it can share a Supabase project with other apps
-- without touching their tables. Expose the schema under Settings → Data API → Exposed schemas.
-- Rules encoded here:
--   * employers never read the students table directly; they read the `talent` view (no contacts)
--   * contacts unlock only after the student accepts an intro
--   * an intro starts a 12-month attribution window for the placement fee
--   * placement fee = 3 x gross monthly salary, invoiced 50% at start + 10 days and 50% at day 90
--   * if the hire leaves within 90 days, the unpaid second half is voided


begin;
create schema if not exists parvoz;
set local search_path = parvoz; -- for this transaction only

-- ───────────────────────────────────────── types
create type user_role        as enum ('student', 'employer', 'office');
create type school           as enum ('engineering', 'business', 'medical', 'dental');
create type employment_type  as enum ('full_time', 'internship', 'part_time');
create type company_status   as enum ('pending', 'approved', 'suspended');
create type intro_status     as enum ('requested', 'accepted', 'declined', 'expired');
create type pipeline_stage   as enum ('shortlisted', 'intro', 'interview', 'offer', 'hired', 'closed');
create type placement_status as enum ('awaiting_student', 'active', 'passed', 'left_in_guarantee', 'disputed');
create type invoice_kind     as enum ('subscription', 'placement_first_half', 'placement_second_half');
create type invoice_status   as enum ('scheduled', 'due', 'paid', 'void');

-- ───────────────────────────────────────── identity
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       user_role not null,
  full_name  text not null,
  created_at timestamptz not null default now()
);

create table companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  tin        text unique,                       -- taxpayer number (INN / STIR)
  industry   text,
  status     company_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table company_members (
  company_id uuid not null references companies (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  is_admin   boolean not null default false,
  primary key (company_id, user_id)
);

-- ───────────────────────────────────────── subscription
create table plans (
  code              text primary key,
  name              text not null,
  monthly_price_uzs bigint not null,
  seats             int,          -- null = unlimited
  intros_per_month  int,          -- null = unlimited
  open_roles        int,          -- null = unlimited
  early_access_days int not null default 0
);

insert into plans (code, name, monthly_price_uzs, seats, intros_per_month, open_roles, early_access_days) values
  ('scout',   'Scout',          2400000,  1,    10,   1,    0),
  ('team',    'Team',           6900000,  5,    40,   10,   0),
  ('partner', 'Campus Partner', 18000000, null, null, null, 14);

create table subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies (id) on delete cascade,
  plan_code            text not null references plans (code),
  active               boolean not null default true,
  current_period_start date not null default current_date,
  current_period_end   date not null default (current_date + 30)
);
create unique index one_active_subscription on subscriptions (company_id) where active;

-- ───────────────────────────────────────── candidates
-- students are loaded from the registrar before they ever sign in; user_id links the login later
create table students (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid unique references auth.users (id) on delete set null,
  student_no             text unique not null,
  full_name              text not null,
  school                 school not null,
  program                text not null,
  year_of_study          int not null check (year_of_study between 1 and 7),
  grad_year              int not null,
  headline               text,
  -- verified by the university; students cannot edit these (see guard trigger)
  gpa                    numeric(3, 2) check (gpa between 0 and 4),
  attendance_pct         int check (attendance_pct between 0 and 100),
  cv_score               int not null default 0 check (cv_score between 0 and 1000),
  -- set by the student
  open_to                employment_type[] not null default '{}',
  available_from         date,
  salary_expectation_uzs bigint,
  visible                boolean not null default false,
  consent_at             timestamptz,           -- consent to show the profile to employers
  english                text,
  langs                  text[] not null default '{}',
  portrait               text,                  -- demo placeholder key; real photos go to photo_url
  photo_url              text,
  -- contacts, never exposed through the talent view
  email                  text,
  phone                  text,
  telegram               text
);

create table skills (
  id   serial primary key,
  name text unique not null
);

create table student_skills (
  student_id uuid not null references students (id) on delete cascade,
  skill_id   int  not null references skills (id) on delete cascade,
  verified   boolean not null default false,    -- confirmed by a graded course or project
  primary key (student_id, skill_id)
);

create table projects (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students (id) on delete cascade,
  title       text not null,
  summary     text,
  verified_by text                               -- faculty member who graded it
);
create unique index projects_once on projects (student_id, title);

-- ───────────────────────────────────────── hiring
create table job_roles (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  title      text not null,
  schools    school[] not null default '{}',
  skills     text[] not null default '{}',
  employment employment_type not null default 'full_time',
  salary_min bigint,
  salary_max bigint,
  open       boolean not null default true,
  created_at timestamptz not null default now()
);

create table intros (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references companies (id) on delete cascade,
  student_id        uuid not null references students (id) on delete cascade,
  role_id           uuid references job_roles (id) on delete set null,
  requested_by      uuid not null references profiles (id),
  status            intro_status not null default 'requested',
  message           text,
  requested_at      timestamptz not null default now(),
  responded_at      timestamptz,
  attribution_until date not null,               -- requested_at + 12 months
  unique (company_id, student_id)
);

create table pipeline (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  role_id    uuid references job_roles (id) on delete set null,
  stage      pipeline_stage not null default 'shortlisted',
  updated_at timestamptz not null default now(),
  unique (company_id, student_id)
);

create table placements (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies (id),
  student_id           uuid not null references students (id),
  role_id              uuid references job_roles (id) on delete set null,
  intro_id             uuid not null references intros (id),
  monthly_salary_uzs   bigint not null check (monthly_salary_uzs > 0),
  fee_uzs              bigint generated always as (monthly_salary_uzs * 3) stored,
  start_date           date not null,
  guarantee_until      date generated always as (start_date + 90) stored,
  status               placement_status not null default 'awaiting_student',
  employer_reported_at timestamptz not null default now(),
  student_confirmed_at timestamptz,
  left_on              date,
  unique (company_id, student_id)
);

create table invoices (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies (id),
  placement_id uuid references placements (id),
  kind         invoice_kind not null,
  amount_uzs   bigint not null check (amount_uzs >= 0),
  due_date     date not null,
  status       invoice_status not null default 'scheduled',
  paid_at      timestamptz
);

create table audit_log (
  id        bigserial primary key,
  actor     uuid,
  action    text not null,
  entity    text not null,
  entity_id uuid,
  meta      jsonb not null default '{}',
  at        timestamptz not null default now()
);

-- ───────────────────────────────────────── helpers (security definer: no RLS recursion)
create function my_role() returns user_role
  language sql stable security definer set search_path = parvoz as
  $$ select role from profiles where id = auth.uid() $$;

create function is_office() returns boolean
  language sql stable security definer set search_path = parvoz as
  $$ select coalesce((select role = 'office' from profiles where id = auth.uid()), false) $$;

create function is_member(c uuid) returns boolean
  language sql stable security definer set search_path = parvoz as
  $$ select exists (select 1 from company_members where company_id = c and user_id = auth.uid()) $$;

create function my_company() returns uuid
  language sql stable security definer set search_path = parvoz as
  $$ select company_id from company_members where user_id = auth.uid() limit 1 $$;

create function my_student() returns uuid
  language sql stable security definer set search_path = parvoz as
  $$ select id from students where user_id = auth.uid() $$;

create function has_access() returns boolean
  language sql stable security definer set search_path = parvoz as
  $$ select exists (
       select 1
       from company_members m
       join companies c     on c.id = m.company_id and c.status = 'approved'
       join subscriptions s on s.company_id = c.id and s.active and s.current_period_end >= current_date
       where m.user_id = auth.uid()) $$;

create function log_event(action text, entity text, entity_id uuid, meta jsonb default '{}') returns void
  language sql security definer set search_path = parvoz as
  $$ insert into audit_log (actor, action, entity, entity_id, meta) values (auth.uid(), action, entity, entity_id, meta) $$;

-- ───────────────────────────────────────── what employers see: no contacts, opted-in students only
-- The view runs with its owner's rights on purpose: employers have no access to `students` itself,
-- and the WHERE clause is the gate.
create view talent as
  select s.id, s.full_name, s.school, s.program, s.year_of_study, s.grad_year, s.headline,
         s.gpa, s.attendance_pct, s.cv_score, s.open_to, s.available_from, s.salary_expectation_uzs,
         s.english, s.langs, s.portrait, s.photo_url,
         rank() over (order by s.cv_score desc) as cv_rank,
         coalesce((select array_agg(k.name order by k.name)
                   from student_skills ss join skills k on k.id = ss.skill_id
                   where ss.student_id = s.id), '{}') as skills
  from students s
  where s.visible and s.consent_at is not null and (has_access() or is_office());

-- contacts unlock only for a company whose intro the student accepted
create function student_contact(student uuid)
  returns table (email text, phone text, telegram text)
  language sql stable security definer set search_path = parvoz as
  $$ select s.email, s.phone, s.telegram
     from students s
     where s.id = student
       and exists (select 1 from intros i
                   where i.student_id = s.id and i.status = 'accepted' and is_member(i.company_id)) $$;

-- ───────────────────────────────────────── guards
-- students may not rewrite what the university verifies
create function guard_verified_fields() returns trigger
  language plpgsql set search_path = parvoz as $$
begin
  if not is_office() and auth.uid() is not null and (
       new.gpa is distinct from old.gpa
    or new.attendance_pct is distinct from old.attendance_pct
    or new.cv_score is distinct from old.cv_score
    or new.school is distinct from old.school
    or new.student_no is distinct from old.student_no
    or new.full_name is distinct from old.full_name
    -- the one allowed change: claim_student() links an unclaimed record to the caller
    or (new.user_id is distinct from old.user_id and not (old.user_id is null and new.user_id = auth.uid()))) then
    raise exception 'Verified fields can only be changed by the career office';
  end if;
  if new.visible and new.consent_at is null then
    new.consent_at := now();
  end if;
  return new;
end $$;
create trigger students_guard before update on students
  for each row execute function guard_verified_fields();

-- a candidate cannot move past "intro" until they have accepted it
create function guard_pipeline_stage() returns trigger
  language plpgsql set search_path = parvoz as $$
begin
  new.updated_at := now();
  if new.stage in ('interview', 'offer', 'hired') and not exists (
       select 1 from intros i
       where i.company_id = new.company_id and i.student_id = new.student_id and i.status = 'accepted') then
    raise exception 'The student has not accepted an intro yet';
  end if;
  return new;
end $$;
create trigger pipeline_guard before insert or update on pipeline
  for each row execute function guard_pipeline_stage();

-- ───────────────────────────────────────── actions (RPC)
create function request_intro(student uuid, role uuid default null, message text default null)
  returns uuid language plpgsql security definer set search_path = parvoz as $$
declare
  c uuid := my_company();
  quota int;
  used int;
  period_start date;
  new_id uuid;
begin
  if c is null or not has_access() then
    raise exception 'An active subscription is required to request intros';
  end if;
  if not exists (select 1 from students where id = student and visible) then
    raise exception 'This student is not open to employers';
  end if;

  select p.intros_per_month, s.current_period_start into quota, period_start
  from subscriptions s join plans p on p.code = s.plan_code
  where s.company_id = c and s.active;

  select count(*) into used from intros i
  where i.company_id = c and i.requested_at >= period_start;

  if quota is not null and used >= quota then
    raise exception 'Intro limit reached: % of % used this period', used, quota;
  end if;

  insert into intros (company_id, student_id, role_id, requested_by, message, attribution_until)
  values (c, student, role, auth.uid(), message, (current_date + interval '12 months')::date)
  returning id into new_id;

  insert into pipeline (company_id, student_id, role_id, stage)
  values (c, student, role, 'intro')
  on conflict (company_id, student_id) do update set stage = 'intro', role_id = excluded.role_id;

  perform log_event('intro_requested', 'intros', new_id, jsonb_build_object('student', student));
  return new_id;
end $$;

create function respond_intro(intro uuid, accept boolean)
  returns void language plpgsql security definer set search_path = parvoz as $$
begin
  update intros
     set status = case when accept then 'accepted' else 'declined' end::intro_status,
         responded_at = now()
   where id = intro and student_id = my_student() and status = 'requested';
  if not found then
    raise exception 'No pending intro to respond to';
  end if;
  perform log_event(case when accept then 'intro_accepted' else 'intro_declined' end, 'intros', intro);
end $$;

-- employer reports a hire; fee and both invoices are created here, not by the client
create function report_hire(student uuid, monthly_salary bigint, starts date, role uuid default null)
  returns uuid language plpgsql security definer set search_path = parvoz as $$
declare
  c uuid := my_company();
  i intros%rowtype;
  p placements%rowtype;
  half bigint;
begin
  select * into i from intros
   where company_id = c and student_id = student and status = 'accepted';
  if not found then
    raise exception 'No accepted intro with this student';
  end if;

  insert into placements (company_id, student_id, role_id, intro_id, monthly_salary_uzs, start_date)
  values (c, student, coalesce(role, i.role_id), i.id, monthly_salary, starts)
  returning * into p;

  half := p.fee_uzs / 2;
  insert into invoices (company_id, placement_id, kind, amount_uzs, due_date) values
    (c, p.id, 'placement_first_half',  half,             starts + 10),
    (c, p.id, 'placement_second_half', p.fee_uzs - half, p.guarantee_until);

  update pipeline set stage = 'hired' where company_id = c and student_id = student;
  perform log_event('hire_reported', 'placements', p.id,
                    jsonb_build_object('salary', monthly_salary, 'fee', p.fee_uzs));
  return p.id;
end $$;

-- second signature: the student confirms (or disputes) the reported hire
create function confirm_hire(placement uuid, confirmed boolean)
  returns void language plpgsql security definer set search_path = parvoz as $$
begin
  update placements
     set status = case when confirmed then 'active' else 'disputed' end::placement_status,
         student_confirmed_at = now()
   where id = placement and student_id = my_student() and status = 'awaiting_student';
  if not found then
    raise exception 'Nothing to confirm';
  end if;
  if confirmed then
    update invoices set status = 'due'
     where placement_id = placement and kind = 'placement_first_half' and status = 'scheduled';
  end if;
  perform log_event(case when confirmed then 'hire_confirmed' else 'hire_disputed' end, 'placements', placement);
end $$;

-- hire left: inside the 90-day guarantee the unpaid second half is voided
create function report_departure(placement uuid, left_date date)
  returns placement_status language plpgsql security definer set search_path = parvoz as $$
declare
  p placements%rowtype;
  result placement_status;
begin
  select * into p from placements where id = placement;
  if not found or not (is_member(p.company_id) or is_office()) then
    raise exception 'Placement not found';
  end if;
  if left_date <= p.guarantee_until then
    result := 'left_in_guarantee';
    update invoices set status = 'void'
     where placement_id = placement and kind = 'placement_second_half' and status <> 'paid';
  else
    result := 'passed';
  end if;
  update placements set status = result, left_on = left_date where id = placement;
  perform log_event('departure_reported', 'placements', placement, jsonb_build_object('left_on', left_date));
  return result;
end $$;

-- first sign-in of a student: link the login to the registrar record with the same email
create function claim_student()
  returns uuid language plpgsql security definer set search_path = parvoz as $$
declare
  mail text;
  sid uuid;
begin
  select email into mail from auth.users where id = auth.uid();
  update students set user_id = auth.uid()
   where lower(email) = lower(mail) and user_id is null
  returning id into sid;
  if sid is null then
    select id into sid from students where user_id = auth.uid();
  end if;
  if sid is not null then
    insert into profiles (id, role, full_name)
    select auth.uid(), 'student', full_name from students where id = sid
    on conflict (id) do nothing;
  end if;
  return sid;
end $$;

-- the only thing a visitor without an account can read: counts for the public site
create function public_stats()
  returns jsonb language sql stable security definer set search_path = parvoz as
  $$ select jsonb_build_object(
       'students',   (select count(*) from students where visible and consent_at is not null),
       'by_school',  (select coalesce(jsonb_object_agg(school, n), '{}'::jsonb)
                      from (select school, count(*) as n from students where visible and consent_at is not null group by school) t),
       'open_roles', (select count(*) from job_roles r join companies c on c.id = r.company_id and c.status = 'approved' where r.open),
       'companies',  (select count(*) from companies where status = 'approved')) $$;

-- ───────────────────────────────────────── row level security
alter table profiles        enable row level security;
alter table companies       enable row level security;
alter table company_members enable row level security;
alter table plans           enable row level security;
alter table subscriptions   enable row level security;
alter table students        enable row level security;
alter table skills          enable row level security;
alter table student_skills  enable row level security;
alter table projects        enable row level security;
alter table job_roles       enable row level security;
alter table intros          enable row level security;
alter table pipeline        enable row level security;
alter table placements      enable row level security;
alter table invoices        enable row level security;
alter table audit_log       enable row level security;

create policy profiles_self   on profiles for select using (id = auth.uid() or is_office());
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = my_role());

create policy companies_read   on companies for select using (is_member(id) or is_office());
create policy companies_office on companies for all using (is_office()) with check (is_office());

create policy members_read   on company_members for select using (user_id = auth.uid() or is_member(company_id) or is_office());
create policy members_office on company_members for all using (is_office()) with check (is_office());

create policy plans_read on plans for select using (true);

create policy subs_read   on subscriptions for select using (is_member(company_id) or is_office());
create policy subs_office on subscriptions for all using (is_office()) with check (is_office());

-- students: the owner and the office only. Employers go through the talent view.
create policy students_self   on students for select using (user_id = auth.uid() or is_office());
create policy students_update on students for update using (user_id = auth.uid() or is_office()) with check (user_id = auth.uid() or is_office());
create policy students_office on students for insert with check (is_office());

create policy skills_read on skills for select using (true);
create policy sskills_read on student_skills for select using (student_id = my_student() or is_office() or has_access());
create policy sskills_self on student_skills for insert with check (student_id = my_student() and not verified);
create policy sskills_del  on student_skills for delete using (student_id = my_student() and not verified);

create policy projects_read on projects for select using (student_id = my_student() or is_office() or has_access());
create policy projects_self on projects for insert with check (student_id = my_student() and verified_by is null);

create policy roles_read  on job_roles for select using (is_member(company_id) or is_office());
create policy roles_write on job_roles for all using (is_member(company_id)) with check (is_member(company_id));

create policy intros_read on intros for select using (is_member(company_id) or student_id = my_student() or is_office());
-- intros are written only through request_intro / respond_intro

create policy pipeline_all on pipeline for all using (is_member(company_id)) with check (is_member(company_id));
create policy pipeline_office on pipeline for select using (is_office());

create policy placements_read on placements for select using (is_member(company_id) or student_id = my_student() or is_office());
create policy invoices_read   on invoices for select using (is_member(company_id) or is_office());
create policy invoices_office on invoices for update using (is_office()) with check (is_office());

create policy audit_read on audit_log for select using (is_office());

-- ───────────────────────────────────────── grants
-- nothing is callable or readable unless granted here
grant usage on schema parvoz to authenticated, anon, service_role;
grant select on plans, skills to anon;
grant select, insert, update, delete on all tables in schema parvoz to authenticated;
grant usage, select on all sequences in schema parvoz to authenticated;
grant all on all tables in schema parvoz to service_role;
grant all on all sequences in schema parvoz to service_role;
revoke execute on all functions in schema parvoz from public;
grant execute on all functions in schema parvoz to authenticated, service_role;
grant execute on function public_stats() to anon;
-- the audit log is written by the functions above, never directly
revoke execute on function log_event(text, text, uuid, jsonb) from authenticated;

commit;
