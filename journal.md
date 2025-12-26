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

