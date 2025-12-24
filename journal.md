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

