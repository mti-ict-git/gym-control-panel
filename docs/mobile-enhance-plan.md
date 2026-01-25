
# Mobile Enhancement Plan (Web → Mobile-First → Mobile Apps)

## Goals

- Make the current web app fully usable on phones (touch-first, fast, readable).
- Keep parity between desktop sidebar and mobile bottom navigation.
- Reduce friction for high-frequency admin tasks: Live monitoring, approve/reject bookings, manage schedules.
- Prepare UI patterns that translate cleanly into React Native (Paper/Tamagui).

## High-Level UX Flow

### Admin Daily Flow (Mobile)

1. Open app → Dashboard (quick stats)
2. Tap Live → see who is in gym now (real-time)
3. Tap Booking → approve/reject bookings for today / next 2 days
4. Tap Schedules → manage sessions (quota/time)
5. Tap Settings → profile + system configuration

### Wireframe Descriptions (Shadcn + Tailwind)

#### Bottom Navigation

- 5 items: Dashboard, Live, Booking, Schedules, Settings
- Live shows a small LIVE pill + count of IN_GYM (polling)
- Active state: primary color icon + label

#### Dashboard (Mobile)

- Top: page title + optional date selector
- Middle: 2-column grid of StatCards (collapsing to 1 column on small phones)
- Bottom: key charts as cards with horizontal scroll or simplified sparkline

#### Live Gym (Mobile)

- Default: card list (each person as a card)
- Filters: sticky filter row with chips (Session, Status, Access)
- Search: single input; advanced filters in bottom sheet

#### Booking / Approval (Mobile)

- List as cards (employee name, session, status, time)
- Primary actions: Approve / Reject as large buttons
- Secondary actions in overflow menu (delete if committee/superadmin)

#### Schedules (Mobile)

- Tabs: Sessions (list) / Calendar
- Sessions list: cards with inline edit
- Calendar: week view with large touch targets

## Component Tree

### Web (Shadcn UI + Tailwind)

- App
  - Router
    - ProtectedRoute
      - AppLayout
        - AppSidebar (md+)
        - MobileHeader (sm)
        - Content
        - BottomNav (sm)
    - Pages
      - DashboardPage
      - GymUsersPage (Live)
      - VaultPage (Booking approvals)
      - SchedulesPage
      - ReportsPage
      - SettingsLayout

### Mobile Apps (React Native Paper / Tamagui)

- App
  - AuthStack (if needed)
  - MainTabs
    - DashboardScreen
    - LiveGymScreen
    - BookingScreen
    - SchedulesScreen
    - SettingsStack

## Responsive Guidelines (Web)

- Use a 12-column grid for responsive layouts:

```tsx
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-12 md:col-span-6">...</div>
  <div className="col-span-12 md:col-span-6">...</div>
</div>
```

- Breakpoints
  - Mobile: default (smaller touch-first layout)
  - Tablet/Desktop: `md:` and above (sidebar + denser tables)

- Touch targets
  - Minimum 44px height for primary actions
  - Prefer `Button` sizes `default` / `lg` on mobile

## Accessibility (WCAG 2.1)

- Ensure all interactive icons in bottom nav have text labels.
- Maintain visible focus states (keyboard support for web).
- Use sufficient contrast for badges and LIVE pill.
- Avoid relying on color alone for access status (include text like Granted / No Access).

## Proposed UI Enhancements (Prioritized)

### P0 (Must)

- Replace table-first layouts with mobile card layouts for: Live, Booking, Reports.
- Convert dense filter rows into a filter sheet on mobile.
- Standardize empty/loading states using Shadcn Skeleton + EmptyState.

### P1 (Should)

- Add quick actions:
  - From Dashboard: jump to Booking approvals and Live
  - From Booking cards: swipe actions (mobile app) / buttons (web)
- Add safe inline confirmations for approve/reject (toast + undo pattern).

### P2 (Nice)

- Add offline-friendly caching for lists (React Query staleTime + retries).
- Add push notifications (mobile app) for high occupancy or access denied events.

## Sample UI Code (Web)

### Bottom Nav Layout Pattern

```tsx
export function MobilePageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="p-4 pb-20">{children}</div>
    </div>
  );
}
```

### Mobile Card Grid Example

```tsx
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-12 md:col-span-6">
    <div className="rounded-lg border bg-card p-4">Card A</div>
  </div>
  <div className="col-span-12 md:col-span-6">
    <div className="rounded-lg border bg-card p-4">Card B</div>
  </div>
</div>
```

## Sample UI Code (React Native)

```tsx
import { useMemo } from 'react';
import { View } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider, Text } from 'react-native-paper';

export function AppRoot({ isDark }: { isDark: boolean }) {
  const theme = useMemo(() => (isDark ? MD3DarkTheme : MD3LightTheme), [isDark]);
  return (
    <PaperProvider theme={theme}>
      <View style={{ flex: 1 }}>
        <Text>Gym Control Panel</Text>
      </View>
    </PaperProvider>
  );
}
```

## Backend Endpoints (Reference)

- Live
  - GET `/gym-live-status`
- Booking
  - GET `/gym-bookings?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - POST `/gym-booking-update-status` (approve/reject)
- Schedules
  - GET `/gym-sessions`
  - POST `/gym-session-create`
  - POST `/gym-session-update`
  - POST `/gym-session-delete`
- Reports
  - GET `/gym-reports?...`

## Implementation Phases

### Phase 1 (Mobile Web Parity)

Objective: phone users can complete the core admin tasks end-to-end without zooming.

Scope:

- Navigation parity on mobile (bottom nav)
  - Ensure the 5 key destinations exist on mobile: Dashboard, Live, Booking, Schedules, Settings
  - Add badges/indicators only where it supports real-time decision making (Live)
- Mobile-first layouts for the 2 highest frequency admin pages
  - Live Gym: card list on mobile, table on desktop
  - Booking approvals: card list on mobile, table on desktop

UI work (Web / Shadcn):

- Live Gym
  - Mobile: card component per person, with status + access indicator
  - Filters: keep essential chips visible; move “advanced” filters into a Sheet/Drawer
  - Sticky actions: Search + filter button stay accessible when scrolling
- Booking approvals (Vault)
  - Mobile: booking card shows employee, session, booking date, current approval/status
  - Primary actions: Approve / Reject large buttons
  - Secondary actions: overflow menu (delete, view details)
- Bottom nav + layout
  - Ensure content padding reserves space for bottom nav (pb-20)
  - Ensure active state is clear and accessible (label + icon)

Data/API work:

- Keep polling only for Live screens and Live badge.
- For Booking approvals, use refetch-on-focus + manual refresh button rather than constant polling.

Acceptance criteria:

- Admin can approve/reject a booking from a phone in ≤ 3 taps from Dashboard.
- Live list scrolls smoothly and remains readable on small screens.
- No layout overlap with bottom nav on iPhone-sized viewports.

### Phase 2 (UX Polish)

Objective: reduce friction and errors (touch + data entry), make mobile feel “app-like”.

Scope:

- Standardize mobile patterns across pages
  - “Top section” layout (title + subtitle + primary action)
  - Filter sheet pattern (Sheet with Apply/Reset)
  - Card list pattern (consistent spacing + dividers)
- Improve dense admin screens
  - Reports: mobile card view + optional export action
  - Schedules: improve editing UX (dialog → drawer on mobile)
  - Settings: make nested config easier to scan (section cards)

UI work (Web / Shadcn):

- Filters
  - Replace multi-row filter bars with a single “Filter” button on mobile
  - Use a Sheet/Drawer: date range, status, session, access
  - Provide a compact “active filter summary” row (chips)
- Pagination
  - Prefer “Load more” on mobile instead of page numbers
  - Keep table pagination for desktop
- Forms
  - Add clear validation messages near inputs
  - Use appropriate input modes on mobile where possible

Quality bar:

- WCAG 2.1: labels, focus, contrast, non-color indicators
- Performance: avoid heavy rerenders while typing search/filter

Acceptance criteria:

- All pages have a consistent mobile header + spacing.
- Filters are usable one-handed (sheet + big controls).
- Error messages are clear and actionable.

### Phase 3 (React Native App)

Objective: ship a production mobile app with shared backend contracts and minimal UI rework.

Architecture:

- Navigation
  - Tabs: Dashboard, Live, Booking, Schedules, Settings
  - Stack screens for details: User detail, Booking detail, Session edit
- Shared API contracts
  - Keep endpoints stable (REST)
  - Define a small shared “API client” layer for React Native

Implementation steps:

- Phase 3.1: App shell
  - Build tab navigation and theming (dark/light)
  - Implement auth flow if admin login is required on mobile
- Phase 3.2: Core screens
  - LiveGymScreen with polling and list virtualization
  - BookingScreen with approve/reject actions
  - SchedulesScreen with session management
- Phase 3.3: Production hardening
  - Network error handling and retry strategy
  - Secure token storage (platform-appropriate)
  - Analytics/logging without leaking sensitive info

Acceptance criteria:

- App covers the same admin tasks as mobile web with comparable or better speed.
- Live updates work reliably with background/foreground transitions.
- Release checklist completed (crash-free smoke tests, permission review, app icon/splash).
