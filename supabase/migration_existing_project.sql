-- CampusCare migration for the existing Supabase project.
-- Run this in Supabase SQL Editor. It preserves existing users and complaints.

alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check check (account_status in ('pending','active','rejected'));

alter type public.complaint_status add value if not exists 'verified';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare requested text;
begin
  requested := coalesce(new.raw_user_meta_data->>'requested_role','complainant');
  insert into public.profiles(id,full_name,email,role,account_status)
  values(
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    case when requested in ('admin','technician') then requested::public.user_role else 'complainant'::public.user_role end,
    case when requested in ('admin','technician') then 'pending' else 'active' end
  )
  on conflict(id) do update set email=excluded.email;
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

-- Replace the profile policies so users cannot change their own role/status.
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self_or_admin on public.profiles;
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_read
on public.profiles for select to authenticated
using (id=auth.uid() or public.is_admin());

create policy profiles_update_admin
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Keep existing owner/technician policies and explicitly grant admins visibility.
drop policy if exists complaints_admin_read on public.complaints;
create policy complaints_admin_read
on public.complaints for select to authenticated
using (public.is_admin());

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
      and (
        c.submitted_by=auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.tasks t
          where t.complaint_id=c.id and t.technician_id=auth.uid()
        )
      )
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
create index if not exists complaints_submitted_by_idx on public.complaints(submitted_by);
create index if not exists tasks_technician_idx on public.tasks(technician_id);

-- If you need to restore your existing System Administrator account, run this separately:
-- update public.profiles set role='system_admin', account_status='active'
-- where email='YOUR_SYSTEM_ADMIN_EMAIL';
