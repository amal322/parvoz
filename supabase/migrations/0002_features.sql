-- Parvoz · interviews, student interest, team notes, profile views, interface language
begin;
set local search_path = parvoz; -- for this transaction only

alter table profiles add column lang text not null default 'uz' check (lang in ('uz', 'ru', 'en'));

-- ───────────────────────────────────────── interviews
create table interviews (
  id           uuid primary key default gen_random_uuid(),
  intro_id     uuid not null unique references intros (id) on delete cascade,
  company_id   uuid not null references companies (id) on delete cascade,
  student_id   uuid not null references students (id) on delete cascade,
  slots        timestamptz[] not null check (cardinality(slots) between 1 and 3),
  scheduled_at timestamptz,                     -- the slot the student picked
  created_at   timestamptz not null default now()
);

-- the employer offers up to three times; only after the student accepted the intro
create function propose_interview(student uuid, slots timestamptz[])
  returns uuid language plpgsql security definer set search_path = parvoz as $$
declare
  i intros%rowtype;
  new_id uuid;
begin
  select * into i from intros
   where company_id = my_company() and student_id = student and status = 'accepted';
  if not found then
    raise exception 'The student has not accepted an intro yet';
  end if;
  if cardinality(slots) not between 1 and 3 then
    raise exception 'Offer one to three interview times';
  end if;
  insert into interviews (intro_id, company_id, student_id, slots)
  values (i.id, i.company_id, student, slots)
  on conflict (intro_id) do update set slots = excluded.slots, scheduled_at = null
  returning id into new_id;
  perform log_event('interview_proposed', 'interviews', new_id, jsonb_build_object('slots', cardinality(slots)));
  return new_id;
end $$;

-- the student picks one of the offered times
create function pick_interview(interview uuid, slot timestamptz)
  returns void language plpgsql security definer set search_path = parvoz as $$
begin
  update interviews set scheduled_at = slot
   where id = interview and student_id = my_student() and slot = any (slots);
  if not found then
    raise exception 'Choose one of the offered times';
  end if;
  update pipeline p set stage = 'interview'
    from interviews v
   where v.id = interview and p.company_id = v.company_id and p.student_id = v.student_id and p.stage = 'intro';
  perform log_event('interview_scheduled', 'interviews', interview, jsonb_build_object('at', slot));
end $$;

-- ───────────────────────────────────────── student interest in a role
create table role_interest (
  role_id    uuid not null references job_roles (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, student_id)
);

-- an interested student sees open roles of approved companies; nothing else about the company
create view open_roles as
  select r.id, r.title, r.schools, r.skills, r.employment, r.salary_min, r.salary_max, c.name as company, c.industry
  from job_roles r
  join companies c on c.id = r.company_id and c.status = 'approved'
  where r.open and my_role() = 'student';

create function set_interest(role uuid, interested boolean)
  returns void language plpgsql security definer set search_path = parvoz as $$
begin
  if my_role() <> 'student' then
    raise exception 'Only students can mark interest';
  end if;
  if interested then
    insert into role_interest (role_id, student_id) values (role, my_student()) on conflict do nothing;
  else
    delete from role_interest where role_id = role and student_id = my_student();
  end if;
end $$;

-- ───────────────────────────────────────── notes a hiring team keeps on a candidate
create table candidate_notes (
  company_id uuid not null references companies (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  body       text not null default '',
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now(),
  primary key (company_id, student_id)
);

-- ───────────────────────────────────────── profile views (the student sees a count, never who)
create table profile_views (
  id         bigserial primary key,
  company_id uuid not null references companies (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  viewed_at  timestamptz not null default now()
);

create function record_view(student uuid)
  returns void language sql security definer set search_path = parvoz as
  $$ insert into profile_views (company_id, student_id)
     select my_company(), student where has_access() $$;

create function my_view_count(days int default 28)
  returns bigint language sql stable security definer set search_path = parvoz as
  $$ select count(distinct company_id) from profile_views
     where student_id = my_student() and viewed_at >= now() - make_interval(days => days) $$;

-- ───────────────────────────────────────── row level security
alter table interviews      enable row level security;
alter table role_interest   enable row level security;
alter table candidate_notes enable row level security;
alter table profile_views   enable row level security;

create policy interviews_read on interviews for select using (is_member(company_id) or student_id = my_student() or is_office());
-- written only through propose_interview / pick_interview

create policy interest_read on role_interest for select using (
  student_id = my_student() or is_office()
  or exists (select 1 from job_roles r where r.id = role_id and is_member(r.company_id)));
-- written only through set_interest

create policy notes_team on candidate_notes for all using (is_member(company_id)) with check (is_member(company_id));
-- students and the office never read team notes

create policy views_office on profile_views for select using (is_office());
-- students read a count through my_view_count()

grant select, insert, update, delete on interviews, role_interest, candidate_notes, profile_views to authenticated;
grant usage, select on sequence profile_views_id_seq to authenticated;
grant select on open_roles to authenticated;
grant all on all tables in schema parvoz to service_role;
grant all on all sequences in schema parvoz to service_role;
revoke execute on all functions in schema parvoz from public;
grant execute on all functions in schema parvoz to authenticated, service_role;
revoke execute on function log_event(text, text, uuid, jsonb) from authenticated;

commit;
