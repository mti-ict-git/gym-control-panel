# Register Flow — Frontend and Backend

- Trigger: User clicks Register on the Gym Booking form
- Goal: Create a booking in GymDB with quota/duplicate checks and enrich data from MasterDB/CardDB

## Frontend

- Submits payload with employee_id, session_id ("Session__HH:MM"), booking_date (yyyy-MM-dd)
  - See onSubmit in [RegisterPage.tsx:L223-L246](file:///c:/Scripts/Projects/gym-control-panel/src/pages/RegisterPage.tsx#L223-L246)
- On success:
  - Shows confirmation toast and updates local availability, then refetches for accuracy
  - See [RegisterPage.tsx:L255-L277](file:///c:/Scripts/Projects/gym-control-panel/src/pages/RegisterPage.tsx#L255-L277)
- Availability sourcing:
  - Primary: GET /gym-availability?date=yyyy-MM-dd → booked/quota per HH:MM
  - Fallback: GET /gym-bookings for selected date → compute booked count for selected HH:MM
  - See [RegisterPage.tsx:L147-L186](file:///c:/Scripts/Projects/gym-control-panel/src/pages/RegisterPage.tsx#L147-L186) and [RegisterPage.tsx:L200-L221](file:///c:/Scripts/Projects/gym-control-panel/src/pages/RegisterPage.tsx#L200-L221)
- Sessions list:
  - Loaded from GymDB via GET /gym-sessions, option value becomes composite session_id
  - See [gym.js:L118-L135](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L118-L135) and [RegisterPage.tsx:L62-L70](file:///c:/Scripts/Projects/gym-control-panel/src/pages/RegisterPage.tsx#L62-L70)

## Backend

- POST /gym-booking-create
  - Validates GymDB and MasterDB envs; returns 500 on missing configuration
  - Parses session_id into session_name + time_start; looks up ScheduleID/Quota in dbo.gym_schedule
  - Duplicate booking check: EmployeeID + BookingDate where Status ∈ {BOOKED, CHECKIN}
  - Quota check: ScheduleID + BookingDate count against Quota
  - Loads employee from Master DB employee_core (schema/column discovery) and optionally latest department from employee_employment
  - Tries active CardNo from CardDB; falls back to MasterDB card_no if present
  - Inserts into dbo.gym_booking with Status = 'BOOKED' and returns booking_id
  - See [gym.js:L572-L611](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L572-L611), [gym.js:L762-L799](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L762-L799), [gym.js:L802-L875](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L802-L875), [gym.js:L883-L901](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L883-L901)

## Supporting Endpoints

- GET /gym-availability?date=yyyy-MM-dd
  - Joins gym_schedule with gym_booking by date to compute quota and booked_count
  - See [gym.js:L7-L80](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L7-L80)
- GET /gym-sessions
  - Reads session_name, time_start, time_end, quota from dbo.gym_schedule
  - See [gym.js:L118-L135](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L118-L135)
- GET /gym-bookings
  - Returns booking rows with employee and card info, used by list page and availability fallback
  - See [gym.js:L429-L507](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L429-L507)

## Payloads and Responses

- Submit payload:
  - employee_id: string
  - session_id: "Session__HH:MM"
  - booking_date: "yyyy-MM-dd"
  - See [RegisterPage.tsx:L226-L235](file:///c:/Scripts/Projects/gym-control-panel/src/pages/RegisterPage.tsx#L226-L235)
- Success response:
  - { ok: true, booking_id: number, schedule_id: number }
  - See [gym.js:L898-L901](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L898-L901)
- Failure (200 with ok: false):
  - Duplicate booking, session full, employee not found, session not found, or missing required columns
  - See [gym.js:L771-L774](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L771-L774), [gym.js:L783-L786](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L783-L786), [gym.js:L795-L799](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L795-L799), [gym.js:L821-L824](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L821-L824), [gym.js:L841-L844](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L841-L844)
- Server errors (500):
  - GymDB/MasterDB env not configured; frontend uses fallback path
  - See [gym.js:L601-L611](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L601-L611) and [RegisterPage.tsx:L236-L246](file:///c:/Scripts/Projects/gym-control-panel/src/pages/RegisterPage.tsx#L236-L246)

## Note on CardDB Lookup

- Table discovery checks common candidates including CardDB/employee_card variants
- See tableCandidates in [gym.js:L701-L704](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js#L701-L704)
