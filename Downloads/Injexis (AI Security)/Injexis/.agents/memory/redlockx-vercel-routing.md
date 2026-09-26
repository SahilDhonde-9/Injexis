---
name: RedLockX Vercel routing fix
description: How the blank /dashboard route bug was diagnosed and fixed for the redlockx.vercel.app SPA.
---

# RedLockX SPA Routing Fix

## The Bug
Clicking "Get Started" on the landing page navigated to `/dashboard` which showed a blank page.

## Root Cause
1. Wouter `<Route>` used **children syntax** inside Switch (less reliable than `component` prop).
2. Wouter's `navigate()` from a `component`-prop Route can have subtle timing issues with React re-renders.
3. `<WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>` evaluated to `base=""` which may behave differently from no base prop.

## Fix Applied (commit 63ff505)
- **App.tsx**: All routes now use `component` prop consistently. `<WouterRouter>` has no `base` prop. `SpiderWeb` wrapped in its own ErrorBoundary.
- **landing.tsx**: Replaced all `navigate("/dashboard")` calls with `window.location.href = "/dashboard"` via a `go()` helper. Removed `useLocation` import.
- **vercel.json**: Added `Cache-Control: no-store` for `index.html`, long-term cache for `/assets/*`.

**Why:** window.location.href triggers a full page reload → Vercel SPA rewrite serves fresh index.html → React mounts at correct route. Bypasses any wouter client-side navigation quirks.

## Vercel CDN Observation
- New build assets (content-hash named .js files) appear on CDN quickly after build.
- BUT production index.html may show `x-vercel-cache: HIT` (stale) for several minutes.
- Users need hard refresh (Ctrl+Shift+R) or incognito to bypass CDN edge cache after deploy.
- GitHub token stored as `GITHUB_PERSONAL_ACCESS_TOKEN` Replit secret. Push via bash tool: `git push "https://blackXmask:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/blackXmask/RedLockX.git" main`
