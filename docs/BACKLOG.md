# Backlog

What to build next, ordered by how much it is worth against how hard it is.

Each item says **why** it matters commercially, not just what it is. The
numbering is for reference, not priority within a tier.

---

## Tier 0 — before charging anyone money

These are not features. They are the difference between a demo and a product
you can take money for.

**0.1 Transactional email.**
Invitations are currently handed to an admin as a link to paste. Password reset
does not exist at all, and `VerificationToken` is in the schema but unused. Wire
Resend or SES behind a small `sendMail` interface and cover: email verification,
password reset, studio invitation, "your client opened the quote", "your trial
ends in 3 days", and the Stripe dunning hand-off. Without password reset you
will lose accounts permanently on the first forgotten password.

**0.2 Rate limiting and abuse controls.**
Sign-in, sign-up, share-link password attempts and the comment endpoint are all
unthrottled. The share password check in particular is a public brute-force
target. Add a fixed-window limiter keyed on IP and on account.

**0.3 Project thumbnails.**
`Project.thumbnailUrl` exists and is never filled. Render a small still on save
(the still-capture path already exists) and store it. A project gallery of grey
cards is the first thing a prospect sees and it currently looks unfinished.

**0.4 Error tracking and structured logs.**
`console.error` is not an error strategy for something customers pay for. Add
Sentry (or equivalent) with release tagging, and make the webhook handler's
failures alert rather than merely retry.

**0.5 Backups and restore drill.**
Projects are a studio's commercial record. Automated Postgres backups, and an
actual tested restore — not just a backup schedule.

**0.6 Legal pages.**
Terms, privacy policy, and a data-processing position. You cannot sell B2B
software in India or the EU without them, and procurement will ask.

---

## Tier 1 — the features that close sales

**1.1 Path-traced render mode.**
The current "Render a still" raises resolution and quality and lets ambient
occlusion converge. It is a real step up from a screenshot, and it is not path
tracing — there is no secondary light transport, so no colour bleeding and no
true soft shadows from area lights. Adding `three-gpu-pathtracer` as an opt-in
mode would produce images a studio can put in a pitch deck unedited. This is
the single biggest perceived-quality jump available.

**1.2 Elevations and working drawings.**
Studios do not sell 3D; they sell drawings a contractor can build from. Generate
per-wall elevations with dimensions, a furniture layout plan, an electrical
point layout and a false-ceiling plan, all as a paginated PDF with a title
block. This is frequently the actual reason a studio buys software.

**1.3 Custom catalog items.**
Every studio has joinery details and vendors of their own. Let them define items
— name, size, parametric carcass, finish slots, rate, lead time — and share them
across the organisation. Without this, Layoutcraft is somebody else's furniture,
and that ceiling is low.

**1.4 Rate cards applied to projects.**
`RateCard` is in the schema and in the settings model but is not yet applied
when a project is created or switched. Finish the loop: pick a rate card per
project, show which rates are overridden, and support a markup percentage per
category.

**1.5 Real-time collaboration.**
Two designers in one project, with presence and live cursors. The document is
already a single JSON blob with a version history, so the honest path is CRDT
(Yjs) over the item list rather than operational transform. Until then, add
optimistic-concurrency detection so the second saver is warned instead of
silently overwriting.

**1.6 Client approval workflow.**
A share link currently informs. Make it decide: an Approve button that records
who approved what and when, per-room sign-off, and a change-request thread that
turns into a revision. This is what moves a studio from "nice renders" to
"runs our projects".

**1.7 Mobile and tablet.**
The editor assumes a mouse and a wide screen. A read-only tablet presentation
mode — walk, swipe between rooms, show the quote — is what a designer actually
carries to a client's flat.

---

## Tier 2 — depth in the design tooling

**2.1 Non-rectangular rooms.**
Rooms are axis-aligned rectangles. Real flats have L-shapes, bay windows,
angled walls and columns. Moving to a polygon room (still orthogonal first,
then arbitrary) is the largest single piece of domain work here, and it touches
wall solving, the layout engine and the area calculation.

**2.2 Multi-floor projects.**
Villas and duplexes. Needs a floor concept, a stair element, and a 3D view that
can show one floor or all.

**2.3 Import a DWG or PDF plan properly.**
Tracing a bitmap works but is manual. Parsing a PDF's vector layer to extract
walls and openings automatically would remove the slowest step in onboarding a
real project.

**2.4 AI plan reading.**
The original prototype could read rooms from a photographed plan with a vision
model. It is genuinely useful and should come back — as a server-side endpoint
with the studio's own key or a metered allowance, not a client-side call.

**2.5 Curtains, blinds and soft furnishing takeoff.**
Curtains exist as decor but are not measured properly. Window-by-window
measurement with fullness ratio and fabric quantity is a line item studios
currently compute in spreadsheets.

**2.6 Electrical and plumbing points.**
Switch, socket, light and plumbing positions, with a schedule. Closely tied to
2.2 (working drawings) and frequently the thing that gets a fit-out wrong on
site.

**2.7 Site measurement mode.**
Enter measured dimensions room by room on a phone at site, and have the plan
build itself. Removes the transcription step between survey and drawing.

**2.8 Material and finish library with real samples.**
Procedural materials are good and scale-correct, but a studio wants to specify
an actual laminate code. Let them upload a swatch image and bind it to a
material slot, carrying the vendor code into the bill of materials.

**2.9 Daylight study.**
The sun position already follows the clock. Add a date, a latitude and a
shadow-path animation, and it answers "will this bedroom get morning light" —
a question clients actually ask.

**2.10 Ergonomic and accessibility checks.**
Wheelchair turning circles, grab-rail zones, worktop heights, reach ranges.
A differentiator for commercial and senior-living work.

---

## Tier 3 — commercial and operational

**3.1 Razorpay alongside Stripe.**
For India-only studios, UPI and autopay mandates convert far better than card.
The billing layer is already behind a small interface; add a second provider
rather than replacing the first.

**3.2 Annual invoicing and purchase orders.**
Larger practices will not pay by card. Needs an invoice-and-bank-transfer path
and a way to mark an organisation as manually billed.

**3.3 Per-project client billing.**
Studios bill their own clients. Letting them raise an invoice from an approved
quote, track payment milestones and see what is outstanding turns Layoutcraft
into the system of record rather than a drawing tool.

**3.4 Vendor and procurement module.**
Split a bill of materials by vendor, raise purchase orders, track delivery
against the lead times already held per item.

**3.5 Usage analytics.**
Which layouts get applied, which get replaced immediately, which validation
rules get ignored. This is how the layout engine gets better, and it is cheap
to collect.

**3.6 Template projects and studio presets.**
A studio doing twenty identical 2BHKs for a developer wants to start from their
own standard. Projects as templates, plus standard terms and standard rooms.

**3.7 Public API and webhooks.**
Larger practices will want projects in their own CRM. A read API plus
`project.approved` and `quote.viewed` webhooks.

---

## Tier 4 — engineering debt and hardening

**4.1 Tailwind v4.**
Currently on v3. The remaining `npm audit` findings are all transitive dev
dependencies of Tailwind's v3 build chain (`braces`, `micromatch`, `chokidar`,
`postcss-selector-parser`). None is reachable at runtime, but the upgrade
clears them and the CSS build gets considerably faster.

**4.2 Doorway-accurate walkthrough collision.**
Walk mode constrains the camera to the union of rooms and to furniture
footprints, so you can step between adjacent rooms without using the door. It is
a deliberate trade — getting stuck on a door frame is worse — but a proper
portal test through openings would be better.

**4.3 Geometry in a worker.**
Building the shell and the furniture meshes blocks the main thread on a large
project. Move it to a worker with transferable buffers.

**4.4 Instanced rendering.**
Six identical dining chairs currently share cached geometry but draw
separately. `InstancedMesh` per (catalog key, size, material) would cut draw
calls substantially on large projects.

**4.5 Level of detail.**
Full furniture geometry is drawn whether a piece is 1 m or 30 m from the
camera. A simple two-level LOD would pay for itself on a whole-floor view.

**4.6 Undo granularity and the save queue.**
Undo is a whole-document snapshot capped at 80 steps, which is simple and
memory-hungry. Patch-based history would also give a cleaner path to
collaboration (1.5).

**4.7 Playwright end-to-end tests in CI.**
The flows are currently verified with a bespoke HTTP script and a Puppeteer
screenshot pass. Promote both into Playwright specs with visual snapshots of
the 3D canvas, and run them on every pull request.

**4.8 Accessibility audit.**
The plan canvas is pointer-only; there is no keyboard path to select or move a
piece, and the SVG has no accessible structure. At minimum: keyboard selection,
an `aria-live` summary of the design review, and a focus-visible pass over the
editor.

**4.9 Soft delete and retention.**
`deleteProject` is permanent and immediate. A 30-day recycle bin costs almost
nothing and prevents the worst support ticket there is.

**4.10 Seat enforcement.**
Seats are counted and shown, and invitations are blocked past the limit, but an
existing membership is never disabled when a subscription downgrades. Decide the
policy (oldest members keep access, admin chooses) and implement it.
