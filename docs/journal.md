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

