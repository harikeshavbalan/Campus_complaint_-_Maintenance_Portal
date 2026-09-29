-- Run once in Supabase SQL Editor for an existing database.
-- RLS policies still control which rows each authenticated user may access.

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update(account_status) on public.profiles to authenticated;

grant select on public.departments to authenticated;

grant select, insert on public.complaints to authenticated;
grant update(status) on public.complaints to authenticated;

grant select, insert on public.complaint_status_history to authenticated;
grant select, insert on public.attachments to authenticated;
grant select, insert, update on public.tasks to authenticated;
grant select, insert on public.feedback to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert on public.reports to authenticated;