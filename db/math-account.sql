begin;
create table public.math_profiles (
 user_id uuid primary key references public.game_profiles(user_id) on delete cascade,
 total_xp bigint not null default 0 check(total_xp between 0 and 1000000000),
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now()
);
create table public.math_stage_records (
 user_id uuid not null references public.math_profiles(user_id) on delete cascade,
 grade smallint not null check(grade between 1 and 6),
 stage smallint not null check(stage between 1 and 6),
 stars smallint not null check(stars between 1 and 3),
 high_score integer not null check(high_score between 0 and 1000000),
 best_combo integer not null default 0 check(best_combo between 0 and 100000),
 updated_at timestamptz not null default now(),
 primary key(user_id,grade,stage)
);
alter table public.math_profiles enable row level security;
alter table public.math_stage_records enable row level security;
revoke all on public.math_profiles,public.math_stage_records from public,anon,authenticated;
grant select on public.math_profiles,public.math_stage_records to authenticated;
create policy math_profile_self on public.math_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy math_stage_self on public.math_stage_records for select to authenticated using(user_id=(select auth.uid()));

-- Non-exposed schema holds the privileged transaction. Only caller's auth.uid()
-- is used; clients cannot submit another owner. Public RPC stays invoker.
create schema math_private;
revoke all on schema math_private from public,anon;
grant usage on schema math_private to authenticated;
create function math_private.save_state(p_total_xp bigint,p_records jsonb,p_expected_revision bigint) returns bigint
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); next_revision bigint; item record; g integer; s integer; st integer; sc integer; co integer;
begin
 if uid is null or not exists(select 1 from public.game_profiles where user_id=uid) then raise exception using errcode='PT401',message='LOGIN_REQUIRED'; end if;
 if p_total_xp is null or p_total_xp<0 or p_total_xp>1000000000 or p_expected_revision is null or p_expected_revision<0 or jsonb_typeof(p_records) is distinct from 'object' or octet_length(p_records::text)>32768 then raise exception 'INVALID_MATH_SAVE'; end if;
 if p_expected_revision=0 then
  insert into public.math_profiles(user_id,total_xp) values(uid,p_total_xp) on conflict(user_id) do nothing returning revision into next_revision;
 else
  update public.math_profiles set total_xp=greatest(total_xp,p_total_xp),revision=revision+1,updated_at=now() where user_id=uid and revision=p_expected_revision returning revision into next_revision;
 end if;
 if next_revision is null then raise exception using errcode='PT409',message='MATH_SAVE_CONFLICT'; end if;
 for item in select key,value from jsonb_each(p_records) loop
  if item.key !~ '^[1-6]-[1-6]$' or jsonb_typeof(item.value) is distinct from 'object' or jsonb_typeof(item.value->'stars') is distinct from 'number' or jsonb_typeof(item.value->'score') is distinct from 'number' or jsonb_typeof(coalesce(item.value->'bestCombo','0'::jsonb)) is distinct from 'number' then raise exception 'INVALID_MATH_RECORD'; end if;
  g:=split_part(item.key,'-',1)::integer;s:=split_part(item.key,'-',2)::integer;
  st:=(item.value->>'stars')::integer;sc:=(item.value->>'score')::integer;co:=coalesce((item.value->>'bestCombo')::integer,0);
  if st not between 1 and 3 or sc not between 0 and 1000000 or co not between 0 and 100000 then raise exception 'INVALID_MATH_RECORD'; end if;
  insert into public.math_stage_records(user_id,grade,stage,stars,high_score,best_combo) values(uid,g,s,st,sc,co)
  on conflict(user_id,grade,stage) do update set stars=greatest(public.math_stage_records.stars,excluded.stars),high_score=greatest(public.math_stage_records.high_score,excluded.high_score),best_combo=greatest(public.math_stage_records.best_combo,excluded.best_combo),updated_at=now();
 end loop;
 return next_revision;
end $$;
revoke all on function math_private.save_state(bigint,jsonb,bigint) from public,anon;
grant execute on function math_private.save_state(bigint,jsonb,bigint) to authenticated;
create function public.save_math_state(p_total_xp bigint,p_records jsonb,p_expected_revision bigint) returns bigint
language sql security invoker set search_path='' as $$ select math_private.save_state(p_total_xp,p_records,p_expected_revision); $$;
revoke all on function public.save_math_state(bigint,jsonb,bigint) from public,anon;
grant execute on function public.save_math_state(bigint,jsonb,bigint) to authenticated;
create function public.load_math_state() returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object(
 'totalXP',coalesce((select total_xp from public.math_profiles where user_id=(select auth.uid())),0),
 'revision',coalesce((select revision from public.math_profiles where user_id=(select auth.uid())),0),
 'progress',coalesce((select jsonb_object_agg(grade||'-'||stage,jsonb_build_object('stars',stars,'score',high_score,'bestCombo',best_combo)) from public.math_stage_records where user_id=(select auth.uid())),'{}'::jsonb));
$$;
revoke all on function public.load_math_state() from public,anon;
grant execute on function public.load_math_state() to authenticated;
notify pgrst,'reload schema';
commit;
