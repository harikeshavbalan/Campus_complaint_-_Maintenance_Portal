-- CITfix migration for the existing Supabase project.
-- Run this in Supabase SQL Editor. It preserves existing users and complaints.

alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists student_id text;
alter table public.profiles add column if not exists department text;
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check check (account_status in ('pending','active','rejected'));

alter type public.complaint_status add value if not exists 'verified';

alter table public.complaints
add column if not exists complaint_by uuid references public.profiles(id) on delete restrict;
alter table public.complaints
add column if not exists complainant_id uuid references public.profiles(id) on delete restrict;
alter table public.complaints
add column if not exists created_at timestamptz not null default now();
alter table public.complaints
add column if not exists updated_at timestamptz not null default now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaints'
      AND column_name = 'submitted_by'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaints'
      AND column_name = 'complaint_by'
  ) THEN
    ALTER TABLE public.complaints RENAME COLUMN submitted_by TO complaint_by;
  END IF;
END $$;

alter table public.tasks
add column if not exists assigned_date timestamptz not null default now();
alter table public.tasks
add column if not exists completed_date timestamptz;

update public.complaints
set complaint_by = coalesce(complaint_by, complainant_id),
    complainant_id = coalesce(complaint_by, complainant_id)
where complaint_by is null or complainant_id is null;

create table if not exists public.complaint_status_history(
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare requested text;
begin
  requested := coalesce(new.raw_user_meta_data->>'requested_role','complainant');
  insert into public.profiles(id,full_name,email,phone,student_id,department,role,account_status)
  values(
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'student_id',
    new.raw_user_meta_data->>'department',
    case when requested in ('admin','technician') then requested::public.user_role else 'complainant'::public.user_role end,
    case when requested in ('admin','technician') then 'pending' else 'active' end
  )
  on conflict(id) do update set email=excluded.email, phone=excluded.phone, student_id=excluded.student_id, department=excluded.department;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role in ('admin','system_admin') and account_status='active'
  );
$$;

create or replace function public.is_system_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='system_admin' and account_status='active'
  );
$$;

create or replace function public.is_technician()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='technician' and account_status='active'
  );
$$;

create or replace function public.is_complaint_owner(target_complaint_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.complaints c
    where c.id=target_complaint_id
      and (c.complaint_by=auth.uid() or c.complainant_id=auth.uid())
  );
$$;

create or replace function public.is_assigned_technician(target_complaint_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.tasks t
    join public.profiles p on p.id=t.technician_id
    where t.complaint_id=target_complaint_id
      and t.technician_id=auth.uid()
      and p.role='technician'
      and p.account_status='active'
  );
$$;
revoke all on function public.is_complaint_owner(uuid) from public;
revoke all on function public.is_assigned_technician(uuid) from public;
grant execute on function public.is_complaint_owner(uuid),public.is_assigned_technician(uuid) to authenticated;

create or replace function public.sync_complaint_owner_ids()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.complaint_by is null then new.complaint_by:=new.complainant_id;
  elsif new.complainant_id is null then new.complainant_id:=new.complaint_by;
  elsif new.complaint_by is distinct from new.complainant_id then
    raise exception 'complaint_by and complainant_id must identify the same user';
  end if;
  return new;
end;
$$;
drop trigger if exists complaints_sync_owner_insert on public.complaints;
create trigger complaints_sync_owner_insert before insert on public.complaints
for each row execute function public.sync_complaint_owner_ids();
drop trigger if exists complaints_sync_owner_update on public.complaints;
create trigger complaints_sync_owner_update before update of complaint_by,complainant_id on public.complaints
for each row execute function public.sync_complaint_owner_ids();

create or replace function public.get_public_completed_complaints()
returns table(id uuid,title text,category text,location text,priority text,completed_at timestamptz)
language sql stable security definer set search_path=public as $$
  select c.id,c.title,c.category,c.location,c.priority,c.updated_at
  from public.complaints c
  where c.status::text in ('resolved','closed')
  order by c.updated_at desc
  limit 12;
$$;
revoke all on function public.get_public_completed_complaints() from public;
grant execute on function public.get_public_completed_complaints() to anon,authenticated;

create or replace function public.set_complaint_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at:=now();
  return new;
end;
$$;

create or replace function public.log_complaint_status_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.complaint_status_history(complaint_id,new_status,changed_by)
    values(new.id,new.status::text,auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.complaint_status_history(complaint_id,old_status,new_status,changed_by)
    values(new.id,old.status::text,new.status::text,auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists complaints_set_updated_at on public.complaints;
create trigger complaints_set_updated_at before update on public.complaints
for each row execute function public.set_complaint_updated_at();
drop trigger if exists complaints_log_status_insert on public.complaints;
create trigger complaints_log_status_insert after insert on public.complaints
for each row execute function public.log_complaint_status_change();
drop trigger if exists complaints_log_status_update on public.complaints;
create trigger complaints_log_status_update after update of status on public.complaints
for each row execute function public.log_complaint_status_change();

insert into public.complaint_status_history(complaint_id,new_status,changed_at)
select c.id,c.status::text,coalesce(c.updated_at,c.created_at,now())
from public.complaints c
where not exists(select 1 from public.complaint_status_history h where h.complaint_id=c.id);

drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self_or_admin on public.profiles;
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_read
on public.profiles for select to authenticated
using (id=auth.uid() or public.is_admin());

create policy profiles_update_admin
on public.profiles for update to authenticated
using (public.is_system_admin() or (public.is_admin() and role='technician'))
with check (public.is_system_admin() or (public.is_admin() and role='technician'));

alter table public.profiles enable row level security;
revoke update on public.profiles from authenticated;
grant update(account_status) on public.profiles to authenticated;
alter table public.departments enable row level security;
alter table public.tasks enable row level security;
alter table public.attachments enable row level security;
alter table public.feedback enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.departments to authenticated;
grant select, insert on public.complaints to authenticated;
grant select, insert on public.complaint_status_history to authenticated;
grant select, insert on public.attachments to authenticated;
grant select, insert on public.tasks to authenticated;
grant select, insert on public.feedback to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert on public.reports to authenticated;

alter table public.complaints enable row level security;
alter table public.complaint_status_history enable row level security;

drop policy if exists departments_read on public.departments;
drop policy if exists departments_manage on public.departments;
create policy departments_read on public.departments for select to authenticated using(true);
create policy departments_manage on public.departments for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists complaints_read on public.complaints;
drop policy if exists complaints_insert on public.complaints;
drop policy if exists complaints_update_admin on public.complaints;
drop policy if exists complaints_update_technician on public.complaints;
drop policy if exists complaints_reopen_owner on public.complaints;
drop policy if exists complaints_admin_read on public.complaints;
create policy complaints_read on public.complaints for select to authenticated
using (
  complaint_by=auth.uid()
  or complainant_id=auth.uid()
  or public.is_admin()
  or public.is_assigned_technician(complaints.id)
);
create policy complaints_insert on public.complaints for insert to authenticated
with check (
  complaint_by=auth.uid()
  and complainant_id=auth.uid()
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status='active')
);
create policy complaints_update_admin on public.complaints for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy complaints_update_technician on public.complaints for update to authenticated
using (public.is_assigned_technician(complaints.id))
with check (public.is_assigned_technician(complaints.id));
create policy complaints_reopen_owner on public.complaints for update to authenticated
using (public.is_complaint_owner(complaints.id) and status='closed')
with check (public.is_complaint_owner(complaints.id) and status='reopened');

drop policy if exists tasks_read on public.tasks;
drop policy if exists tasks_insert_admin on public.tasks;
drop policy if exists tasks_update_assignee on public.tasks;
create policy tasks_read on public.tasks for select to authenticated
using(technician_id=auth.uid() or public.is_admin() or public.is_complaint_owner(complaint_id));
create policy tasks_insert_admin on public.tasks for insert to authenticated
with check(public.is_admin());
create policy tasks_update_assignee on public.tasks for update to authenticated
using(technician_id=auth.uid() or public.is_admin())
with check(technician_id=auth.uid() or public.is_admin());

drop policy if exists attachments_read on public.attachments;
drop policy if exists attachments_insert on public.attachments;
create policy attachments_read on public.attachments for select to authenticated
using(uploaded_by=auth.uid() or public.is_admin() or public.is_complaint_owner(complaint_id) or public.is_assigned_technician(complaint_id));
create policy attachments_insert on public.attachments for insert to authenticated
with check(uploaded_by=auth.uid());

create table if not exists public.feedback(
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null unique references public.complaints(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  rating int not null check (rating between 1 and 5),
  comments text,
  submitted_at timestamptz not null default now()
);

drop policy if exists feedback_read on public.feedback;
drop policy if exists feedback_insert on public.feedback;
create policy feedback_read on public.feedback for select to authenticated
using(submitted_by=auth.uid() or public.is_admin());
create policy feedback_insert on public.feedback for insert to authenticated
with check(submitted_by=auth.uid() and public.is_complaint_owner(complaint_id));

drop policy if exists notifications_read on public.notifications;
drop policy if exists notifications_update on public.notifications;
drop policy if exists notifications_insert on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notifications_update on public.notifications for update to authenticated
using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notifications_insert on public.notifications for insert to authenticated
with check(public.is_admin() or public.is_technician());

drop policy if exists reports_read on public.reports;
drop policy if exists reports_insert on public.reports;
create policy reports_read on public.reports for select to authenticated using(public.is_admin());
create policy reports_insert on public.reports for insert to authenticated with check(public.is_admin());

drop policy if exists complaint_status_history_read on public.complaint_status_history;
create policy complaint_status_history_read on public.complaint_status_history for select to authenticated
using (
  public.is_admin()
  or public.is_complaint_owner(complaint_id)
  or public.is_assigned_technician(complaint_id)
);
drop policy if exists complaint_status_history_insert on public.complaint_status_history;
create policy complaint_status_history_insert on public.complaint_status_history for insert to authenticated
with check (
  changed_by=auth.uid()
  and (public.is_admin() or public.is_assigned_technician(complaint_id))
);
create index if not exists complaint_status_history_complaint_idx
on public.complaint_status_history(complaint_id,changed_at desc);
grant select,insert on public.complaints to authenticated;
revoke update on public.complaints from authenticated;
grant update(status) on public.complaints to authenticated;
grant select,insert on public.complaint_status_history to authenticated;
revoke select on public.complaints from anon;

-- Storage bucket for complaint photos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'complaint-attachments',
  'complaint-attachments',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public=false,
  file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists complaint_storage_read on storage.objects;
drop policy if exists complaint_storage_insert on storage.objects;
drop policy if exists attachment_storage_read on storage.objects;
drop policy if exists attachment_storage_insert on storage.objects;

create policy complaint_storage_read
on storage.objects for select to authenticated
using (
  bucket_id='complaint-attachments'
  and exists (
    select 1
    from public.attachments a
    join public.complaints c on c.id=a.complaint_id
    where a.file_path=storage.objects.name
      and (public.is_complaint_owner(c.id) or public.is_admin() or public.is_assigned_technician(c.id))
  )
);

create policy complaint_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='complaint-attachments'
  and owner_id=auth.uid()::text
  and name like(auth.uid()::text || '/%')
);

create index if not exists profiles_role_status_idx on public.profiles(role,account_status);
create index if not exists complaints_status_idx on public.complaints(status);
create index if not exists complaints_complaint_by_idx on public.complaints(complaint_by);
create index if not exists tasks_technician_idx on public.tasks(technician_id);

-- If you need to restore your existing System Administrator account, run this separately:
-- update public.profiles set role='system_admin', account_status='active'
-- where email='YOUR_SYSTEM_ADMIN_EMAIL';
 