# UI/UX Flow — Gym Control Panel

## Overview

- Hybrid web app (desktop + mobile) built with Vite + React, styled with Shadcn UI + TailwindCSS
- Authentication via Supabase; protected routes use a guard component
- Backend modularized at http://localhost:5055 (Node.js + Express + MSSQL)
- Default route redirects to /register for first-time onboarding

## User Journey

1. Landing → Register (Gym Booking)
   - Visiting / redirects to /register
   - User enters Employee ID, selects Date (tomorrow or next day) and Session, then submits
   - Success toast confirms registration and navigates to Gym Booking list
   - Admin sign-in/sign-up is handled at /login (tabs: Sign In, Sign Up); employees do not need accounts for booking (HRIS-synced)

2. Admin Login → Dashboard
   - Admin-only authentication via Supabase at /login
   - Employees register bookings without logging in (using Employee ID)
   - On admin success, navigates to /dashboard (protected routes)

3. Dashboard → App Navigation
   - High-level stats and charts; occupancy indicator
   - Sidebar (desktop) or BottomNav (mobile) provides access to:
     - Live Gym (Users)
     - Gym Booking
     - Schedules
     - Reports
     - Settings (Profile, Security, Config)

4. Gym Booking
   - View bookings filtered by date range
   - Approve/Reject actions on pending rows
   - Create/update sessions when capacity or times change

5. Users (Live Gym)
   - List of users present/booked/out with search and paging
   - Drill down to user details

6. Schedules
   - List sessions (Start/End/Quota)
   - Add/edit/delete sessions

7. Reports
   - Filtered analytics with charts and export options

8. Settings
   - Profile: account information
   - Security: change password and logout
   - Config: Active Directory, WhatsApp, Database connections

## Screens & Wireframes

### Register (/register)
- Centered Card with inputs and clear CTAs
- Validation messages inline; toast for success or error

Components
- Card, CardHeader, CardContent, Input, Label, Button, Toaster

### Login (/login)
- Similar to Register, includes forgot-password link (optional)

### Dashboard (/dashboard)
- Grid layout with stat cards, occupancy card, chart panels
- Sidebar (desktop) or BottomNav (mobile)

Components
- AppLayout, AppSidebar, StatCard, OccupancyCard, Tabs, Card, Chart primitives

### Gym Booking (/gym_booking)
- Toolbar: date range, status filters, search
- Table: booking rows with Approve/Reject actions; Status and Date columns

Components
- Card, Button, Badge, Table (custom), Separator, DatePicker (react-day-picker), Toast

### Schedules (/schedules)
- Session list with Start/End/Quota
- Dialog/Form to create or edit sessions

Components
- Card, Dialog, Form, Input, Select, Button, Toast

### Reports (/reports)
- Filters top bar, chart area, export actions

### Settings (/settings)
- Left navigation with groups (Profile/Security, Config)
- Right content pane renders selected settings page

Components
- SettingsLayout, Collapsible, NavItem, Card, Input, Button

## Component Tree (Desktop)

- App
  - Router
    - RegisterPage
    - LoginPage
    - DashboardPage
      - AppLayout
        - AppSidebar
        - StatCard, OccupancyCard, Charts
    - GymUsersPage
      - AppLayout
        - UsersList, UserDetail
    - VaultPage (Gym Booking)
      - AppLayout
        - BookingToolbar, BookingTable
    - SchedulesPage
      - AppLayout
        - SessionList, SessionForm
    - ReportsPage
      - AppLayout
        - ReportFilters, ReportCharts
    - SettingsLayout
      - SettingsSidebar
      - ProfileSettings, SecuritySettings
      - ActiveDirectorySettings, WhatsAppSettings, DatabaseList/DatabaseForm

## Component Tree (Mobile)

- App
  - Router
    - RegisterPage
    - LoginPage
    - DashboardPage
      - Header, Content (stacked cards/charts), BottomNav
    - Gym Booking / Schedules / Reports / Settings
      - Header, Content (stacked lists/forms), BottomNav

## Responsive Layout Guidelines

- Use a 12-column grid with consistent gaps
- Example pattern:

```tsx
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-12 md:col-span-6">...</div>
  <div className="col-span-12 md:col-span-6">...</div>
 </div>
```

- Dashboard
  - Main content: col-span-12 md:col-span-8
  - Sidebar panels: col-span-12 md:col-span-4
- Mobile
  - Sidebar hidden; BottomNav fixed at bottom
  - Larger touch targets and stacked content

## Accessibility (WCAG 2.1)

- Labels associated with inputs via htmlFor
- Keyboard navigable components with visible focus
- High contrast text and UI, supports dark mode
- Toasts/alerts announced; aria-live for important updates
- Buttons and controls sized for touch (≥ 44px)

## Sample Code (Web — Register)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function RegisterForm() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Create your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full" type="submit">Register</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Sample Code (Mobile — Booking Card)

```tsx
import { Card, Text, Button } from "react-native-paper";

export function BookingCard({ name, date, status }: { name: string; date: string; status: string }) {
  return (
    <Card>
      <Card.Title title={name} subtitle={date} />
      <Card.Content>
        <Text>{status}</Text>
      </Card.Content>
      <Card.Actions>
        <Button>Approve</Button>
        <Button>Reject</Button>
      </Card.Actions>
    </Card>
  );
}
```

## Backend Endpoints

- Tester
  - POST /test
- Master
  - GET /employees?q=EMP
  - GET /employee-core?ids=EMP1,EMP2&limit=200
- Gym
  - GET /gym-availability?date=YYYY-MM-DD
  - GET /gym-sessions
  - POST /gym-session-create
  - POST /gym-session-update
  - POST /gym-session-delete
  - POST /gym-schedule-create
  - GET /gym-bookings?from=YYYY-MM-DD&to=YYYY-MM-DD
  - POST /gym-booking-update-status
  - POST /gym-booking-create
  - POST /gym-booking-init

## References

- Routing: App and protected routes
  - [App.tsx](file:///c:/Scripts/Projects/gym-control-panel/src/App.tsx)
  - [ProtectedRoute.tsx](file:///c:/Scripts/Projects/gym-control-panel/src/components/ProtectedRoute.tsx)
- Settings layout and navigation structure
  - [SettingsLayout.tsx](file:///c:/Scripts/Projects/gym-control-panel/src/pages/settings/SettingsLayout.tsx)
- Backend modular entry and routers
  - [backend/app.js](file:///c:/Scripts/Projects/gym-control-panel/backend/app.js)
  - [backend/routes/gym.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/gym.js)
  - [backend/routes/master.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/master.js)
  - [backend/routes/tester.js](file:///c:/Scripts/Projects/gym-control-panel/backend/routes/tester.js)
