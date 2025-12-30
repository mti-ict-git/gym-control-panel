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

2025-12-30 13:58:18 +08:00

Enhancement:
- Calendar highlight color updated to light blue (bg-blue-100/text-blue-900 with subtle ring) to match the requested visual.

Verification:
- Lint: 0 errors.
- TypeScript check: passed.

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
