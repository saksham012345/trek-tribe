# Organizer OS — run book

The organizer side of TrekTribe, running on its own: 29 screens, the vendor
panels, and nothing a traveller sees.

## What this is, and what it is not

It is **not a copy**. Every screen is imported from `../web/src` through the
`@web` alias, so there is one version of each file and a fix in either place is
a fix in both. What is different here is the shell — no traveller header, no
discovery, and the navigation is always on screen rather than sitting at the
bottom of a dashboard.

It talks to the **same API** and the **same accounts** as the main site. It is a
different front door, not a different system.

```
organizer-os/          this app — shell, routing, sign-in
  src/App.tsx          the frame and the guard
  src/routes.tsx       every screen and where it lives
  src/SignIn.tsx       organizer-only sign-in
  vite.config.ts       the @web alias, and the CRA env shim
../web/src/            where the screens actually live
```

## Running it

Three things have to be up. The organizer app is the last of them.

```bash
# 1. Redis — rate limiting refuses to start without it in production,
#    and the API warns without it in development.
docker run -d --name trektribe-redis -p 6380:6379 redis:7-alpine

# 2. The API, on :4000
cd services/api
npm install
npm run dev

# 3. This app, on :3002
cd organizer-os
npm install
npm run dev
```

Then open **http://localhost:3002** and sign in with an organizer account.

The main web app is **not** required. Run it too if you want to compare the two
front doors, or to act as a traveller against the same data.

## Configuration

The shared code was written for Create React App and reads `process.env`. Vite
does not provide that, so `vite.config.ts` defines the three variables the code
actually reads. Override them per environment:

| Variable          | Default                 | What it is                |
| ----------------- | ----------------------- | ------------------------- |
| `VITE_API_URL`    | `http://localhost:4000` | Where the API lives        |
| `VITE_SOCKET_URL` | `http://localhost:4000` | Socket.IO, same host       |

```bash
VITE_API_URL=https://trektribe.in npm run dev
```

They are listed one by one on purpose. A blanket `process.env` shim would hide
the next variable someone adds, and this app would break again with the same
unhelpful "process is not defined".

## Signing in

Any organizer or admin account. A traveller account signs in and is told
plainly that this app is the organizer side only, rather than being bounced to
a login loop.

Two gates sit in front of a new organizer, both deliberate, both in the API
rather than here:

1. **Admin verification** — until an admin approves the account, creating a
   trip answers "Your organizer account is awaiting admin verification".
2. **An active subscription** — trip creation checks AutoPay and a live
   subscription row.

Everything else — analytics, money, ops, marketing, team, CRM — opens without
either.

## What is on the screen

| Group      | Screens                                                        |
| ---------- | -------------------------------------------------------------- |
| Trips      | All trips, Bookings, Templates                                  |
| Analytics  | Profitability, Occupancy, Customers, Marketing                  |
| Money      | Payouts, Cash flow, Reconciliation, Settlements, Billing        |
| Operations | Documents, Certifications                                       |
| Marketing  | Coupons, Discount rules, Campaigns, Banners, Referrals, Reviews |
| AI         | Studio, Marketing, Insights                                     |
| People     | Customers, Leads, Team, Trip leaders, CRM                       |
| Account    | Settings, Bank & KYC                                            |
| Vendors    | Vendors, assignments, communications                            |

Three entries are shown greyed and disabled: **Invoices**, **GST profile** and
**Integrations**. That is a decision, not an oversight — the first two wait on
a CA's ruling and the third has no requirement yet. They are listed rather than
hidden so the gap reads as deliberate.

## Building it

```bash
npm run build      # typechecks, then builds to dist/
npm run preview    # serves the build on :4173
```

Tailwind scans `../web/src` as well as `./src`. Without that every class the
screens use is stripped from the production build and the app comes out
unstyled — the dev server would not show it, because dev builds nothing away.

## When something looks wrong

- **Blank page, "process is not defined"** — a newly imported screen reads a
  `REACT_APP_*` variable that is not in the `define` block in `vite.config.ts`.
  Add it there.
- **Blank page, no error** — usually a screen whose data has not arrived. Give
  it a few seconds before deciding it is broken; several render a skeleton with
  no text at all.
- **"useLocation() may be used only in the context of a `<Router>`"** — two
  copies of `react-router-dom`, one from this app and one from `../web`. The
  `dedupe` list in `vite.config.ts` exists for exactly this; add the package to
  it. React and react-dom are on that list for the same reason.
- **Styles missing in a built copy but fine in dev** — the Tailwind `content`
  globs have lost `../web/src`.
- **401 on every request** — the API is not running on the port `VITE_API_URL`
  points at.
- **429 on sign-in or verification** — the rate limiters are shared and real.
  `docker exec trektribe-redis sh -c 'redis-cli --scan --pattern "rl:*" | xargs -r redis-cli DEL'`
  clears them in development.

## Adding a screen

1. Write it under `../web/src/pages/organizer-os/`.
2. Add the path to `ORGANIZER_NAV` in `OrganizerNav.tsx` — shared, so it appears
   in both the main site and here.
3. Add it to `src/routes.tsx`.

The route table is one list on purpose: if a screen exists it is on that list,
and if it is on that list the navigation can reach it. Thirty-one screens were
once built, routed, and reachable only by typing a URL, which is the same as
not having built them.
