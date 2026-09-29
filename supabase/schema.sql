create extension if not exists pgcrypto;

do $$ begin create type public.user_role as enum ('complainant','admin','technician','system_admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.account_status as enum ('pending','active','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.complaint_status as enum ('open','verified','assigned','in_progress','resolved','closed','reopened','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.task_status as enum ('assigned','in_progress','completed','cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.departments(id uuid primary key default gen_random_uuid(),name text not null unique,location text,created_at timestamptz not null default now());
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text,email text,phone text,student_id text,department text,role public.user_role not null default 'complainant',account_status public.account_status not null default 'active',department_id uuid references public.departments(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.complaints(id uuid primary key default gen_random_uuid(),title text not null,description text not null,category text not null,priority text not null default 'medium' check(priority in ('low','medium','high','critical')),status public.complaint_status not null default 'open',location text,complaint_by uuid not null references public.profiles(id) on delete restrict,complainant_id uuid references public.profiles(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.complaint_status_history(id uuid primary key default gen_random_uuid(),complaint_id uuid not null references public.complaints(id) on delete cascade,old_status text,new_status text not null,changed_by uuid references public.profiles(id) on delete set null,changed_at timestamptz not null default now(),note text);
create index if not exists complaint_status_history_complaint_idx on public.complaint_status_history(complaint_id,changed_at desc);
create table if not exists public.attachments(id uuid primary key default gen_random_uuid(),complaint_id uuid not null references public.complaints(id) on delete cascade,file_name text not null,file_type text,file_path text not null,uploaded_by uuid not null references public.profiles(id) on delete restrict,uploaded_at timestamptz not null default now());
create table if not exists public.tasks(id uuid primary key default gen_random_uuid(),complaint_id uuid not null unique references public.complaints(id) on delete cascade,technician_id uuid references public.profiles(id) on delete set null,status public.task_status not null default 'assigned',assigned_date timestamptz not null default now(),completed_date timestamptz,progress_notes text,completion_proof text,updated_at timestamptz not null default now());
create table if not exists public.feedback(id uuid primary key default gen_random_uuid(),complaint_id uuid not null unique references public.complaints(id) on delete cascade,submitted_by uuid not null references public.profiles(id) on delete restrict,rating int not null check(rating between 1 and 5),comments text,submitted_at timestamptz not null default now());
create table if not exists public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,complaint_id uuid references public.complaints(id) on delete cascade,message text not null,is_read boolean not null default false,created_at timestamptz not null default now());
create table if not exists public.reports(id uuid primary key default gen_random_uuid(),report_type text not null,generated_by uuid not null references public.profiles(id) on delete restrict,file_path text,generated_at timestamptz not null default now());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare requested text; begin requested:=coalesce(new.raw_user_meta_data->>'requested_role','complainant'); insert into public.profiles(id,full_name,email,phone,student_id,department,role,account_status) values(new.id,new.raw_user_meta_data->>'full_name',new.email,new.raw_user_meta_data->>'phone',new.raw_user_meta_data->>'student_id',new.raw_user_meta_data->>'department',case when requested in ('admin','technician') then requested::public.user_role else 'complainant'::public.user_role end,case when requested in ('admin','technician') then 'pending'::public.account_status else 'active'::public.account_status end) on conflict(id) do update set email=excluded.email,phone=excluded.phone,student_id=excluded.student_id,department=excluded.department; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','system_admin') and account_status='active'); $$;
create or replace function public.is_system_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='system_admin' and account_status='active'); $$;
create or replace function public.is_technician() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='technician' and account_status='active'); $$;
create or replace function public.is_complaint_owner(target_complaint_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.complaints c where c.id=target_complaint_id and (c.complaint_by=auth.uid() or c.complainant_id=auth.uid())); $$;
create or replace function public.is_assigned_technician(target_complaint_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.tasks t join public.profiles p on p.id=t.technician_id where t.complaint_id=target_complaint_id and t.technician_id=auth.uid() and p.role='technician' and p.account_status='active'); $$;
revoke all on function public.is_complaint_owner(uuid) from public;
revoke all on function public.is_assigned_technician(uuid) from public;
grant execute on function public.is_complaint_owner(uuid),public.is_assigned_technician(uuid) to authenticated;
create or replace function public.sync_complaint_owner_ids() returns trigger language plpgsql set search_path=public as $$
begin
	if new.complaint_by is null then new.complaint_by:=new.complainant_id;
	elsif new.complainant_id is null then new.complainant_id:=new.complaint_by;
	elsif new.complaint_by is distinct from new.complainant_id then raise exception 'complaint_by and complainant_id must identify the same user';
	end if;
	return new;
end; $$;
drop trigger if exists complaints_sync_owner_insert on public.complaints;
create trigger complaints_sync_owner_insert before insert on public.complaints for each row execute function public.sync_complaint_owner_ids();
drop trigger if exists complaints_sync_owner_update on public.complaints;
create trigger complaints_sync_owner_update before update of complaint_by,complainant_id on public.complaints for each row execute function public.sync_complaint_owner_ids();
create or replace function public.get_public_completed_complaints()
returns table(id uuid,title text,category text,location text,priority text,completed_at timestamptz)
language sql stable security definer set search_path=public as $$
	select c.id,c.title,c.category,c.location,c.priority,c.updated_at
	from public.complaints c
	where c.status in ('resolved','closed')
	order by c.updated_at desc
	limit 12;
$$;
revoke all on function public.get_public_completed_complaints() from public;
grant execute on function public.get_public_completed_complaints() to anon,authenticated;

create or replace function public.set_complaint_updated_at() returns trigger language plpgsql set search_path=public as $$
begin new.updated_at:=now(); return new; end; $$;
create or replace function public.log_complaint_status_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
	if tg_op='INSERT' then
		insert into public.complaint_status_history(complaint_id,new_status,changed_by) values(new.id,new.status::text,auth.uid());
	elsif new.status is distinct from old.status then
		insert into public.complaint_status_history(complaint_id,old_status,new_status,changed_by) values(new.id,old.status::text,new.status::text,auth.uid());
	end if;
	return new;
end; $$;
drop trigger if exists complaints_set_updated_at on public.complaints;
create trigger complaints_set_updated_at before update on public.complaints for each row execute function public.set_complaint_updated_at();
drop trigger if exists complaints_log_status_insert on public.complaints;
create trigger complaints_log_status_insert after insert on public.complaints for each row execute function public.log_complaint_status_change();
drop trigger if exists complaints_log_status_update on public.complaints;
create trigger complaints_log_status_update after update of status on public.complaints for each row execute function public.log_complaint_status_change();

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_status_history enable row level security;
alter table public.attachments enable row level security;
alter table public.tasks enable row level security;
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

drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy profiles_update_admin on public.profiles for update to authenticated using(public.is_system_admin() or (public.is_admin() and role='technician')) with check(public.is_system_admin() or (public.is_admin() and role='technician'));
revoke update on public.profiles from authenticated;
grant update(account_status) on public.profiles to authenticated;

create policy departments_read on public.departments for select to authenticated using(true);
create policy departments_manage on public.departments for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy complaints_read on public.complaints for select to authenticated using(complaint_by=auth.uid() or complainant_id=auth.uid() or public.is_admin() or public.is_assigned_technician(complaints.id));
create policy complaints_insert on public.complaints for insert to authenticated with check(complaint_by=auth.uid() and (complainant_id is null or complainant_id=auth.uid()) and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status='active'));
create policy complaints_update_admin on public.complaints for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy complaints_update_technician on public.complaints for update to authenticated using(public.is_assigned_technician(complaints.id)) with check(public.is_assigned_technician(complaints.id));
create policy complaints_reopen_owner on public.complaints for update to authenticated using(public.is_complaint_owner(complaints.id) and status='closed') with check(public.is_complaint_owner(complaints.id) and status='reopened');
create policy complaint_status_history_read on public.complaint_status_history for select to authenticated using(public.is_admin() or public.is_complaint_owner(complaint_id) or public.is_assigned_technician(complaint_id));
create policy complaint_status_history_insert on public.complaint_status_history for insert to authenticated with check(changed_by=auth.uid() and (public.is_admin() or public.is_assigned_technician(complaint_id)));
revoke update on public.complaints from authenticated;
grant update(status) on public.complaints to authenticated;
create policy attachments_read on public.attachments for select to authenticated using(uploaded_by=auth.uid() or public.is_admin() or public.is_complaint_owner(complaint_id) or public.is_assigned_technician(complaint_id));
create policy attachments_insert on public.attachments for insert to authenticated with check(uploaded_by=auth.uid());
create policy tasks_read on public.tasks for select to authenticated using(technician_id=auth.uid() or public.is_admin() or public.is_complaint_owner(complaint_id));
create policy tasks_insert_admin on public.tasks for insert to authenticated with check(public.is_admin());
create policy tasks_update_assignee on public.tasks for update to authenticated using(technician_id=auth.uid() or public.is_admin()) with check(technician_id=auth.uid() or public.is_admin());
create policy feedback_read on public.feedback for select to authenticated using(submitted_by=auth.uid() or public.is_admin());
create policy feedback_insert on public.feedback for insert to authenticated with check(submitted_by=auth.uid() and public.is_complaint_owner(complaint_id));
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy notifications_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notifications_insert on public.notifications for insert to authenticated with check(public.is_admin() or public.is_technician());
create policy reports_read on public.reports for select to authenticated using(public.is_admin());
create policy reports_insert on public.reports for insert to authenticated with check(public.is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('complaint-attachments','complaint-attachments',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists complaint_storage_read on storage.objects;
drop policy if exists complaint_storage_insert on storage.objects;
create policy complaint_storage_read on storage.objects for select to authenticated using(bucket_id='complaint-attachments' and exists(select 1 from public.attachments a where a.file_path=storage.objects.name and (public.is_complaint_owner(a.complaint_id) or public.is_admin() or public.is_assigned_technician(a.complaint_id))));
create policy complaint_storage_insert on storage.objects for insert to authenticated with check(bucket_id='complaint-attachments' and owner_id=auth.uid()::text and name like(auth.uid()::text||'/%'));

create index if not exists profiles_role_status_idx on public.profiles(role,account_status);
create index if not exists complaints_status_idx on public.complaints(status);
create index if not exists complaints_complaint_by_idx on public.complaints(complaint_by);
create index if not exists tasks_technician_idx on public.tasks(technician_id);
