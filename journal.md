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

  - Documentation:
    - Added "UI UX flow" file to describe user journey, components, responsive guidelines, accessibility, sample code, and backend endpoints
    - File: [UI UX flow.md](file:///c:/Scripts/Projects/gym-control-panel/UI%20UX%20flow.md)
  - Correction:
    - Updated flow for "/register" to reflect actual behavior (Employee ID + Date + Session booking)
    - Clarified that account sign-in/sign-up is at "/login" with tabs
    - Clarified that "/login" is admin-only; employees do not require accounts for booking (HRIS-synced)
