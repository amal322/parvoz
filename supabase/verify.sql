-- Parvoz · live check for a deployed database. Run it in the Supabase SQL editor after the migrations and the seed.
-- It plays one hire end to end as an existing user and then RAISES ON PURPOSE, so nothing it wrote is kept.
-- The result is the error message: "PARVOZ VERIFY n/n passed" followed by one line per check.
do $$
declare
  u uuid;            -- any existing auth user; borrowed for the test, rolled back with everything else
  co uuid; sid uuid; other uuid; intro uuid; pl uuid; iv uuid;
  n int; passed int := 0; total int := 0; report text := '';
  stats jsonb; fee bigint; txt text;
begin
  set local search_path = parvoz;
  select id into u from auth.users limit 1;
  if u is null then raise exception 'PARVOZ VERIFY needs at least one user in auth.users'; end if;

  -- set-up as the database owner: the borrowed user becomes an employer and, for the student half, the owner of a demo record
  delete from profiles where id = u;
  insert into profiles (id, role, full_name) values (u, 'employer', 'Verify Employer');
  insert into companies (name, tin, status) values ('Verify Co', 'VERIFY-0001', 'approved') returning id into co;
  insert into company_members (company_id, user_id, is_admin) values (co, u, true);
  insert into subscriptions (company_id, plan_code) values (co, 'scout');
  select id into sid from students where student_no = 'ENG-0001';
  select id into other from students where student_no = 'BUS-0001';
  update students set user_id = null where user_id = u;
  update students set user_id = u, phone = '+998 00 000 00 00' where id = sid;

  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);

  -- 1. a visitor without an account reads counts and nothing else
  set local role anon;
  select public_stats() into stats;
  total := total + 1;
  if (stats ->> 'students')::int >= 36 then passed := passed + 1; report := report || E'\nok   visitor reads public counts: ' || stats::text;
  else report := report || E'\nFAIL visitor counts: ' || stats::text; end if;
  total := total + 1;
  begin
    perform 1 from talent limit 1;
    report := report || E'\nFAIL visitor can read the talent view';
  exception when insufficient_privilege then passed := passed + 1; report := report || E'\nok   visitor cannot read the talent view';
  end;
  reset role;

  -- 2. the employer
  set local role authenticated;
  total := total + 1;
  select count(*) into n from students where id <> sid;
  if n = 0 then passed := passed + 1; report := report || E'\nok   employer cannot read the students table';
  else report := report || E'\nFAIL employer reads ' || n || ' rows of students'; end if;

  total := total + 1;
  select count(*) into n from talent;
  if n >= 36 then passed := passed + 1; report := report || E'\nok   employer sees ' || n || ' students in the talent view';
  else report := report || E'\nFAIL talent view shows ' || n; end if;

  total := total + 1;
  select count(*) into n from student_contact(other);
  if n = 0 then passed := passed + 1; report := report || E'\nok   contacts are locked before an intro';
  else report := report || E'\nFAIL contacts readable without an intro'; end if;

  total := total + 1;
  begin
    perform report_hire(other, 10000000, current_date + 20);
    report := report || E'\nFAIL hire reported without an intro';
  exception when others then passed := passed + 1; report := report || E'\nok   hire without an accepted intro is rejected';
  end;

  intro := request_intro(sid);
  total := total + 1;
  begin
    update pipeline set stage = 'interview' where student_id = sid;
    report := report || E'\nFAIL card moved to interview before acceptance';
  exception when others then passed := passed + 1; report := report || E'\nok   no interview before the student accepts';
  end;

  -- 3. the student accepts, the employer continues
  perform respond_intro(intro, true);
  total := total + 1;
  select count(*) into n from student_contact(sid);
  if n = 1 then passed := passed + 1; report := report || E'\nok   contacts unlock after acceptance';
  else report := report || E'\nFAIL contacts still locked'; end if;

  iv := propose_interview(sid, array[now() + interval '1 day', now() + interval '2 days']);
  total := total + 1;
  begin
    perform pick_interview(iv, now() + interval '9 days');
    report := report || E'\nFAIL a time that was not offered was accepted';
  exception when others then passed := passed + 1; report := report || E'\nok   only an offered interview time can be picked';
  end;

  pl := report_hire(sid, 11000000, date '2026-12-01');
  select fee_uzs into fee from placements where id = pl;
  total := total + 1;
  if fee = 33000000 then passed := passed + 1; report := report || E'\nok   fee is three monthly salaries: 33 000 000';
  else report := report || E'\nFAIL fee is ' || fee; end if;

  total := total + 1;
  select string_agg(amount_uzs || ' due ' || due_date, ', ' order by due_date) into txt from invoices where placement_id = pl;
  if txt = '16500000 due 2026-12-11, 16500000 due 2027-03-01' then passed := passed + 1; report := report || E'\nok   two invoices: ' || txt;
  else report := report || E'\nFAIL invoices: ' || coalesce(txt, 'none'); end if;

  perform confirm_hire(pl, true);
  total := total + 1;
  select status::text into txt from invoices where placement_id = pl and kind = 'placement_first_half';
  if txt = 'due' then passed := passed + 1; report := report || E'\nok   student confirmation makes the first half due';
  else report := report || E'\nFAIL first half is ' || txt; end if;

  perform report_departure(pl, date '2027-01-20');
  total := total + 1;
  select status::text into txt from invoices where placement_id = pl and kind = 'placement_second_half';
  if txt = 'void' then passed := passed + 1; report := report || E'\nok   leaving inside the guarantee cancels the second half';
  else report := report || E'\nFAIL second half is ' || txt; end if;

  total := total + 1;
  begin
    perform log_event('fake', 'placements', null);
    report := report || E'\nFAIL audit log writable directly';
  exception when insufficient_privilege then passed := passed + 1; report := report || E'\nok   audit log cannot be written directly';
  end;
  reset role;

  raise exception E'PARVOZ VERIFY %/% passed (nothing was saved)%', passed, total, report;
end $$;
