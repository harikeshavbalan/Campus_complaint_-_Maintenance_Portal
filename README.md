# CampusCare — Campus Complaint & Maintenance Portal

A clean Next.js + Supabase implementation of the CampusCare project built during today's work.

## Included

- Four roles: Complainant, Admin, Technician, System Administrator
- Supabase authentication
- Role-based login redirects
- Pending approval for Admin and Technician registrations
- System Administrator approval of Admin accounts
- Admin approval of Technician accounts
- Complaint creation with JPG/PNG/WEBP image upload (max 5 MB)
- Complaint validation and technician assignment
- Technician progress: assigned → in progress → resolved
- Admin closure of resolved complaints
- Complainant feedback and reopening
- Complaint detail page with signed attachment URLs
- Minimal landing page with empty areas reserved for completed complaints and campus updates
- Responsive CSS without Tailwind

## Start locally

1. Extract this zip into a new folder.
2. Open the folder in VS Code.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Put your existing Supabase URL and publishable key into `.env.local`.
6. Because this project uses your existing Supabase project, do **not** blindly run `schema.sql` on the existing database. Use `supabase/migration_existing_project.sql` if the database needs the workflow migration.
7. Run `npm run dev`.

## Test accounts

Use the credentials configured for your own Supabase test accounts. Approve pending Admin and Technician accounts from the appropriate dashboard before signing in.

## Important

Use unique passwords for test accounts and change them before using the application outside development.
