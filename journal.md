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
