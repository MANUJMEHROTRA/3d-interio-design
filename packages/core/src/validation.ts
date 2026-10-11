import { CATALOG } from "./catalog/index.js";
import {
  clearanceZone,
  footprint,
  innerRect,
  openingKeepOut,
  openingsOn,
  rectContains,
  rectsOverlap,
  roomAt,
  WALL_T,
} from "./geometry.js";
import type { Issue, PlacedItem, Project, Rect, Room, ValidationReport } from "./types.js";

/**
 * Minimum clear walkway between two pieces of furniture, mm.
 *
 * 600 is what Indian residential practice actually builds to — the aisle at
 * the foot of a bed in a 3.5 m bedroom is routinely 620 mm and nobody
 * considers it a defect. 900 is the comfortable figure for a main route, so
 * anything under that is worth mentioning but not worth flagging red.
 */
const WALK_MIN = 600;
const WALK_PREFERRED = 900;
/** Below this, two pieces genuinely cannot both be used. */
const WALK_CRITICAL = 450;

/** Rooms smaller than this are almost certainly a drafting mistake. */
const ROOM_MIN_AREA_M2: Partial<Record<Room["type"], number>> = {
  living: 9,
  bedroom: 7.5,
  kids: 6.5,
  kitchen: 4.5,
  dining: 6,
  bath: 2.2,
  study: 4.5,
};

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const nameOf = (key: string) => lower(CATALOG[key]?.name ?? key);

const compatible = (a: PlacedItem, b: PlacedItem): boolean =>
  (CATALOG[a.key]?.compatible ?? []).includes(b.key) ||
  (CATALOG[b.key]?.compatible ?? []).includes(a.key);

/**
 * Props do not block circulation. A planter beside a TV unit or a pendant over
 * a table is styling, not an obstruction, and flagging it trains designers to
 * ignore the review panel — which is worse than not having one.
 */
const blocksCirculation = (item: PlacedItem): boolean => {
  const c = CATALOG[item.key];
  if (!c) return false;
  if (c.flat || c.wallHung || c.ceilingHung || c.standIn) return false;
  if (c.category === "Decor" || c.category === "Lighting") return false;
  return true;
};

/** Gap between two rectangles along the axis on which they actually face each other. */
function gapBetween(a: Rect, b: Rect): number | null {
  const xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const yOverlap = Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y);
  if (xOverlap > 200 && yOverlap <= 0) return -yOverlap;
  if (yOverlap > 200 && xOverlap <= 0) return -xOverlap;
  return null;
}

export function validate(p: Project): ValidationReport {
  const issues: Issue[] = [];
  const blockedOpenings = new Set<string>();
  const seen = new Set<string>();

  const push = (i: Issue) => {
    const sig = `${i.target}|${i.code}|${i.message}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    issues.push(i);
  };

  const live = p.items.filter((i) => CATALOG[i.key]);
  /** Floor-standing, non-flat pieces are the ones that can actually collide. */
  const solid = live.filter((i) => {
    const c = CATALOG[i.key]!;
    return !c.flat && !c.wallHung;
  });
  const feet = solid.map(footprint);

  /* --- items in the right place -------------------------------------- */
  solid.forEach((it, i) => {
    const f = feet[i]!;
    const room = roomAt(p.rooms, it.cx, it.cy);
    if (!room) {
      push({
        target: it.id,
        targetKind: "item",
        severity: "error",
        code: "item.outside",
        message: "Sits outside every room.",
      });
      return;
    }
    if (!rectContains(innerRect(room), f, 2)) {
      push({
        target: it.id,
        targetKind: "item",
        severity: "error",
        code: "item.inWall",
        message: `Runs into a wall of ${room.name}.`,
      });
    }
  });

  /* --- collisions ----------------------------------------------------- */
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i]!;
      const b = solid[j]!;
      if (compatible(a, b)) continue;
      if (rectsOverlap(feet[i]!, feet[j]!, 2)) {
        push({
          target: a.id,
          targetKind: "item",
          severity: "error",
          code: "item.overlap",
          message: `Overlaps the ${nameOf(b.key)}.`,
        });
        push({
          target: b.id,
          targetKind: "item",
          severity: "error",
          code: "item.overlap",
          message: `Overlaps the ${nameOf(a.key)}.`,
        });
      }
    }
  }

  /* --- usable clearance in front of things ---------------------------- */
  solid.forEach((a, i) => {
    const zone = clearanceZone(a);
    if (!zone) return;
    const need = CATALOG[a.key]!.clearance!;
    solid.forEach((b, j) => {
      if (i === j || compatible(a, b) || !blocksCirculation(b)) return;
      if (rectsOverlap(zone, feet[j]!, 30)) {
        push({
          target: a.id,
          targetKind: "item",
          severity: "error",
          code: "item.clearance",
          message: `Needs ${need} mm clear in front to be usable. The ${nameOf(b.key)} is in the way.`,
        });
      }
    });
    // clearance must also be inside the room, not buried in a wall
    const room = roomAt(p.rooms, a.cx, a.cy);
    if (room && !rectContains(innerRect(room), zone, 2)) {
      push({
        target: a.id,
        targetKind: "item",
        severity: "warning",
        code: "item.clearanceWall",
        message: `Its ${need} mm working space runs past a wall. Pull it away from the wall or turn it.`,
      });
    }
  });

  /* --- doors must open ------------------------------------------------ */
  p.openings.forEach((op) => {
    for (const zone of openingKeepOut(op)) {
      solid.forEach((a, i) => {
        if (rectsOverlap(zone, feet[i]!, 30)) {
          blockedOpenings.add(op.id);
          push({
            target: a.id,
            targetKind: "item",
            severity: "error",
            code: "item.blocksDoor",
            message:
              op.kind === "cased"
                ? "Stands in a doorway."
                : "Blocks a door — the leaf cannot swing past it.",
          });
        }
      });
    }
  });

  /* --- walkways ------------------------------------------------------- */
  const circulating = solid.filter(blocksCirculation);
  const circFeet = circulating.map(footprint);
  for (let i = 0; i < circulating.length; i++) {
    for (let j = i + 1; j < circulating.length; j++) {
      const a = circulating[i]!;
      const b = circulating[j]!;
      if (compatible(a, b)) continue;
      const ra = roomAt(p.rooms, a.cx, a.cy);
      if (!ra || ra !== roomAt(p.rooms, b.cx, b.cy)) continue;
      const gap = gapBetween(circFeet[i]!, circFeet[j]!);
      if (gap === null || gap <= 0 || gap >= WALK_MIN) continue;
      push({
        target: a.id,
        targetKind: "item",
        severity: gap < WALK_CRITICAL ? "error" : "warning",
        code: "walkway.tight",
        message: `Only ${Math.round(gap)} mm to the ${nameOf(b.key)}. Allow at least ${WALK_MIN} mm to walk through.`,
      });
    }
  }

  /* --- room-level design review --------------------------------------- */
  p.rooms.forEach((room) => {
    const inner = innerRect(room);
    const areaM2 = (inner.w * inner.d) / 1e6;
    const min = ROOM_MIN_AREA_M2[room.type];
    if (min && areaM2 < min) {
      push({
        target: room.id,
        targetKind: "room",
        severity: "warning",
        code: "room.small",
        message: `${areaM2.toFixed(1)} m² is tight for a ${room.type}. ${min} m² is the usual minimum.`,
      });
    }
    if (inner.w < 1800 || inner.d < 1800) {
      if (room.type !== "bath" && room.type !== "utility" && room.type !== "passage" && room.type !== "balcony") {
        push({
          target: room.id,
          targetKind: "room",
          severity: "warning",
          code: "room.narrow",
          message: "Narrower than 1.8 m in one direction — furniture layouts will be awkward.",
        });
      }
    }

    const inRoom = live.filter((i) => roomAt(p.rooms, i.cx, i.cy) === room);
    const keys = new Set(inRoom.map((i) => i.key));

    if (!openingsOn(p.openings, room).length) {
      push({
        target: room.id,
        targetKind: "room",
        severity: "error",
        code: "room.noAccess",
        message: "No door or opening — this room cannot be entered.",
      });
    }

    const hasDaylight = openingsOn(p.openings, room).some(
      (o) => o.kind === "window" || o.kind === "frenchWindow",
    );
    if (!hasDaylight && ["living", "bedroom", "kids", "study", "dining"].includes(room.type)) {
      push({
        target: room.id,
        targetKind: "room",
        severity: "warning",
        code: "room.noDaylight",
        message: "No window. Habitable rooms normally need natural light and ventilation.",
      });
    }

    const litByFixture = inRoom.some((i) => CATALOG[i.key]?.lights);
    if (!litByFixture && inRoom.length > 0) {
      push({
        target: room.id,
        targetKind: "room",
        severity: "info",
        code: "room.noLight",
        message: "No light fitting specified. Add a pendant, cove or track to light the render.",
      });
    }

    // kitchen work triangle
    if (room.type === "kitchen") {
      const find = (k: string) => inRoom.find((i) => i.key === k);
      const sink = find("sink");
      const hob = find("hob");
      const fridge = find("fridge");
      if (sink && hob) {
        const dist = Math.hypot(sink.cx - hob.cx, sink.cy - hob.cy);
        if (dist < 600) {
          push({
            target: room.id,
            targetKind: "room",
            severity: "warning",
            code: "kitchen.triangle",
            message: `Only ${Math.round(dist)} mm between sink and hob. Allow 600–1800 mm of landing space.`,
          });
        }
      }
      if (!sink || !hob) {
        push({
          target: room.id,
          targetKind: "room",
          severity: "info",
          code: "kitchen.incomplete",
          message: `Kitchen is missing a ${!sink ? "sink" : "hob"}.`,
        });
      }
      if (fridge && sink) {
        const dist = Math.hypot(fridge.cx - sink.cx, fridge.cy - sink.cy);
        if (dist > 4500) {
          push({
            target: room.id,
            targetKind: "room",
            severity: "info",
            code: "kitchen.triangleLong",
            message: "Fridge is a long walk from the sink — consider moving it closer.",
          });
        }
      }
    }

    // bedrooms want access to both sides of a double bed
    const bed = inRoom.find((i) => i.key === "bedKing" || i.key === "bedQueen");
    if (bed) {
      const f = footprint(bed);
      const leftGap = f.x - inner.x;
      const rightGap = inner.x + inner.w - (f.x + f.w);
      if (leftGap < 600 && rightGap < 600) {
        push({
          target: bed.id,
          targetKind: "item",
          severity: "warning",
          code: "bed.access",
          message: "Less than 600 mm on either side — one side of the bed will be hard to reach.",
        });
      }
      if (!keys.has("wardrobe") && !keys.has("wardrobeSliding")) {
        push({
          target: room.id,
          targetKind: "room",
          severity: "info",
          code: "bedroom.noWardrobe",
          message: "No wardrobe in this bedroom.",
        });
      }
    }

    // a sofa needs something to look at
    const sofa = inRoom.find((i) => i.key.startsWith("sofa"));
    if (sofa && !keys.has("tvUnit")) {
      push({
        target: room.id,
        targetKind: "room",
        severity: "info",
        code: "living.noFocus",
        message: "Seating with no TV unit or focal wall opposite.",
      });
    }
    if (sofa && keys.has("tvUnit")) {
      const tv = inRoom.find((i) => i.key === "tvUnit")!;
      const dist = Math.hypot(sofa.cx - tv.cx, sofa.cy - tv.cy);
      if (dist < 2200) {
        push({
          target: sofa.id,
          targetKind: "item",
          severity: "warning",
          code: "living.tvClose",
          message: `${(dist / 1000).toFixed(1)} m from the screen. 2.5–3.5 m is comfortable for a 55 inch TV.`,
        });
      }
    }

    // wet areas
    if (room.type === "bath") {
      if (!keys.has("wc")) {
        push({
          target: room.id,
          targetKind: "room",
          severity: "info",
          code: "bath.noWc",
          message: "No WC specified in this bathroom.",
        });
      }
      const wc = inRoom.find((i) => i.key === "wc");
      if (wc) {
        const f = footprint(wc);
        // "either side" means perpendicular to the way the pan faces, so which
        // axis to measure depends on the rotation
        const alongX = wc.rot % 180 !== 0;
        const side = alongX
          ? Math.min(f.y - inner.y, inner.y + inner.d - (f.y + f.d))
          : Math.min(f.x - inner.x, inner.x + inner.w - (f.x + f.w));
        if (side < 150) {
          push({
            target: wc.id,
            targetKind: "item",
            severity: "warning",
            code: "bath.wcTight",
            message: "WC is hard against a side wall. Allow 380 mm from the centre line to the wall.",
          });
        }
      }
    }

    // wall-hung joinery that is not actually against a wall
    inRoom
      .filter((i) => CATALOG[i.key]?.wallHung && !CATALOG[i.key]?.ceilingHung)
      .forEach((i) => {
        const f = footprint(i);
        const near =
          Math.min(
            Math.abs(f.y - inner.y),
            Math.abs(f.y + f.d - (inner.y + inner.d)),
            Math.abs(f.x - inner.x),
            Math.abs(f.x + f.w - (inner.x + inner.w)),
          ) < 120;
        if (!near) {
          push({
            target: i.id,
            targetKind: "item",
            severity: "warning",
            code: "item.notOnWall",
            message: "Wall-mounted, but not against a wall.",
          });
        }
      });
  });

  /* --- openings sanity ------------------------------------------------ */
  p.openings.forEach((op) => {
    if (op.kind === "door" && op.w < 700) {
      push({
        target: op.id,
        targetKind: "opening",
        severity: "warning",
        code: "door.narrow",
        message: `${op.w} mm door. 750 mm is the practical minimum, 900 mm for a main door.`,
      });
    }
    if (op.sill === 0 && op.h < 1980) {
      push({
        target: op.id,
        targetKind: "opening",
        severity: "warning",
        code: "door.low",
        message: `${op.h} mm head height is low for a door. 2100 mm is standard.`,
      });
    }
    const onRooms = p.rooms.filter((r) => openingsOn([op], r).length > 0);
    if (onRooms.length === 0) {
      push({
        target: op.id,
        targetKind: "opening",
        severity: "error",
        code: "door.orphan",
        message: "This opening does not sit on any room wall.",
      });
    }
  });

  const byItem = new Map<string, Issue[]>();
  const byRoom = new Map<string, Issue[]>();
  for (const i of issues) {
    const bucket = i.targetKind === "room" ? byRoom : byItem;
    const list = bucket.get(i.target) ?? [];
    list.push(i);
    bucket.set(i.target, list);
  }

  return {
    issues,
    byItem,
    byRoom,
    blockedOpenings,
    errorCount: issues.filter((i) => i.severity === "error").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
  };
}

/**
 * Fast collision-only score used by the auto-layout search, where running the
 * full design review on hundreds of candidate arrangements would be wasteful.
 */
export function quickScore(items: PlacedItem[], rooms: Room[], openings: Project["openings"]): number {
  const solid = items.filter((i) => {
    const c = CATALOG[i.key];
    return c && !c.flat && !c.wallHung;
  });
  const feet = solid.map(footprint);
  let score = 0;

  solid.forEach((it, i) => {
    const room = roomAt(rooms, it.cx, it.cy);
    if (!room) score += 8;
    else if (!rectContains(innerRect(room), feet[i]!, 2)) score += 6;
  });

  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      if (compatible(solid[i]!, solid[j]!)) continue;
      if (rectsOverlap(feet[i]!, feet[j]!, 2)) score += 5;
    }
  }

  solid.forEach((a, i) => {
    const zone = clearanceZone(a);
    if (!zone) return;
    solid.forEach((b, j) => {
      if (i === j || compatible(a, b) || !blocksCirculation(b)) return;
      if (rectsOverlap(zone, feet[j]!, 30)) score += 2;
    });
  });

  openings.forEach((op) => {
    for (const zone of openingKeepOut(op)) {
      solid.forEach((_, i) => {
        if (rectsOverlap(zone, feet[i]!, 30)) score += 4;
      });
    }
  });

  // prefer layouts that leave a generous walkway, all else equal
  const circulating = solid.filter(blocksCirculation);
  const circFeet = circulating.map(footprint);
  for (let i = 0; i < circulating.length; i++) {
    for (let j = i + 1; j < circulating.length; j++) {
      if (compatible(circulating[i]!, circulating[j]!)) continue;
      const gap = gapBetween(circFeet[i]!, circFeet[j]!);
      if (gap === null || gap <= 0) continue;
      if (gap < WALK_MIN) score += 1.5;
      else if (gap < WALK_PREFERRED) score += 0.4;
    }
  }

  return score;
}

export const WALKWAY_MIN = WALK_MIN;
