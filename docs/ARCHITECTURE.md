# Architecture

How the pieces fit, and why they are arranged this way.

---

## The shape of it

```
                    ┌─────────────────────────────────────┐
                    │           @layoutcraft/core          │
                    │  no DOM · no React · no three.js     │
                    │                                      │
   editor ─────────▶│  units   geometry   validation       │◀──── API routes
   client portal ──▶│  catalog layouts    pricing          │◀──── share links
   tests ──────────▶│  styles  autolayout fabrication      │
                    │          project / migration         │
                    └──────────────┬───────────────────────┘
                                   │ Part[] + Finish
                    ┌──────────────▼───────────────────────┐
                    │        @layoutcraft/render3d          │
                    │  procedural textures → PBR materials  │
                    │  Part → BufferGeometry → merged mesh  │
                    │  lighting · post · cameras · capture  │
                    └───────────────────────────────────────┘
```

Everything commercially meaningful lives in `core`: what a layout costs,
whether a door opens, what the bill of materials says. It has no framework in
it, so the same function that priced a project in the editor prices it again
when a client opens the share link, and a test can call it directly.

`render3d` consumes `core` and knows nothing about the app. `apps/web` consumes
both and owns tenancy, persistence and billing.

---

## The design document

A project is one JSON document, stored in a single `Project.data` column.

```ts
Project {
  v: 3                      // schema version
  rooms:    Room[]          // axis-aligned, wall centreline
  openings: Opening[]       // doors, cased openings, windows, sliding
  items:    PlacedItem[]    // catalog key + centre + 90° rotation
  styleId:  string          // which finish schedule
  rates, currency, units, quote, print, view
}
```

Not normalised tables. The editor loads and saves it atomically, and its shape
changes with product releases rather than with database migrations. A handful
of fields are denormalised onto the `Project` row (`roomCount`, `quoteTotal`,
`styleId`) purely so the gallery does not have to parse every document.

`migrate()` brings any older document forward — v1 called openings `doors` and
flagged cased openings with a boolean; v2 had no window sill. Customers open
quotes they sent eighteen months ago, so every old shape keeps working.

### Trust boundaries

`migrate()` is deliberately forgiving. That is dangerous at an API boundary:
`{ rooms: "nope" }` migrates into a valid *empty* project, and saving that over
a real one destroys a designer's work. So every route that accepts a document
calls `parseProject(input, { strict: true })`, which first requires the input to
be recognisably a project before migrating it.

---

## Geometry

Three coordinate systems, converted at exactly one place each.

| Space | Axes | Units | Used by |
|---|---|---|---|
| Plan | x right, y **down**, z up | mm, integer | the whole domain |
| Scene | x right, y **up**, z = plan y | metres | three.js |
| Model | plan ÷ scale, y flipped | mm | STL for slicers |

### Catalog items

An item is a function from a footprint to a list of `Part`s:

```ts
parts: (w, d, h) => Part[]
```

authored in its own space — x from 0 to w, y from 0 to d, z up from the floor,
facing +y. The author only ever thinks about one piece standing against the far
wall; rotation and placement are applied later.

A `Part` is a shape plus a material **slot**:

```
box · cushion · slab · cyl · lathe · sheet · ball
```

Not just boxes. Seats are crowned, tops have eased edges, legs taper, shutters
sit proud of their carcass with a shadow gap. That is the difference between a
massing study and something a client believes.

The material is a slot name (`woodMid`, `fabric`, `quartz`), never a colour. A
style binds every slot to a `Finish`. Switching style re-skins the entire flat
without touching one vertex, and re-prices it through the style's multiplier.

### Walls

`wallSolids(room, openings, height)` solves one room's four walls into boxes
with openings subtracted. Each opening removes a band from `sill` to
`sill + h`; the wall below the sill and the lintel above the head come out as
separate solids. That is why windows read as windows rather than as
full-height holes.

### Clearance

Every catalog item may declare the clear floor it needs in front to be usable.
`clearanceZone(item)` rotates that strip with the piece. This one property is
what makes the layout engine useful: it is the difference between "does the
wardrobe fit" and "can you open the wardrobe".

---

## The layout engine

A template describes one arrangement for one room type, written against a clear
floor of a given width and depth:

```ts
make: (W, D) => Candidate[]
```

The room it lands in may be any shape, with doors anywhere. So `variantsOf`
generates all eight rigid transforms — four rotations × mirror — maps each into
the real room, and scores it with `quickScore`: collisions, pieces in walls,
blocked clearance, blocked doors, tight walkways. Lower is better; zero means
nothing clashes.

Thirty templates therefore behave like two hundred and forty arrangements, each
measured against the actual plan. `bestTemplate` picks the lowest-scoring
template for a room and `furnishAll` does it for the whole flat.

`quickScore` exists separately from `validate` on purpose: furnishing a flat
evaluates hundreds of candidates, and running the full design review — with its
kitchen-triangle and daylight rules — on each would be wasteful.

Items a designer has **locked** are never replaced.

---

## Rendering

### Procedural materials

Every texture is generated from value, ridged and Worley noise rather than
downloaded. No asset licensing, no CDN, no loading spinner, and — the real
reason — the physical tile size is exact, so a 300 mm tile is 300 mm on a
floor, a wall and a counter alike.

Each pattern fills three buffers: a tint multiplier on the finish's base colour,
a height field, and a per-pixel roughness offset. Height becomes a normal map
via a **normalised** Sobel; the normalisation matters, because an unnormalised
one turns emulsion paint into popcorn stucco and oak into tree bark.

Scale is controlled by a per-pattern `period`: a generated texture covers
`tileMm × period` millimetres, so a high period makes every feature that many
times larger in the world. Plaster uses 1; a fabric weave can afford 4.

Meshes carry UVs measured in **metres**, and each texture's repeat is
`1000 / tileMm`. The mesh builder therefore never needs to know anything about
the material.

### Meshes

`buildItemGeometry` builds each part, then merges by material and caches on
`(catalog key, size)`. Six identical dining chairs share one cached set. Every
geometry is de-indexed, because `mergeGeometries` refuses a mixed batch — and
refuses it by returning `null`, silently dropping the furniture rather than
throwing.

### Lighting

One shadow-casting sun, positioned and coloured from the project's time of day,
plus an image-based environment built from emissive `Lightformer` planes rather
than a downloaded HDRI — so the sky colour follows the clock and nothing is
fetched. Light fittings placed by the designer become real point lights, capped
and sorted by intensity so the chandelier survives and the under-cabinet strip
is what gets dropped.

The post chain is, in order of how much each contributes: ACES tone mapping,
ambient occlusion, bloom on genuinely bright pixels, then a camera-like
vignette and contrast.

---

## The application

### Tenancy

A studio is an `Organization`; people hold a `Membership` with a role. Every
read and write goes through a function in `src/server` that takes a resolved
session — there is no code path that loads a project by id alone.

```
requireSession()  → pages,  redirects to /login
apiSession()      → routes, throws 401
```

Keeping those separate avoids pages that return JSON errors and endpoints
that 302.

### Sessions

Opaque random tokens in an httpOnly cookie, with only a SHA-256 in the
database. A stolen dump contains no usable sessions, and revoking one is a row
delete — neither of which a self-contained JWT gives you.

### Share links

The one path that serves data to someone with no account. A link carries a
scope, and `PRESENTATION` strips rates and tax from the document **on the
server** rather than hiding them in the UI. A link can be pinned to a version,
which is the point: once a quote has gone to a client, the designer must be
able to keep editing without the number the client is looking at changing
underneath them.

### Billing

Stripe, per seat. Price ids live in the environment so staging and production
can point at different accounts without a data migration.

Subscription state is driven entirely by webhooks, never by the checkout
redirect — the redirect is unreliable, and a paid customer who appears unpaid
is the worst bug a SaaS can have. The webhook verifies the signature against
the raw body, and returns 500 on a handler failure so Stripe retries rather
than the event being lost.

Past-due accounts stay editable. Locking a designer out mid-presentation over a
failed card is a good way to lose the customer.

---

## Testing

`packages/core/test` covers the places where a mistake is expensive and
silent: money, migration of files customers already hold, and the geometry the
fabrication exports are cut from. Two of those tests found real bugs during
development — an inverted bathtub spout and a chandelier whose shades hung
above their own mounting ring — both invisible in the renderer, both holes in a
printed model.

Rendering is verified in a real browser with a screenshot pass, not in unit
tests.
