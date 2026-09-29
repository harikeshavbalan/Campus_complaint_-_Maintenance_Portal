# CampusCare — Campus Complaint & Maintenance Portal

A clean Next.js + Supabase implementation of the CampusCare project built during today's work.

## Included

- Four roles: Complainant, Admin, Technician, System Administrator
- Supabase authentication
- Role-based login redirects
- Pending approval for Admin and Technician registrations
- System Administrator approval of Admin account requests
- Admin approval of Technician account requests
- Complaint creation with JPG/PNG/WEBP image upload (max 5 MB)
- Priority-ordered admin queues for new and finished complaints
- Technician assignment, status updates and progress notes
- Database-backed status history for every complaint
- Admin closure of resolved complaints
- Complainant feedback and reopening
- Complaint detail page with signed attachment URLs
- Public landing page with login, account creation and completed-complaint summaries
- Role-scoped Supabase tables for profiles, complaints, tasks, attachments, feedback and status history
- Responsive CSS without Tailwind

## Start locally

1. Extract this zip into a new folder.
2. Open the folder in VS Code.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Put your existing Supabase URL and publishable key into `.env.local`.
6. Run `supabase/migration_existing_project.sql` in the Supabase SQL Editor. It adds the status-history table, public completed-summary function, timestamp triggers and role-based row-level security policies. Do **not** run `schema.sql` on an existing database; that file is for a new project.
7. Run `npm run dev`.

## Test accounts

Use the credentials configured for your own Supabase test accounts. Approve pending Admin and Technician accounts from the appropriate dashboard before signing in.

## Important

Use unique passwords for test accounts and change them before using the application outside development.
