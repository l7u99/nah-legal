create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null default 'admin' check (role in ('owner','admin','editor','analyst')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.question_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists one_published_question_set on public.question_sets(status) where status='published';

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references public.question_sets(id) on delete cascade,
  body text not null,
  position int not null,
  category text,
  explanation text not null default '',
  law_name text not null default '',
  article_number text not null default '',
  source_name text not null default '',
  source_url text not null default '',
  correct_option_id uuid,
  unique(question_set_id,position)
);
create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null,
  position int not null,
  unique(question_id,position)
);
alter table public.questions add constraint questions_correct_option_fk
  foreign key (correct_option_id) references public.options(id) deferrable initially deferred;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  phone_hash text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists participants_phone_hash_unique on public.participants(phone_hash);\n\ncreate table if not exists public.participations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id),
  question_set_id uuid not null references public.question_sets(id),
  score int not null default 0,
  total int not null default 3,
  completed_at timestamptz not null default now(),
  unique(participant_id,question_set_id)
);
create table if not exists public.participation_answers (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null references public.participations(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  selected_option_id uuid not null references public.options(id),
  is_correct boolean not null,
  unique(participation_id,question_id)
);
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.admin_users where user_id=auth.uid() and active=true); $$;

alter table public.admin_users enable row level security;
alter table public.question_sets enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.participants enable row level security;
alter table public.participations enable row level security;
alter table public.participation_answers enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "admins read admin users" on public.admin_users for select to authenticated using (public.is_admin());
create policy "admins manage admin users" on public.admin_users for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public reads published sets" on public.question_sets for select to anon,authenticated using (status='published' or public.is_admin());
create policy "public reads published questions" on public.questions for select to anon,authenticated using (exists(select 1 from public.question_sets s where s.id=question_set_id and s.status='published') or public.is_admin());
create policy "public reads published options" on public.options for select to anon,authenticated using (exists(select 1 from public.questions q join public.question_sets s on s.id=q.question_set_id where q.id=question_id and s.status='published') or public.is_admin());
create policy "admins manage sets" on public.question_sets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage questions" on public.questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage options" on public.options for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read participants" on public.participants for select to authenticated using (public.is_admin());
create policy "admins read participations" on public.participations for select to authenticated using (public.is_admin());
create policy "admins read answers" on public.participation_answers for select to authenticated using (public.is_admin());
create policy "admins read audit" on public.admin_audit_log for select to authenticated using (public.is_admin());

create or replace view public.weekly_leaderboard as
select left(p.full_name,1)||'•••' as display_name, pt.score, pt.completed_at
from public.participations pt join public.participants p on p.id=pt.participant_id
where pt.score=3 and pt.total=3
order by pt.completed_at asc, pt.id asc limit 10;
grant select on public.weekly_leaderboard to anon, authenticated;

create or replace view public.admin_participations as
select pt.id, p.full_name, p.phone, pt.question_set_id, pt.score, pt.total, pt.completed_at
from public.participations pt join public.participants p on p.id=pt.participant_id
where public.is_admin();
grant select on public.admin_participations to authenticated;

-- Seed the first-week question set. Publish only after reviewing the legal wording and official references.
insert into public.question_sets(title,status,starts_at,ends_at)
values ('دقيقة قانونية — الأسبوع الأول','draft',now(),now()+interval '7 days')
on conflict do nothing;
