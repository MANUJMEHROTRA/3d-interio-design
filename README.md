# Layoutcraft Studio

Plan, render and quote an interior fit-out from one drawing.

A designer draws the flat once. Layoutcraft furnishes every room with a layout
that clears the doors, renders it well enough to show a client, and prices it
from the same drawing — so the quotation can never disagree with the design.

Sold per seat to interior design studios.

---

## What it does

| | |
|---|---|
| **2D plan** | Real millimetres, wall centreline dimensions, door swings, window symbols. Trace a builder's plan underneath and draw over it. |
| **Auto-layout** | 30 designer layouts across 11 room types, each tried in eight orientations against the actual room and its actual doors, scored and ranked. |
| **Design review** | Blocked door swings, tight walkways, joinery with no room to open, a bed reachable from one side, a kitchen triangle that does not work, a habitable room with no window. |
| **3D** | Procedural PBR materials, image-based lighting that follows the clock, soft shadows, ambient occlusion, ACES tone mapping. Orbit, cutaway doll's-house, eye level, or walk through with WASD. |
| **Stills** | Progressive high-resolution capture for a client deck. |
| **Quoting** | Room-grouped schedule with specs, per-metre and per-m² items, discount, design fee, multiple tax lines, lead times, terms. Multi-currency with lakh/crore grouping. |
| **Client portal** | A share link that needs no account. Choose whether it shows the design, the quotation or both. Freeze it at today's version so a quote cannot change under the client. Optional password, expiry and comments. |
| **Exports** | Quotation, bill of materials, room schedule and design review as CSV; OBJ + MTL massing model for a visualiser; print-ready STLs for a 1:50 presentation model. |
| **SaaS** | Studios, seats, roles, invitations, Stripe per-seat billing with a 14-day trial, version history, audit log. |

Six finish schedules ship: Modern, Indo-contemporary, Scandinavian,
Industrial, Japandi and Luxe classic. Switching style re-skins the whole flat
and re-prices it.

---

## Running it

Requires Node 20.11+ and Docker (for Postgres).

```bash
npm install
cp .env.example .env          # the defaults work for local development
docker compose up -d          # Postgres on port 5434
npm run db:generate
npm run db:migrate
npm run dev                   # http://localhost:3000
```

Then sign up at `/signup`, and start from the sample 2BHK — it is fully
furnished and priced, so you can see the whole workflow before drawing
anything.

### Billing

Stripe is optional. Without keys the app runs normally and the billing page
says so. To enable it, create one recurring per-seat price per plan and
interval in Stripe, put the ids in `.env`, and run:

```bash
npm run stripe:listen         # forwards webhooks to the local app
```

Subscription state is driven entirely by webhooks, never by the checkout
redirect — a customer who closes the tab after paying must still end up with a
working subscription.

### Checks

```bash
npm run check                 # typecheck everything, then run the domain tests
npm test                      # domain tests only
npm run build                 # production build
```

---

## Layout

```
packages/
  core/        The domain. No DOM, no React, no three.js.
               Units, spatial model, furniture catalog, layout engine,
               design review, pricing, fabrication export, migration.
  render3d/    The renderer. React Three Fiber, procedural PBR materials,
               lighting, post-processing, cameras, still capture.
  db/          Prisma schema, client singleton, plan limits.
apps/
  web/         Next.js application: editor, client portal, billing.
```

`packages/core` is the piece that matters. Everything commercially important —
what a layout costs, whether a door opens, what a bill of materials says — is
decided there, by code with no framework in it, which runs identically in the
browser, in an API route and in a test. The quotation a client opens on a share
link is computed by the same function that drew it in the editor.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit, and
[docs/BACKLOG.md](docs/BACKLOG.md) for what to build next.

---

## Decisions worth knowing

**Millimetres everywhere.** The model never holds a float metre. Indian and
European joinery is dimensioned in millimetres, integers survive JSON
round-trips, and snapping to a 5 mm grid is plain integer arithmetic. Unit
conversion happens only at the edges.

**The design is one JSON document.** Not normalised tables. The editor loads
and saves the whole thing atomically, and its shape changes with product
releases rather than with migrations. `migrate()` brings any older document
forward, and every version customers have ever saved keeps opening.

**Migration is forgiving; the API is not.** `parseProject(input, { strict: true })`
is used at every trust boundary. Without it, `{ rooms: "nope" }` would migrate
into a valid *empty* project and saving that over a real one would destroy a
designer's work.

**Textures are generated, not downloaded.** No asset licensing, no CDN, no
loading spinner, and the physical tile size is exact — a 300 mm tile is 300 mm
on a floor, a wall and a counter alike.

**Walls are solved, not drawn.** Each opening removes a band from its wall and
the sill below and lintel above are emitted separately, which is why windows
read as windows instead of full-height holes.

**Clearance is a first-class property.** A wardrobe is not just a box; it is a
box plus the floor it needs to be usable. That one idea is what lets the layout
engine score eight arrangements and tell a designer which one works.
