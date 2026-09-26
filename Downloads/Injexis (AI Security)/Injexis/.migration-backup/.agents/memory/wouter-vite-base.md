---
name: Wouter routing with Vite BASE_URL base
description: Gotchas when using wouter Router base derived from Vite BASE_URL in Replit multi-artifact projects
---

## Rule
Never add a deep path prefix like `/app` to all routes in wouter when the WouterRouter base is derived from `import.meta.env.BASE_URL`. Keep routes at the same shallow depth as the original app.

**Why:** In Replit's artifact proxy system, the BASE_PATH env var sets Vite's base. The WouterRouter strips this base before matching. Adding `/app/*` prefix on top causes route-not-found (404 from NotFound component) because the base-stripped path no longer matches the declared routes. Nested Switch components inside Route renders also cause similar mismatch.

**How to apply:** When adding a landing page at `/`, move the original home page to `/analyzer` (or another flat route), update all nav hrefs and navigate() calls to match, and keep the single flat Switch in the Router function. Do NOT use nested Switches or wrap routes in an AppShell component.
