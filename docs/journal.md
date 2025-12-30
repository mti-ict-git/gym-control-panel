2025-12-30 12:24:26 +08:00

Verification:
- Ran lint: 0 errors, warnings only.
- Ran TypeScript integrity check: passed (noEmit).
- Restarted backend server on http://localhost:5055.
- Tested endpoints:
  - GET /gym-sessions → 200 OK
  - GET /gym-availability?date=2025-12-31 → 200 OK, returns booked_count and quota per session.

UI:
- Register page shows Available as booked/quota and helper text “Remaining: X”.

2025-12-30 12:26:10 +08:00

Enhancement:
- Calendar highlights tomorrow and day after tomorrow in Register page.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

2025-12-30 14:56:28 +08:00

Enhancement:
- Updated latest transaction script to return TrName, TrController, Transaction, CardNo, TrDate, TrTime.

Verification:
- Ran lint: 0 errors, warnings only.
- Ran TypeScript integrity check: passed (noEmit).

2025-12-30 14:45:22 +08:00

Learning:
- Audited repository structure: frontend (Vite + React + shadcn + Tailwind), backend (Express + mssql), Supabase edge functions, Docker compose.
- Mapped key flows: RegisterPage calls local backend /gym-booking-create; availability via /gym-availability with fallback /gym-bookings; sessions via /gym-sessions; Supabase public functions for register/sessions.

Verification:
- Lint: 0 errors, 8 warnings (react-refresh only-export-components).
- TypeScript integrity check: passed (noEmit).

2025-12-30 13:58:18 +08:00

Enhancement:
- Calendar highlight color updated to light blue (bg-blue-100/text-blue-900 with subtle ring) to match the requested visual.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

2025-12-30 15:07:40 +08:00

Enhancement:
- Added backend endpoint GET /gym-live-transactions returning TrName, TrController, Transaction, CardNo, TrDate, TrTime, TxnTime with optional since and limit.
- Added frontend hook useCardTransactions with 2s polling.
- Updated Live Gym page to display recent door taps.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript check: passed.

2025-12-30 15:12:08 +08:00

Enhancement:
- Enabled React Router future flags (v7_startTransition, v7_relativeSplatPath) to align with upcoming v7 behavior and suppress warnings.
- Adjusted client polling to include since watermark and stabilize hook order after hard reload.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
2025-12-30 21:07:00 +08:00

Database Connections Refactor:
- Replaced Supabase calls in useDatabaseConnections with backend GymDB endpoints (/api/db-connections*, see gym.js).
- Preserved hook interface for DatabaseList and detail page.

Verification:
- Lint: passed (warnings only).
- TypeScript integrity check: passed (noEmit).
2025-12-30 21:15:30 +08:00

Supabase Removal Phase 2:
- Refactored useGymUsers to source from MasterDB /employee-core and provide paginated list for ScheduleDialog and Dashboard.
- Refactored dashboard-facing hooks in useGymSchedules (upcoming, today count, occupancy) to GymDB endpoints (/gym-sessions, /gym-bookings).
- Refactored useGymAnalytics to compute charts from GymDB /gym-bookings.

Verification:
- Lint: passed (warnings only).
- TypeScript integrity check: passed (noEmit).

2025-12-30 14:06:20 +08:00

Enhancement:
- Styled today with green highlight (bg-green-100/text-green-900, ring-green-300) while keeping it disabled for selection.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

2025-12-30 14:08:51 +08:00

Enhancement:
- Added calendar legend under date picker: blue = available dates, green = today.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

2025-12-30 14:11:08 +08:00

Enhancement:
- Disabled session select until a date is chosen and added hint text.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

2025-12-30 14:13:35 +08:00

Enhancement:
- Added success popup dialog after registration with session details and booking ID.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

2025-12-30 14:21:16 +08:00

Enhancement:
- Calendar popover now auto-closes after a valid date selection.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

2025-12-30 14:26:45 +08:00

Enhancement:
- Removed success toast notification; dialog is the sole success feedback.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

2025-12-30 14:29:44 +08:00

Enhancement:
- Added contact person info in success dialog with WhatsApp quick link.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

2025-12-30 14:32:09 +08:00

Enhancement:
- Added failure popup dialog on registration errors with contact info and WhatsApp link.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.
 
2025-12-30 14:34:43 +08:00

Verification:
- Ran lint: 0 errors, warnings only.
- Ran TypeScript integrity check: passed (noEmit).

UI:
- Confirmed success toast removed; success dialog shows session details and contact.
- Confirmed error dialog opens on failed registration with WhatsApp contact.

2025-12-30 14:37:16 +08:00

Enhancement:
- Updated WhatsApp contact number in Register page to +6285852047041.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

2025-12-30 14:41:48 +08:00

Enhancement:
- Added Booking ID column to Gym Booking table (desktop) and field in mobile card.

Verification:
- Lint: 0 errors.
- TypeScript integrity check: passed (noEmit).

2025-12-30 14:44:22 +08:00

Enhancement:
- Reordered Booking ID column to appear immediately after No in desktop table.

Verification:
- Lint: 0 errors.
- TypeScript integrity check: passed (noEmit).

2025-12-30 14:48:14 +08:00

Enhancement:
- Formatted Booking ID as GYMBOOKxx in VaultPage (mobile and desktop) and Register success dialog.

Verification:
- Lint: 0 errors.
- TypeScript integrity check: passed (noEmit).

2025-12-30 14:57:09 +08:00

Enhancement:
- Added colored session badges on Gym Booking page: green (Morning), blue (Afternoon), purple (Night 1), amber (Night 2).

Verification:
- Lint: 0 errors.
- TypeScript integrity check: passed (noEmit).

2025-12-30 14:58:44 +08:00

Enhancement:
- Improved session highlighting: the session text now has colored backgrounds matching the legend (pill-style badges) on both desktop and mobile layouts.

Verification:
- Lint: 0 errors.
- TypeScript integrity check: passed (noEmit).

2025-12-30 15:00:24 +08:00

Enhancement:
- Applied colored session badges to Schedules page Session column.

Verification:
- Lint: 0 errors.
- TypeScript integrity check: passed (noEmit).

2025-12-30 15:25:26 +08:00

Enhancement:
- Updated Reports page to use GymDB bookings and show columns: No, ID Booking, Employee ID, Department, Gender, Session, Time In, Time Out.

Backend:
- Added /gym-reports-init to create dbo.gym_reports with schema: ReportID INT IDENTITY PRIMARY KEY, BookingID INT, EmployeeID VARCHAR(20), Department VARCHAR(100), Gender VARCHAR(10), SessionName VARCHAR(50), TimeIn DATETIME NULL, TimeOut DATETIME NULL, ReportDate DATE NOT NULL, CreatedAt DATETIME DEFAULT GETDATE().
- Added indexes on ReportDate and BookingID.
- Added /gym-reports endpoint to list report rows.

Verification:
- Lint: 0 errors.
- TypeScript integrity check: passed (noEmit).

2025-12-30 15:28:43 +08:00

Database:
- Executed POST /api/gym-reports-init on local GymDB service to create dbo.gym_reports.
- Verified with GET /api/gym-reports → ok:true, reports: [].

Notes:
- Table creation is idempotent; route can be re-run safely.

2025-12-30 15:37:16 +08:00

Enhancement:
- Adjusted Reports page columns to: No, Booking ID, Card No, Employee ID, Department, Gender, Session, Time In, Time Out.

Verification:
- Lint: 0 errors.
- TypeScript integrity check: passed (noEmit).

2025-12-30 15:43:20 +08:00

Enhancement:
- Renamed Gym Booking page column label from "Time" to "Time Schedule" (desktop table and mobile card label).

Verification:
- Lint: 0 errors.
- TypeScript integrity check: passed (noEmit).

2025-12-30 15:48:20 +08:00

Enhancement:
- Updated Reports page column set and order to: No, ID, Card No, Employee ID, Department, Gender, In, Out, Time Schedule, Session. CSV export matches the same order.

Verification:
- Lint: 0 errors.
- TypeScript integrity check: passed (noEmit).

2025-12-30 16:17:57 +08:00

Enhancement:
- Management page account creation form: enforced complex passwords (min 8 chars, upper/lower/number/symbol), added Re-confirm Password field, and eye toggles for both fields.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 16:22:15 +08:00

Enhancement:
- Management page: added Column No before Username and an Actions column with edit (opens dialog to update username and role) and delete (confirm dialog; removes roles and profile from listing).

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 16:23:48 +08:00

Enhancement:
- Management page: added Email column after Username in the user accounts table. Currently displays '-' if email is not available from profiles.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 16:26:36 +08:00

Enhancement:
- Edit User dialog: added fields Email, Password, and Re-confirm Password; wired eye toggles; client-side validates matching and complexity, with admin API notices for email/password updates.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 16:29:33 +08:00

Database:
- Added backend route POST /gym-accounts-init to create dbo.gym_account with columns: AccountID, Username, Email, Role (checked), IsActive (default 1), PasswordHash, PasswordAlgorithm, CreatedAt, UpdatedAt. Unique indexes on Email and Username.
- Added backend route GET /gym-accounts to list gym accounts.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 15:45:29 +08:00

Enhancement:
- Removed mock dependencies from Live Gym page; page now displays persisted live door taps.
- Added backend endpoints:
  - GET /gym-live-sync to create dbo.gym_live_taps and sync recent CardDB transactions idempotently.
  - GET /gym-live-persisted to read persisted transactions with optional since and limit.
- Implemented frontend hook useCardTransactions to call sync then fetch, with a watermark and 2s polling.

Verification:
- Ran lint: 0 errors, warnings only.
- Ran TypeScript integrity check: passed (noEmit).
- Manually tested:
  - GET /api/gym-live-sync → ok:true
  - GET /api/gym-live-persisted → ok:true, returns transactions array.

2025-12-30 15:50:37 +08:00

Database:
- Initialized GymDB schema for live transactions: created table dbo.gym_live_taps and unique index UX_gym_live_taps_unique.
- Used one-off script backend/scripts/gym-live-init.js to perform idempotent setup.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
- Queried columns via script output: Id, TrName, TrController, Transaction, CardNo, TrDate, TrTime, TxnTime, CreatedAt.

2025-12-30 15:59:05 +08:00

Enhancement:
- Added UnitNo column to dbo.gym_live_taps and updated backend sync to pull UnitNo from CardDB transactions when available.
- Updated initialization script to create/ensure UnitNo column exists.
- Extended persisted endpoint response to include UnitNo.

Verification:
- Ran initialization script: table columns now include UnitNo.
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 16:08:45 +08:00

Enhancement:
- Filtered live sync to only UnitNo=0041 (Gym Controller) and added aggregated live status endpoint returning per-employee Time In/Out.
- Added EmployeeID capture from CardDB (StaffNo/EmployeeID) into gym_live_taps.
- Implemented frontend hook/useGymLiveStatus and updated Live Gym table to show Name, ID Employee, Department, Schedule, Time In, Time Out, Status.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 16:11:10 +08:00

Database:
- Re-initialized GymDB live schema using backend/scripts/gym-live-init.js.
- Verified columns: Id, TrName, TrController, Transaction, CardNo, TrDate, TrTime, TxnTime, CreatedAt, UnitNo, EmployeeID.

Verification:
- Script output confirms updated schema.
2025-12-30 17:43:47 +08:00

Auth and Supabase Removal Progress:
- Replaced Supabase in public sessions hook with GymDB endpoints: GET /gym-sessions and GET /gym-availability.
- Converted gym sessions CRUD to backend endpoints: POST /gym-session-create, /gym-session-update, /gym-session-delete.
- Remaining Supabase references detected:
  - src/integrations/supabase/client.ts
  - src/hooks/useDatabaseConnections.ts
  - src/hooks/useGymUsers.ts
  - src/hooks/useGymSchedules.ts
  - src/hooks/useGymAnalytics.ts
  - supabase/functions/* (edge functions for public-register, public-sessions, vault-users)

Next Steps:
- Replace remaining hooks with backend routes under backend/routes/gym.js and master.js, or add new endpoints if needed.
- Remove @supabase/supabase-js from dependencies after refactor.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
2025-12-30 17:48:05 +08:00

Login Wiring:
- Login page now accepts email or username and authenticates against dbo.gym_account via /auth/login.
- AuthContext passes either {email,password} or {username,password} to backend and stores JWT in localStorage.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
2025-12-30 20:31:03 +08:00

Auth Troubleshooting:
- Observed 404 HTML response on POST /api/auth/login indicating router not mounted in current backend process.
- Confirmed backend health and gym endpoints working; restarted dev servers recommended to reload auth router.
- Hardened frontend error handling to surface non-JSON/404 clearly.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
2025-12-30 20:34:22 +08:00

Auth Router Verified:
- Restarted dev servers; backend now mounts /auth routes.
- POST /api/auth/login returns JSON (Account not found) as expected, confirming router is active.

Verification:
- Health: GET /api/health → ok:true
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
2025-12-30 20:38:23 +08:00

Auth Env Fixed:
- Added JWT_SECRET to .env and restarted dev servers.
- Verified POST /api/auth/login returns JSON; wiring uses dbo.gym_account.

Verification:
- Health: GET /api/health → ok:true
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
