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
558→- Lint: 0 errors, warnings only.
559→- TypeScript integrity check: passed (noEmit).

Thu Jan 22 05:29:00 WITA 2026

Backend:
- Added console logging in gym access worker for grant and prune operations.

Verification:
- Ran lint: 0 errors, warnings only.

Tuesday, December 30, 2025 9:49:10 PM

Enhancement:
- Profile page now shows Email Verified sourced from GymDB (EmailVerified).

Verification:
- Ran lint: 0 errors, warnings only.
- Ran TypeScript integrity check: passed (noEmit).
Tuesday, December 30, 2025 9:52:42 PM

Database:
- Added LastSignInAt column to dbo.gym_account via /gym-accounts-init.
- Exposed last_sign_in_at in /gym-accounts response and mapped on Profile page.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript check: passed (noEmit).
Tuesday, December 30, 2025 9:57:19 PM

Auth:
- On successful login, backend updates LastSignInAt = SYSDATETIME() for the account.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
Tuesday, December 30, 2025 9:59:26 PM

Auth:
- /auth/me now throttles LastSignInAt updates to every 30 minutes per account.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
Tuesday, December 30, 2025 10:01:48 PM

Auth:
- Added POST /auth/refresh to reissue tokens and update LastSignInAt under the same 30-minute throttle.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
Tuesday, December 30, 2025 10:05:33 PM

Frontend:
- Wired AuthContext to auto-refresh token: interval 30 minutes and on visibility change; rotates auth_token and updates user in context.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
2026-01-21 20:26:59 +0800

Enhancement:
- Added delete action in Gym Booking (Vault) list for COMITTE bookings only.

Verification:
- Ran lint: 0 errors, warnings only.
- Ran TypeScript integrity check: passed (noEmit).
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

Sun Jan 25 10:11:08 WITA 2026

Backend:
- Fixed 5AM date-boundary mismatches by computing “today” in UTC+8 offset (not server timezone) for /gym-live-status and gym-worker.
- Added shared env helpers (envInt, startOfDayUtcDateForOffsetMinutes).

Verification:
- Ran lint: 0 errors (warnings only).
- Ran TypeScript integrity check: passed (noEmit).

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

Wednesday, January 21, 2026 4:51:06 PM

Reliability Fix:
- Controller access route updates overrides only after successful upload.
- Background worker re-attempts uploads when override is stale by time.

Verification:
- Lint: passed (warnings only).
- TypeScript integrity check: passed (noEmit).

2026-01-21 17:25:46 +08:00

Test Preparation:
- Started backend server on http://localhost:5055.
- Fetched sessions; confirmed presence of test_range 17:30–17:35 via GET /gym-sessions.
- Booked MTI230279 for today in session_id "test_range__17:30" using POST /gym-booking-create.
- Response: ok=true, booking_id=612, schedule_id=5.

References:
- Booking create route: [gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L1208-L1606)
- Controller access endpoint: [gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L911-L1152)
- Auto-organize worker: [app.js](file:///c:/Scripts/Projects/gym-control-panel/backend/app.js#L150-L420)

Notes:
- Worker toggles controller access based on in-range bookings with grace windows; settings can be viewed via GET /gym-controller-settings. The override table updates only after successful controller uploads.

2026-01-21 17:37:09 +08:00

Realtime Visibility:
- Added SSE stream endpoints GET /gym-access-stream and /api/gym-access-stream to emit grant/prune/attempt/success/fail events from the worker.
- Added GET /gym-access-log to return recent events snapshot.
- Verified stream by observing worker_tick_start/prune/worker_tick_end with next_interval_ms=300000.

Verification:
- Lint: passed (warnings only).
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

2026-01-21 19:09:51 +0800

Bugfix:
- Updated gym access worker to only auto-grant within session window and avoid auto-pruning manual grants.

Verification:
- Ran lint: 0 errors (warnings only: react-refresh/only-export-components).
- Ran TypeScript integrity check: passed (npx tsc --noEmit).

2026-01-21 19:14:51 +0800

Bugfix:
- Updated /gym-live-status to treat access as granted when either the user is within the booking time window (access_required) or an override exists, so current-session bookings and manual grants no longer show red "No Access" while in-range.

Verification:
- Ran lint: 0 errors (warnings only: react-refresh/only-export-components).
- Ran TypeScript integrity check: passed (npx tsc --noEmit).

2026-01-21 20:09:36 +0800

Bugfix:
- Added Source column to gym_controller_access_override to distinguish WORKER vs MANUAL grants.
- Worker now auto-grants during in-range sessions and auto-prunes only WORKER overrides when out-of-range, leaving manual Vault grants untouched.

Verification:
- Ran lint: 0 errors (warnings only: react-refresh/only-export-components).
- Ran TypeScript integrity check: passed (npx tsc --noEmit).

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

2025-12-30 21:20:55 +08:00

UI:
- Updated Reports table column label from ID to Booking ID.
- Updated CSV export header to Booking ID.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 21:22:30 +08:00

UI:
- Applied themed badges for Session column on Reports: Morning (green), Afternoon (blue), Night - 1 (purple), Night - 2 (amber), fallback gray for others.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 21:24:25 +08:00

UI:
- Mapped gender codes in Reports: M→Male, F→Female, fallback '-'.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 21:29:18 +08:00

UI:
- Fixed sidebar flicker: Management Account visibility now derives directly from user.role and stays constant.
- Also changed sidebar display name to use username or email.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 21:32:14 +08:00

UI:
- Dynamic role label in sidebar footer: shows Super Admin, Committee, Administrator, or User based on user.role.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 21:34:32 +08:00

UI:
- Highlighted sidebar role text in flat red when user.role is Super Admin.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 21:36:43 +08:00

UI:
- Styled Super Admin role label as soft red pill (bg-red-100, text-red-700, rounded) to match theme shown.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 21:41:21 +08:00

UI:
- Added Settings > Configuration sub menu "Controller" and created ControllerSettings page.
- Wired route /settings/config/controller and nav entry.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-30 21:43:45 +08:00

UI:
- Repaired Profile page fields: Last Sign In now from JWT iat; Account Created pulled from gym_account via /gym-accounts.
- User ID now shows account_id; removed Supabase-specific fields.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 10:15:00 +08:00

Reports:
- Set default period to All and moved All to top of Period dropdown.
- Added Next 2 Days period; kept Today strictly single day.
- Showing label displays All Time when All is selected.
- CSV export filename becomes gym-attendance-all.csv when All is selected; otherwise uses start-to-end.

Verification:
- Lint: passed (warnings only).
- TypeScript integrity check: passed (noEmit).

2025-12-31 10:28:00 +08:00

Reports:
- CSV export filenames now vary by Period selection: all, next-2-days, today, yesterday, this-week, this-month, this-year, or from-to for custom.

Verification:
- Lint: passed (warnings only).
- TypeScript integrity check: passed (noEmit).

2025-12-31 09:27:05 +08:00

Login:
- Removed Sign Up tab and any link from Login page; only Sign In remains.

Verification:
- Ran lint: 0 errors, warnings only.
- Ran TypeScript integrity check: passed (noEmit).

2025-12-31 09:29:53 +08:00

Routing:
- Changed route /register to /booking and updated default redirect from / to /booking.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 09:31:08 +08:00

Docs:
- Updated UI UX flow to replace /register with /booking and align copy.
- Updated register-flow doc title and trigger to Booking.

Verification:
- Docs updated; application unaffected.

2025-12-31 09:46:27 +08:00

UI:
- Redesigned 404 Page with animated gradient background, glowing 404 digits, orbiting ring around “0”, and wave footer. Buttons: Go to Booking and Back to Home.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 09:53:46 +08:00

UI:
- Removed Back to Home button from 404 page; kept Go to Booking only.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 09:56:16 +08:00

UI:
- Added exit animation on 404 → Booking navigation: fades and scales the 404 screen before redirecting.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 10:00:08 +08:00

Branding:
- Changed app title and OG metadata to “Super Gym”.
- Updated sidebar and mobile header brand text to “Super Gym”; tagline now “Control Panel”.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 13:25:50 +08:00

Reports:
- Styled Gender column with themed badge chips: Male (blue), Female (pink); fallback muted.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).
 
2025-12-31 13:32:09 +08:00

Reports:
- Added filters: Employee ID, Department, Gender, Session. Updated statistics and CSV export to use filtered data.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 13:52:14 +08:00

Reports:
- Moved "Showing: All Time / Range" helper text to appear directly under Period selector for better placement.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 13:54:14 +08:00

Reports:
- Made filter fields symmetric: switched to a responsive grid (2 cols on mobile, 5 cols on desktop), and set all inputs/selects to full width.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 13:57:59 +08:00

Vault:
- Added searching to booking list (mobile and desktop). Filters by name, employee ID, department, card number, and formatted booking ID. Input includes icon and works live.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 13:59:46 +08:00

Reports:
- Added Name column to table and CSV export; extended BookingRecord interface with optional name.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 14:01:59 +08:00

Backend:
- Added endpoint POST /gym-reports-add-name to alter dbo.gym_reports and add Name column if missing.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 14:04:55 +08:00

Backend:
- Added initializer endpoint POST /gym-reports-init to create dbo.gym_reports with indexes if missing; also ensures Name column exists.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 14:07:22 +08:00

Backend:
- Executed script to add Name column directly: node backend/scripts/add-name-to-gym-reports.js. Result: { ok: true }.

Verification:
- Script returned ok: true.

2025-12-31 14:18:03 +08:00

Reports:
- Name column now reads from API response; supports both name and employee_name properties for backward compatibility. Updated CSV export accordingly.

Verification:
- Lint: 0 errors, warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 14:30:00 +08:00

Backend:
- Added date-aware endpoint GET /gym-live-status-range that aggregates Time In/Out per employee per day within a range.

Reports:
- Wired In/Out columns to use /gym-live-status-range keyed by employee_id + booking_date; CSV export now includes In/Out for the selected period.

Verification:
- Ran lint: warnings only.
- Ran TypeScript integrity check: passed (noEmit).

2025-12-31 14:35:00 +08:00

Performance:
- Added 5s cache for /gym-live-status-range keyed by from|to to reduce repeated queries within the same period.

Verification:
- Lint: warnings only.
- TypeScript integrity check: passed (noEmit).

2025-12-31 14:42:00 +08:00

Backend:
- Added POST /gym-reports-sync that upserts bookings for a date range into dbo.gym_reports and attaches Time In/Out from live taps.

Worker:
- Enabled auto sync (env GYM_REPORTS_SYNC_ENABLE=1) to run every ~20s for today and keep dbo.gym_reports updated as new data arrives.

Verification:
- Lint: passed (warnings only).
- TypeScript integrity check: passed (noEmit).

2025-12-31 14:48:00 +08:00

Database:
- Ensured unique indexes on dbo.gym_reports:
  - UX_gym_reports_BookingID (filtered WHERE BookingID IS NOT NULL)
  - UX_gym_reports_EmpDateSessionStart (EmployeeID, BookingDate, SessionName, TimeStart)
- Updated upsert matching in /gym-reports-sync to include SessionName and TimeStart.

Verification:
- Ran lint: warnings only.
- TypeScript integrity: passed (noEmit).

2025-12-31 14:52:00 +08:00

Backend:
- Added POST /gym-reports-backfill wrapper to trigger /gym-reports-sync for an arbitrary date range; returns inserted/updated counts.

Verification:
- Lint: passed (warnings only).
- TypeScript integrity check: passed (noEmit).
2026-01-22 20:46:26 +08:00

Backend:
- Added /gym-controller/settings API (GET/POST) to manage worker.
- Started backend and verified gym access logs (grant/attempt/success/prune).

Verification:
- Lint: 0 errors (8 warnings).
- TypeScript integrity check: passed (noEmit).

2026-01-24 17:45:43 +08:00

Backend:
- Added console log: running access grant/prune checking at <ISO> on each worker tick.

Verification:
- Lint: 0 errors (warnings only).
- TypeScript integrity check: passed (noEmit).

2026-01-24 17:48:33 +08:00

Backend:
- Changed worker tick log to GMT+8 (YYYY-MM-DD HH:mm:ss GMT+8).

Verification:
- Lint: 0 errors (warnings only).
- TypeScript integrity check: passed (noEmit).

2026-01-25 10:23:28 +0800

Backend:
- Fixed “today” filtering for worker booking reads by using yyyy-MM-dd string compare.
- Allowed pruning of recent legacy MANUAL overrides to resolve stale access.
- Fixed “today” filtering in /gym-live-status for bookings and taps.

Frontend:
- Marked user-triggered access changes as MANUAL_LOCK source.

Verification:
- Lint: 0 errors (warnings only).
- TypeScript integrity check: passed (noEmit).

2026-01-25 10:30:30 +0800

Backend:
- Fixed /gym-live-sync auto-sync window to send full ISO timestamp with timezone.
