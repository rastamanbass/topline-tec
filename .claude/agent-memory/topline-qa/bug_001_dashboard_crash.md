---
name: BUG-001 Dashboard crash showCosts
description: Critical production crash on /dashboard for ALL users — showCosts ReferenceError from minified build
type: project
---

## BUG-001: Dashboard crashes for ALL users — `showCosts is not defined`

**Severity**: Critical
**Feature**: Dashboard (/dashboard)
**Status**: Open (found 2026-04-10)
**Affects**: 100% of users — every login redirects to /dashboard which immediately crashes

### Root Cause
Commit `9a89421 feat(permissions)` added `const showCosts = canViewCosts(user?.email)` to DashboardPage.
The Vite/Rollup minifier in the production build (`dist/assets/DashboardPage-BRMILlK9.js`) dropped the assignment:
- Source: `const showCosts = canViewCosts(user?.email);`
- Compiled: `Me(t?.email);` (return value discarded — no `const showCosts =`)
- Result: `showCosts` used in JSX but never assigned → ReferenceError at runtime

**Why:** `showCosts` is used only in JSX (`{showCosts && ...}`) at line 510. Rollup/Vite tree-shaking may have
treated it as side-effect-free if it saw `canViewCosts` as pure and `showCosts` only in JSX template.

### Workaround
"Recargar página" button works — the reload navigates to /inventory (last visited route) and bypasses /dashboard.
Users CAN use the app after hitting reload, but the dashboard KPI page is completely inaccessible.

### Fix Required
Option A: Rebuild and redeploy — the source code is correct, just the minification went wrong.
Option B: Add `showCosts` to a dependency array or use it in a non-JSX expression to prevent tree-shaking.

**Why:** Vite minifier dropped the assignment as dead code. Re-running `npm run build` may fix it,
or the variable name may need to be preserved explicitly.

### Steps to Reproduce
1. Login as any user
2. Navigate to /dashboard (this is the post-login redirect)
3. See "Algo salió mal — showCosts is not defined"
4. Click "Recargar página" to recover

### Evidence
- `/dist/assets/DashboardPage-BRMILlK9.js` contains `Ve();Me(t?.email);` — no assignment
- Screenshots: admin-dashboard-crash.png, dashboard-current-user.png
