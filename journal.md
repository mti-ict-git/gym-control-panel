# Journal

Created: 2025-12-24

This journal tracks decisions, notes, and progress for the project.

## 2025-12-24

- Goals:
  - Set up environment configurations for external systems.
  - Enhance "Gym Users" page to "Live Gym Monitoring" with real-time status.
- Notes:
  - Added `.env` configurations for:
    - Vault API (SOAP).
    - Card Database (MSSQL).
    - Master Employee Database (MSSQL).
  - Updated Sidebar: Renamed "Gym Users" to "Live Gym".
  - Updated `GymUsersPage`:
    - Renamed title to "Live Gym Monitoring".
    - Updated description.
    - Added columns: Name, ID Employee, Department, Schedule, Time In, Time Out, Status.
    - Implemented `useMostRelevantSchedule` hook to prioritize `IN_GYM` status, then `BOOKED`, then `OUT`.
    - Added `StatusBadge` for visual status indication.
- Decisions:
  - Prioritized "IN_GYM" status in the Live Gym view to show who is currently present.
  - Kept Supabase configuration alongside new SQL/API configs.

## 2025-12-26

- Goals:
  - Improve usability of Live Gym Monitoring with search and pagination.
  - Introduce a dim dark mode with a toggle control.
  - Prepare MSSQL schema for live schedules.
- Notes:
  - UI/Theme:
    - Implemented dim dark palette in CSS variables to soften contrast.
    - Added Dark Mode toggle buttons in mobile header and sidebar; preference persisted.
  - Live Gym Monitoring:
    - Added search across name, employee ID, and department.
    - Implemented server-side pagination (10 per page) with total count.
    - Added "No" serial column with correct page-aware numbering.
  - Configuration:
    - Added GymDB env block and separated Master DB with MASTER_DB_ prefix.
  - Database:
    - Created MSSQL migration for dbo.LiveSchedules with constraints (status enum and time order).
    - Implemented credential verification for MSSQL:
      - Added local tester service [db-tester.js](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/server/db-tester.js) with login check via mssql driver.
      - Added script "npm run dbtester" and env [env](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/.env) variable VITE_DB_TEST_ENDPOINT.
      - Updated testing flow [useDatabaseConnections.ts](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/hooks/useDatabaseConnections.ts#L130-L166) to call tester, fallback to Supabase function reachability.
      - Added Supabase edge function reachability checker [test-db](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/supabase/functions/test-db/index.ts).
- Decisions:
  - Use Supabase range + count for efficient pagination.
  - Persist theme in localStorage and default to OS preference on first load.
  - Keep table minimal but add serial for quick referencing.
  - Run credential tester inside LAN for private IP access; cloud functions used only for reachability fallback.

## 2025-12-29

- Goals:
  - Wire Schedules + Register to GymDB `dbo.gym_schedule`.
  - Make Gym Booking show real booking data after registration.
  - Improve session management with edit/delete.
  - Rename and move route from `/vault` to `/gym_booking`.
- Notes:
  - Schedules (GymDB sessions):
    - `SchedulesPage` now reads sessions from GymDB via local tester endpoint `/gym-sessions`.
    - Added create session wiring to GymDB `dbo.gym_schedule` via `/gym-session-create`.
    - Added edit/delete actions in Sessions table, backed by `/gym-session-update` and `/gym-session-delete`.
    - Files:
      - [SchedulesPage.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/pages/SchedulesPage.tsx)
      - [db-tester.js](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/server/db-tester.js)
  - Register (GymDB sessions + quota):
    - Session, time, and available values load from GymDB `dbo.gym_schedule` (Available = `Quota`).
    - Registration inserts booking into Supabase `gym_schedules` via edge function `public-register`.
    - Files:
      - [RegisterPage.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/pages/RegisterPage.tsx)
      - [public-register](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/supabase/functions/public-register/index.ts)
  - Gym Booking (post-register list):
    - Route displays bookings from Supabase `gym_schedules`, enriched from Master DB `MTIMasterEmployeeDB.employee_core`.
    - Session label resolves from GymDB `dbo.gym_schedule` using the GymDB sessions endpoint.
    - Files:
      - [VaultPage.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/pages/VaultPage.tsx)
      - [useVaultUsers.ts](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/hooks/useVaultUsers.ts)
      - [db-tester.js](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/server/db-tester.js)
  - Master Employee DB (employee_core):
    - Added `/employee-core` endpoint to query employee details by `ids` list or `q` search.
    - Supports flexible column naming by inspecting INFORMATION_SCHEMA and mapping to expected fields.
  - Routing:
    - Changed main route from `/vault` to `/gym_booking` and kept a redirect from `/vault` for backward compatibility.
    - Updated sidebar link to `/gym_booking`.
    - Files:
      - [App.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/App.tsx)
      - [AppSidebar.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/components/layout/AppSidebar.tsx)
- Decisions:
  - Keep GymDB + Master DB access on LAN via the local tester service to avoid exposing MSSQL to the browser.
  - Use Supabase `gym_schedules` as the source of truth for booking records, and enrich UI with Master DB employee data.

## 2025-12-30

- Goals:
  - Enhance "Gym Booking" page with Action column, Status column, and better data formatting.
  - Integrate "Gym Booking" page with `DataDBEnt` for ID Card and Department data.
  - Add Date column to "Gym Booking" page.
- Notes:
  - Gym Booking Page:
    - Formatted Gender: "M" -> "Male", "F" -> "Female".
    - Added Status column with icons (Approved/Rejected/Pending).
    - Added Action column with Approve/Reject buttons:
      - Buttons trigger `updateStatusMutation`.
      - Calls `/gym-booking-update-status` endpoint.
    - Added Date column:
      - Positioned after Session column.
      - Displays formatted booking date.
    - Updated Data Sources:
      - ID Card: Now loads from `DataDBEnt.dbo.CardDB` (via `LEFT JOIN` and `ISNULL` fallback).
      - Department: Now loads from `DataDBEnt.dbo.CardDB` (via `ISNULL` fallback).
      - Fixed Date Range: Updated `useVaultUsers` to include "today" in the fetch range.
  - Troubleshooting:
    - Issue: `net::ERR_CONNECTION_REFUSED` on Gym Booking page.
    - Cause: Backend server (`db-tester.js`) was not running.
    - Fix: Restarted backend server using `npm run dbtester`.
  - Dockerization:
    - Created `Dockerfile.backend` for Node.js/Express server.
    - Created `Dockerfile.frontend` for Vite/React app.
    - Created `docker-compose.yml` to orchestrate both services.
    - Added `.dockerignore` to exclude `node_modules` and `.env`.
    - Troubleshooting:
      - Issue: Port 5055 conflict when starting Docker (`bind: Only one usage...`).
      - Cause: Local backend server (`npm run dbtester`) was still running.
      - Fix: Stopped local server and successfully ran `docker compose up -d`.
      - Backend ([db-tester.js](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/server/db-tester.js)):
        - Added `/gym-booking-update-status` POST endpoint.
        - Updated `/gym-bookings` GET query with `OUTER APPLY` / `LEFT JOIN` for `DataDBEnt`.
        - Updated `tryLoadActiveCardNo` to include `CardDB` in table search.
        - Added condition `del_state = 1` when loading active card number.
    - Files:
      - [VaultPage.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/pages/VaultPage.tsx)
      - [useVaultUsers.ts](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/hooks/useVaultUsers.ts)
      - [db-tester.js](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/server/db-tester.js)
      - [backend/routes/gym.js](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/backend/routes/gym.js)
    - Dedupe fix:
      - Changed `/gym-bookings` join to `OUTER APPLY` selecting TOP 1 card from `DataDBEnt.dbo.CardDB` with `Status = 1`, `Block = 0`, and `del_state = 1`.
      - Result: booking list no longer shows duplicate rows per employee.
- Decisions:
  - Use `ISNULL` in SQL to prioritize `DataDBEnt` data while maintaining backward compatibility with existing `gym_booking` data.
  - Implement Action column buttons directly in the table row for quick status updates.
  - Secure status update endpoint with parameterized queries.
  
  - Backend modularization:
    - Entry point: [backend/app.js](file:///c:/Scripts/Projects/gym-control-panel/backend/app.js)
    - Routers: [backend/routes/tester.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/tester.js), [backend/routes/master.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/master.js), [backend/routes/gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js)
    - Utilities: [backend/lib/env.js](file:///c:/Scripts/Projects/gym-control-panel/backend/lib/env.js) for env parsing
  - Scripts:
    - Updated [package.json](file:///c:/Scripts/Projects/gym-control-panel/package.json#L6-L14) to run backend/app.js for dev and dbtester
  - Docker:
    - Updated [Dockerfile.backend](file:///c:/Scripts/Projects/gym-control-panel/Dockerfile.backend#L11-L18) to copy backend/ and run backend/app.js
  - Cleanup:
    - Removed unnecessary wrapper [backend/db-tester.js](file:///c:/Scripts/Projects/gym-control-panel/backend/db-tester.js)
    - Kept legacy monolith [server/db-tester.js](file:///c:/Scripts/Projects/gym-control-panel/server/db-tester.js) for comparison
  - Frontend routing:
    - Default route redirects to "/register" in [App.tsx](file:///c:/Scripts/Projects/gym-control-panel/src/App.tsx#L36-L40)
- Verification:
    - Dev servers restarted successfully; backend on http://localhost:5055 and app on http://localhost:5173/
    - Typecheck passed (npx tsc --noEmit); lint shows only existing warnings

- 2025-12-30 10:54:44
  - Register route behavior:
    - Removed automatic redirect to "/gym_booking" after successful registration.
    - Kept success notification via toast; user remains on Register page.
    - File: [RegisterPage.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/pages/RegisterPage.tsx#L148-L193)

- 2025-12-30 11:04:52
  - Dynamic availability on Register page:
    - Fetches daily availability from `/gym-availability?date=yyyy-MM-dd`.
    - Displays Available = Quota - Booked for the selected session time.
    - Falls back to static quota when availability not loaded.
    - File: [RegisterPage.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/pages/RegisterPage.tsx#L62-L106)

- 2025-12-30 11:12:31
  - Immediate decrement after registration:
    - Decreases Available locally for the selected session.
    - Triggers availability refetch for consistency.
    - Keeps Date and Session values; clears Employee ID only.
    - File: [RegisterPage.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/pages/RegisterPage.tsx#L170-L191)

- 2025-12-30 11:17:30
  - Available format update:
    - Shows booked/quota as "X/Y" (e.g., 0/15) sourced from /gym-availability.
    - Local increment on success updates booked and available then refetches.
    - File: [RegisterPage.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/pages/RegisterPage.tsx#L426-L440)

- 2025-12-30 11:23:53
  - Backend availability now counts from gym_booking:
    - Updated /gym-availability to join gym_schedule with gym_booking by date and status.
    - Returns hhmm, quota, booked_count; frontend shows "booked/quota".
    - File: [backend/routes/gym.js](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/backend/routes/gym.js#L43-L76)

- 2025-12-30 11:34:54
  - Fixed sessions endpoint usage in frontend:
    - useGymDbSessions now uses VITE_DB_TEST_ENDPOINT or falls back to "/api".
    - Resolves 404 errors when backend is not prefixed with "/api".
    - File: [useGymDbSessions.ts](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/hooks/useGymDbSessions.ts#L12-L23)

- 2025-12-30 11:36:50
  - Fixed bookings endpoint usage in frontend:
    - useVaultUsers now uses VITE_DB_TEST_ENDPOINT or falls back to "/api".
    - Resolves 404 for /api/gym-bookings when backend serves /gym-bookings.
    - File: [useVaultUsers.ts](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/hooks/useVaultUsers.ts#L73-L76)

- 2025-12-30 11:41:07
  - Availability fallback added:
    - When /gym-availability lacks a time key, fetches /gym-bookings for that date and computes booked count.
    - Ensures Register shows accurate "booked/quota" even if availability misses a slot.
    - File: [RegisterPage.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/pages/RegisterPage.tsx#L107-L131)

- 2025-12-30 11:42:54
  - UX helper under Available:
    - Added "Remaining: X" helper below Available for clarity.
    - Computes quota − booked for selected session.
    - File: [RegisterPage.tsx](file:///c:/Users/itsupport/Documents/Apps/gym-control-panel/src/pages/RegisterPage.tsx#L441-L452)

  - Documentation:
    - Added "UI UX flow" file to describe user journey, components, responsive guidelines, accessibility, sample code, and backend endpoints
    - File: [UI UX flow.md](file:///c:/Scripts/Projects/gym-control-panel/UI%20UX%20flow.md)
  - Correction:
    - Updated flow for "/register" to reflect actual behavior (Employee ID + Date + Session booking)
    - Clarified that account sign-in/sign-up is at "/login" with tabs
    - Clarified that "/login" is admin-only; employees do not require accounts for booking (HRIS-synced)

- 2025-12-30 12:08:00
  - Changed department precedence in /gym-bookings:
    - Prefer employee_employment.department, then gb.Department, then CardDB.Department
    - Purpose: align display with Master DB over CardDB, avoid missing ec.department
    - File: [backend/routes/gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L444-L451)

- 2025-12-30 12:12:40
  - CardDB env compatibility for booking-create:
    - Support alternate env names CARDDB_* in addition to CARD_DB_*
    - Ensures CardNo collection works with existing .env
    - File: [backend/routes/gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L680-L754)
  - CardNo listing fallback:
    - Use COALESCE(cd.CardNo, gb.CardNo) for card_no in /gym-bookings
    - File: [backend/routes/gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L446)

- 2025-12-30 12:18:30
  - Improve card mapping in booking-create:
    - Add StaffNo/staff_no for employee id matching in CardDB
    - Add IDCard to employee_core card column candidates
    - File: [backend/routes/gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L810-L820)
  - Backfill endpoint:
    - Added /gym-booking-backfill-cardno to update missing CardNo from CardDB
    - File: [backend/routes/gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L520-L571)

- 2025-12-30 12:22:10
  - Use employee_core staff_no for CardDB lookup on booking-create when present
  - Fallback to employee_id if staff_no missing
  - File: [backend/routes/gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L877-L881)

- 2025-12-30 14:03:28
  - Relax CardDB active filter and respect Block/del_state in booking-create
    - Add Block column handling; prefer active cards via ORDER BY instead of WHERE
    - Allow del_state NULL/0; avoid excluding valid cards with nonstandard status
    - Ensures CardNo is stored on insert for cases like MTI240369
  - File: [backend/routes/gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L783-L805)

- 2025-12-30 14:05:45
  - Make Gym Booking menu mobile-friendly with card layout
    - Replace table with responsive card grid (12-column responsive)
    - Show key fields: name, ID card, employee ID, gender, dept, session, time, date, status
    - Keep Approve/Reject actions accessible with icons and labels
  - File: [VaultPage.tsx](file:///c:/Scripts/Projects/gym-control-panel/src/pages/VaultPage.tsx#L104-L178)

- 2025-12-30 14:08:25
  - Restrict card layout to mobile only; keep table for desktop
    - Mobile: md:hidden card grid per booking item
    - Desktop: hidden md:block table with full columns
  - File: [VaultPage.tsx](file:///c:/Scripts/Projects/gym-control-panel/src/pages/VaultPage.tsx#L104-L178)

- 2025-12-30 14:11:26
  - Condense mobile cards with collapsible details to reduce height
    - Compact paddings, text sizes, icon-only actions
    - Accordion for gender/department details on demand
  - File: [VaultPage.tsx](file:///c:/Scripts/Projects/gym-control-panel/src/pages/VaultPage.tsx#L132-L198)

- 2025-12-30 14:21:36
  - Fix Dialog accessibility warning: add DialogTitle to CommandDialog
    - Hidden title with sr-only to satisfy Radix requirement
  - File: [command.tsx](file:///c:/Scripts/Projects/gym-control-panel/src/components/ui/command.tsx#L26-L36)

- 2025-12-30 14:33:30
  - Add CardDB script to insert last transaction into dbo.tblTransactionLive
    - Discovers likely source table and maps columns
    - Ensures tblTransactionLive schema and idempotent insert by unique key
  - File: [pull-transactions.js](file:///c:/Scripts/Projects/gym-control-panel/backend/scripts/pull-transactions.js)

- 2025-12-30 14:35:38
  - Fix index syntax error in pull-transactions ensureTable
    - Removed invalid functional index; rely on IF NOT EXISTS for idempotency
  - Add env overrides for source config (table/columns)
    - CARD_DB_TX_TABLE, CARD_DB_TX_SCHEMA, CARD_DB_TX_TIME_COL, CARD_DB_TX_DEVICE_COL, CARD_DB_TX_CARD_COL, CARD_DB_TX_STAFF_COL, CARD_DB_TX_EVENT_COL
  - File: [pull-transactions.js](file:///c:/Scripts/Projects/gym-control-panel/backend/scripts/pull-transactions.js)
 
- 2025-12-30 14:50:15
  - Added CardDB schema scan script for tblTransactionLive
  - Outputs table existence, columns, indexes, row count, and candidate sources
  - File: [scan-carddb-schema.js](file:///c:/Scripts/Projects/gym-control-panel/backend/scripts/scan-carddb-schema.js)

- 2025-12-30 14:53:04
  - Added script to fetch latest transaction from CardDB
  - Discovers source or falls back to dbo.tblTransactionLive and prints JSON
  - File: [get-latest-transaction.js](file:///c:/Scripts/Projects/gym-control-panel/backend/scripts/get-latest-transaction.js)
