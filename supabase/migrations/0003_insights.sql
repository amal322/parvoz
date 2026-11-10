-- Parvoz · 0003 · the record behind the profile charts
-- Semester grades, skill levels and the three parts of the Digital CV score, plus school averages.
-- Additive: no existing column or row is changed.
begin;
set local search_path = parvoz;

-- ───────────────────────────────────────── verified record, in more detail
-- Digital CV score = academics (up to 560) + projects (up to 280) + campus activity (up to 160)
alter table students
  add column score_academic int check (score_academic between 0 and 560),
  add column score_projects int check (score_projects between 0 and 280),
  add column score_activity int check (score_activity between 0 and 160);

-- 1 to 5, set by the grade for the course that teaches the skill
alter table student_skills add column level smallint check (level between 1 and 5);

create table student_terms (
  student_id     uuid not null references students (id) on delete cascade,
  term           smallint not null check (term between 1 and 14),
  gpa            numeric(3, 2) not null check (gpa between 0 and 4),
  attendance_pct int check (attendance_pct between 0 and 100),
  primary key (student_id, term)
);

-- is this student shown to employers?
create function is_listed(student uuid) returns boolean
  language sql stable security definer set search_path = parvoz as
  $$ select exists (select 1 from students s where s.id = student and s.visible and s.consent_at is not null) $$;

-- ───────────────────────────────────────── who reads and writes it
alter table student_terms enable row level security;
create policy terms_read on student_terms for select using (
  student_id = my_student() or is_office() or (has_access() and is_listed(student_id)));
-- written by the registrar feed (service role) and the career office, never by the student
create policy terms_office on student_terms for all using (is_office()) with check (is_office());

-- a student may add a skill, but not grade it
drop policy sskills_self on student_skills;
create policy sskills_self on student_skills for insert with check (student_id = my_student() and not verified and level is null);

-- the score parts are verified fields too
create or replace function guard_verified_fields() returns trigger
  language plpgsql set search_path = parvoz as $$
begin
  if not is_office() and auth.uid() is not null and (
       new.gpa is distinct from old.gpa
    or new.attendance_pct is distinct from old.attendance_pct
    or new.cv_score is distinct from old.cv_score
    or new.score_academic is distinct from old.score_academic
    or new.score_projects is distinct from old.score_projects
    or new.score_activity is distinct from old.score_activity
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

-- ───────────────────────────────────────── what employers see
-- same view as before, with the score parts and skill levels added at the end
create or replace view talent as
  select s.id, s.full_name, s.school, s.program, s.year_of_study, s.grad_year, s.headline,
         s.gpa, s.attendance_pct, s.cv_score, s.open_to, s.available_from, s.salary_expectation_uzs,
         s.english, s.langs, s.portrait, s.photo_url,
         rank() over (order by s.cv_score desc) as cv_rank,
         coalesce((select array_agg(k.name order by k.name)
                   from student_skills ss join skills k on k.id = ss.skill_id
                   where ss.student_id = s.id), '{}') as skills,
         s.score_academic, s.score_projects, s.score_activity,
         coalesce((select jsonb_object_agg(k.name, ss.level)
                   from student_skills ss join skills k on k.id = ss.skill_id
                   where ss.student_id = s.id and ss.level is not null), '{}'::jsonb) as skill_levels
  from students s
  where s.visible and s.consent_at is not null and (has_access() or is_office());

-- ───────────────────────────────────────── school averages: the dashed outline on the charts
-- Aggregates only, over students who agreed to be shown. Open to subscribers, the office and students.
create function cohort_stats()
  returns table (school school, students int, gpa numeric, attendance_pct numeric, cv_score numeric, cv_median numeric,
                 score_academic numeric, score_projects numeric, score_activity numeric)
  language sql stable security definer set search_path = parvoz as
  $$ select s.school, count(*)::int, round(avg(s.gpa), 2), round(avg(s.attendance_pct), 1), round(avg(s.cv_score)),
            (percentile_cont(0.5) within group (order by s.cv_score))::numeric,
            round(avg(s.score_academic)), round(avg(s.score_projects)), round(avg(s.score_activity))
     from students s
     where s.visible and s.consent_at is not null and (has_access() or is_office() or my_student() is not null)
     group by s.school $$;

-- average GPA of a school in each semester, shown only where at least three students have one
create function cohort_terms()
  returns table (school school, term smallint, gpa numeric, students int)
  language sql stable security definer set search_path = parvoz as
  $$ select s.school, t.term, round(avg(t.gpa), 2), count(*)::int
     from student_terms t join students s on s.id = t.student_id
     where s.visible and s.consent_at is not null and (has_access() or is_office() or my_student() is not null)
     group by s.school, t.term
     having count(*) >= 3 $$;

-- the scores of one school without names: where a student stands among classmates
create function school_scores(of_school school) returns int[]
  language sql stable security definer set search_path = parvoz as
  $$ select coalesce(array_agg(s.cv_score order by s.cv_score), '{}')
     from students s
     where s.school = of_school and s.visible and s.consent_at is not null
       and (has_access() or is_office() or my_student() is not null) $$;

-- ───────────────────────────────────────── grants
grant select, insert, update, delete on student_terms to authenticated;
grant all on all tables in schema parvoz to service_role;
revoke execute on all functions in schema parvoz from public;
grant execute on all functions in schema parvoz to authenticated, service_role;
revoke execute on function log_event(text, text, uuid, jsonb) from authenticated;

commit;
