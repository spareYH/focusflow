-- FocusFlow V2 task storage and per-user security boundary.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0),
  description text not null default '',
  priority text not null default 'Medium'
    check (priority in ('High', 'Medium', 'Low')),
  category text not null default 'Personal'
    check (category in ('Work', 'Personal')),
  status text not null default 'todo'
    check (status in ('todo', 'inprogress', 'done')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tasks is 'Tasks owned by individual FocusFlow users.';
comment on column public.tasks.user_id is 'Owner; enforced against auth.uid() by RLS.';

create index tasks_user_created_at_idx
  on public.tasks (user_id, created_at desc);

create index tasks_user_due_date_idx
  on public.tasks (user_id, due_date)
  where due_date is not null;

create function public.set_tasks_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_tasks_updated_at();

alter table public.tasks enable row level security;

-- Keep anonymous clients outside the task API entirely. Authenticated clients
-- still have to satisfy every row-level policy below.
revoke all on table public.tasks from anon;
grant select, insert, update, delete on table public.tasks to authenticated;

create policy "Users can select their own tasks"
on public.tasks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own tasks"
on public.tasks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own tasks"
on public.tasks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tasks"
on public.tasks
for delete
to authenticated
using ((select auth.uid()) = user_id);
