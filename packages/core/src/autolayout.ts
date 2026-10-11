import { CATALOG } from "./catalog/index.js";
import { innerRect, nrot, roomAt } from "./geometry.js";
import { type Candidate, type LayoutTemplate, templatesFor } from "./layouts/index.js";
import { rid } from "./ids.js";
import type { Mm, PlacedItem, Project, Room, Rot } from "./types.js";
import { quickScore } from "./validation.js";

/** Fixtures that hang from the ceiling, so their height follows the room. */
const CEILING_MOUNTED = new Set(["pendantCluster", "chandelier", "coveLight", "trackLight"]);

export interface LayoutVariant {
  /** Quarter-turns applied to the whole arrangement. */
  orientation: 0 | 1 | 2 | 3;
  mirrored: boolean;
  items: PlacedItem[];
  /** Lower is better. 0 means nothing clashes. */
  score: number;
}

/**
 * A template describes one arrangement; the room it lands in may be any shape
 * and have doors anywhere. So we generate all eight rigid transforms of the
 * arrangement (four rotations × mirror), score each against the real room and
 * its doors, and let the designer step through them in order of fit.
 *
 * This is what turns a handful of templates into a layout engine: eight
 * variants per template, each measured against the actual plan.
 */
export function variantsOf(
  room: Room,
  template: LayoutTemplate,
  project: Pick<Project, "openings" | "ceiling">,
): LayoutVariant[] {
  const inner = innerRect(room);
  const ceiling = room.ceiling ?? project.ceiling;
  const results: LayoutVariant[] = [];
  const seen = new Set<string>();

  for (let orientation = 0; orientation < 4; orientation++) {
    for (const mirrored of [false, true]) {
      // the template is authored for a room of this width and depth
      const localW: Mm = orientation % 2 ? inner.d : inner.w;
      const localD: Mm = orientation % 2 ? inner.w : inner.d;
      if (template.min && (localW < template.min.w || localD < template.min.d)) continue;

      let raw: Candidate[];
      try {
        raw = template.make(localW, localD);
      } catch {
        continue;
      }
      if (!raw.length) continue;

      const items: PlacedItem[] = raw.flatMap((cand, index) => {
        const catalog = CATALOG[cand.key];
        if (!catalog) return [];

        let u = cand.cx;
        let v = cand.cy;
        let rot: number = cand.rot;
        if (mirrored) {
          u = localW - u;
          rot = (360 - rot) % 360;
        }

        // rotate the local frame into the room's frame
        let x: Mm;
        let y: Mm;
        if (orientation === 0) {
          x = u;
          y = v;
        } else if (orientation === 1) {
          x = inner.w - v;
          y = u;
        } else if (orientation === 2) {
          x = inner.w - u;
          y = inner.d - v;
        } else {
          x = v;
          y = inner.d - u;
        }

        const item: PlacedItem = {
          id: `cand-${index}`,
          key: cand.key,
          cx: Math.round(inner.x + x),
          cy: Math.round(inner.y + y),
          rot: nrot(rot + 90 * orientation) as Rot,
        };
        if (cand.w !== undefined) item.w = Math.round(cand.w);
        if (cand.d !== undefined) item.d = Math.round(cand.d);
        if (CEILING_MOUNTED.has(cand.key)) {
          item.z = Math.max(0, ceiling - catalog.h - (room.falseCeiling ?? 0));
        } else if (cand.z !== undefined) {
          item.z = Math.round(cand.z);
        }
        return [item];
      });

      const signature = items
        .map((i) => `${i.key}:${i.cx},${i.cy},${i.rot},${i.w ?? ""},${i.d ?? ""}`)
        .sort()
        .join("|");
      if (seen.has(signature)) continue;
      seen.add(signature);

      results.push({
        orientation: orientation as 0 | 1 | 2 | 3,
        mirrored,
        items,
        score: quickScore(items, [room], project.openings),
      });
    }
  }

  // stable sort: best fit first, then the order they were generated
  return results
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v.score - b.v.score || a.i - b.i)
    .map(({ v }) => v);
}

export interface ApplyResult {
  template: LayoutTemplate;
  variant: LayoutVariant;
  variantIndex: number;
  variantCount: number;
  placed: number;
}

/**
 * Replace everything in a room with one variant of a template.
 * Items the designer locked are left exactly where they are.
 */
export function applyLayout(
  project: Project,
  room: Room,
  templateId: string,
  variantIndex = 0,
): ApplyResult | null {
  const template = templatesFor(room.type).find((t) => t.id === templateId);
  if (!template) return null;

  const variants = variantsOf(room, template, project);
  if (!variants.length) return null;

  const index = ((variantIndex % variants.length) + variants.length) % variants.length;
  const variant = variants[index]!;

  const keep = project.items.filter(
    (i) => i.locked || roomAt(project.rooms, i.cx, i.cy) !== room,
  );
  const placed = variant.items.map<PlacedItem>((i) => ({ ...i, id: rid("i") }));
  project.items = [...keep, ...placed];

  room.layout = templateId;
  room.variant = index;
  room.variantCount = variants.length;

  return {
    template,
    variant,
    variantIndex: index,
    variantCount: variants.length,
    placed: placed.length,
  };
}

/** The template that fits this room best, or null if none apply. */
export function bestTemplate(
  project: Project,
  room: Room,
): { id: string; score: number; name: string } | null {
  let best: { id: string; score: number; name: string } | null = null;
  for (const template of templatesFor(room.type)) {
    const top = variantsOf(room, template, project)[0];
    if (!top) continue;
    if (!best || top.score < best.score) {
      best = { id: template.id, score: top.score, name: template.name };
    }
  }
  return best;
}

/** Furnish every room with its best-fitting template. */
export function furnishAll(project: Project): { furnished: number; skipped: string[] } {
  let furnished = 0;
  const skipped: string[] = [];
  for (const room of project.rooms) {
    const best = bestTemplate(project, room);
    if (!best) {
      skipped.push(room.name);
      continue;
    }
    if (applyLayout(project, room, best.id, 0)) furnished++;
    else skipped.push(room.name);
  }
  return { furnished, skipped };
}

/** Step to the next variant of whatever template the room already uses. */
export function cycleVariant(project: Project, room: Room, delta = 1): ApplyResult | null {
  if (!room.layout) return null;
  return applyLayout(project, room, room.layout, (room.variant ?? 0) + delta);
}
