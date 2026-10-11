import { CATALOG } from "./catalog/index.js";
import { CUTAWAY_H, projectBounds, wallSolids, worldPartBoxes } from "./geometry.js";
import { getStyle } from "./styles.js";
import type { Box3, Mm, Project } from "./types.js";

/* ------------------------------------------------------------------ *
 * Scale model for 3D printing
 * ------------------------------------------------------------------ */

/** A print-ready solid: a box in model millimetres. */
type PrintBox = [number, number, number, number, number, number];

export interface PrintModel {
  /** Base plate, walls and anything fixed to a wall. */
  shell: PrintBox[];
  /** Loose furniture, optionally printed as a second file in another colour. */
  furniture: PrintBox[];
  bounds: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
}

/**
 * Turn the project into printable solids at 1:scale.
 *
 * Two things matter here and nothing else: nothing may be thinner than the
 * printer can resolve, and the whole thing must fit the bed. Legs, shelves and
 * glass partitions that scale down below the minimum feature size are fattened
 * rather than dropped, because a chair with no legs reads as broken while a
 * chair with slightly chunky legs reads as a model.
 */
export function printModel(project: Project): PrintModel {
  const settings = project.print;
  const s = settings.scale;
  const wallHeight: Mm = settings.walls === "full" ? project.ceiling : CUTAWAY_H;
  const minFeature = Math.max(0.8, settings.minFeature || 1.6);
  const minVertical = 0.8;
  const baseThickness = 2;
  const margin = 3;

  const fatten = (b: PrintBox): PrintBox => {
    let [x0, y0, z0, x1, y1, z1] = b;
    if (x1 - x0 < minFeature) {
      const c = (x0 + x1) / 2;
      x0 = c - minFeature / 2;
      x1 = c + minFeature / 2;
    }
    if (y1 - y0 < minFeature) {
      const c = (y0 + y1) / 2;
      y0 = c - minFeature / 2;
      y1 = c + minFeature / 2;
    }
    if (z1 - z0 < minVertical) {
      z0 = Math.max(0, z1 - minVertical);
      if (z1 - z0 < minVertical) z1 = z0 + minVertical;
    }
    return [x0, y0, z0, x1, y1, z1];
  };

  const toModel = (b: Box3): PrintBox =>
    fatten([b.x0 / s, b.y0 / s, b.z0 / s, b.x1 / s, b.y1 / s, b.z1 / s]);

  const shell: PrintBox[] = [];
  const furniture: PrintBox[] = [];

  for (const room of project.rooms) {
    for (const wall of wallSolids(room, project.openings, wallHeight)) shell.push(toModel(wall));
  }

  if (settings.includeFurniture) {
    for (const item of project.items) {
      const catalog = CATALOG[item.key];
      if (!catalog || catalog.flat) continue;
      for (const part of worldPartBoxes(item)) {
        if (part.z0 >= wallHeight) continue;
        const clipped: Box3 = { ...part, z1: Math.min(part.z1, wallHeight) };
        if (clipped.z1 - clipped.z0 <= 0) continue;
        // wall-fixed joinery stays with the shell so it does not float loose
        const target =
          settings.separateFurniture && part.mount !== "wall" ? furniture : shell;
        target.push(toModel(clipped));
      }
    }
  }

  const bb = projectBounds(project);
  const bounds = {
    x0: bb.x0 / s - margin,
    y0: bb.y0 / s - margin,
    x1: bb.x1 / s + margin,
    y1: bb.y1 / s + margin,
    z0: -baseThickness,
    z1: 0,
  };
  shell.push([bounds.x0, bounds.y0, -baseThickness, bounds.x1, bounds.y1, 0]);
  bounds.z1 = Math.max(0, ...shell.map((b) => b[5]), ...furniture.map((b) => b[5]));

  return { shell, furniture, bounds };
}

export interface PrintStats {
  /** Footprint and height of the printed model, mm. */
  sx: number;
  sy: number;
  sz: number;
  triangles: number;
  grams: number;
  hours: number;
  /** Bureau cost in project currency. */
  cost: number;
  fitsBed: boolean;
  bed: number;
}

export function printStats(project: Project): PrintStats {
  const model = printModel(project);
  const all = [...model.shell, ...model.furniture];
  const volumeMm3 = all.reduce(
    (sum, b) => sum + (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2]),
    0,
  );
  // PLA at 1.24 g/cm³, ~42% effective fill once walls and infill are accounted for
  const grams = (volumeMm3 / 1000) * 1.24 * 0.42;
  const b = model.bounds;
  const sx = b.x1 - b.x0;
  const sy = b.y1 - b.y0;
  const sz = b.z1 - b.z0;
  const bed = project.print.bed || 256;

  return {
    sx,
    sy,
    sz,
    triangles: all.length * 12,
    grams,
    // roughly 11 g/hour on a 0.4 mm nozzle at 0.14 mm layers, plus setup
    hours: grams / 11 + 0.4,
    cost: grams * Math.max(0, project.print.ratePerGram || 0),
    fitsBed: sx <= bed && sy <= bed,
    bed,
  };
}

/* ------------------------------------------------------------------ *
 * Mesh emitters
 * ------------------------------------------------------------------ */

type Vec3 = [number, number, number];

/** Twelve outward-facing triangles for an axis-aligned box. */
export function boxTriangles(lo: Vec3, hi: Vec3): Array<{ n: Vec3; v: [Vec3, Vec3, Vec3] }> {
  const [a, b, c] = lo;
  const [A, B, C] = hi;
  const faces: Array<{ n: Vec3; quad: [Vec3, Vec3, Vec3, Vec3] }> = [
    { n: [-1, 0, 0], quad: [[a, b, c], [a, B, c], [a, B, C], [a, b, C]] },
    { n: [1, 0, 0], quad: [[A, b, c], [A, b, C], [A, B, C], [A, B, c]] },
    { n: [0, -1, 0], quad: [[a, b, c], [a, b, C], [A, b, C], [A, b, c]] },
    { n: [0, 1, 0], quad: [[a, B, c], [A, B, c], [A, B, C], [a, B, C]] },
    { n: [0, 0, -1], quad: [[a, b, c], [A, b, c], [A, B, c], [a, B, c]] },
    { n: [0, 0, 1], quad: [[a, b, C], [a, B, C], [A, B, C], [A, b, C]] },
  ];
  const out: Array<{ n: Vec3; v: [Vec3, Vec3, Vec3] }> = [];
  for (const { n, quad } of faces) {
    out.push({ n, v: [quad[0], quad[1], quad[2]] });
    out.push({ n, v: [quad[0], quad[2], quad[3]] });
  }
  return out;
}

/**
 * Binary STL. The model is translated so its minimum corner sits at the
 * origin and the Y axis is flipped, because slicers put the plan's top edge
 * at the back of the bed.
 */
export function toStl(boxes: PrintBox[], bounds: PrintModel["bounds"], name: string): Uint8Array {
  const count = boxes.length * 12;
  const buffer = new ArrayBuffer(84 + 50 * count);
  const view = new DataView(buffer);

  const header = `Layoutcraft Studio ${name}`.replace(/[^\x20-\x7e]/g, "").slice(0, 79);
  for (let i = 0; i < header.length; i++) view.setUint8(i, header.charCodeAt(i));
  view.setUint32(80, count, true);

  let offset = 84;
  for (const b of boxes) {
    const lo: Vec3 = [b[0] - bounds.x0, bounds.y1 - b[4], b[2] - bounds.z0];
    const hi: Vec3 = [b[3] - bounds.x0, bounds.y1 - b[1], b[5] - bounds.z0];
    for (const { n, v } of boxTriangles(lo, hi)) {
      view.setFloat32(offset, n[0], true);
      view.setFloat32(offset + 4, n[1], true);
      view.setFloat32(offset + 8, n[2], true);
      offset += 12;
      for (const p of v) {
        view.setFloat32(offset, p[0], true);
        view.setFloat32(offset + 4, p[1], true);
        view.setFloat32(offset + 8, p[2], true);
        offset += 12;
      }
      view.setUint16(offset, 0, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
}

/* ------------------------------------------------------------------ *
 * OBJ + MTL export, for handing the model to 3ds Max, Blender or SketchUp
 * ------------------------------------------------------------------ */

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * Whole-scene OBJ in metres, grouped per room and per material.
 *
 * Shapes are exported as their bounding boxes rather than their full
 * tessellation. That is deliberate: a visualiser importing this wants clean
 * blocking they can replace with their own assets, and a box-per-part keeps
 * the file small enough to open.
 */
export function toObj(project: Project, name: string): { obj: string; mtl: string } {
  const style = getStyle(project.styleId);
  const mtlName = `${name}.mtl`;
  const obj: string[] = [
    `# ${project.name}${project.client ? ` for ${project.client}` : ""}`,
    `# Exported from Layoutcraft Studio. Units: metres. Y is up.`,
    `mtllib ${mtlName}`,
    "",
  ];
  const used = new Set<string>();
  let vertexBase = 1;

  const emit = (b: Box3, material: string) => {
    used.add(material);
    // plan y becomes -z so the model stands up in a Y-up DCC package
    const xs = [b.x0 / 1000, b.x1 / 1000];
    const ys = [b.z0 / 1000, b.z1 / 1000];
    const zs = [-b.y1 / 1000, -b.y0 / 1000];
    const corners: Vec3[] = [];
    for (const z of zs) for (const y of ys) for (const x of xs) corners.push([x, y, z]);
    for (const [x, y, z] of corners) obj.push(`v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`);
    obj.push(`usemtl ${material}`);
    const f = (a: number, bb: number, c: number, d: number) =>
      obj.push(`f ${vertexBase + a} ${vertexBase + bb} ${vertexBase + c} ${vertexBase + d}`);
    // corners: 0..7 ordered z,y,x
    f(0, 1, 3, 2);
    f(4, 6, 7, 5);
    f(0, 2, 6, 4);
    f(1, 5, 7, 3);
    f(0, 4, 5, 1);
    f(2, 3, 7, 6);
    vertexBase += 8;
  };

  const wallHeight = project.ceiling;
  for (const room of project.rooms) {
    obj.push(`g ${room.name.replace(/\s+/g, "_")}_shell`);
    emit({ x0: room.x, y0: room.y, z0: -40, x1: room.x + room.w, y1: room.y + room.d, z1: 0 }, "floor");
    for (const wall of wallSolids(room, project.openings, wallHeight)) emit(wall, wall.m);
  }

  for (const item of project.items) {
    const catalog = CATALOG[item.key];
    if (!catalog) continue;
    obj.push(`g ${item.key}_${item.id.replace(/-/g, "")}`);
    for (const part of worldPartBoxes(item)) emit(part, part.m);
  }

  const mtl: string[] = [`# Finish schedule: ${style.name}`, ""];
  for (const slot of used) {
    const finish = style.finishes[slot as keyof typeof style.finishes];
    const [r, g, b] = hexToRgb(finish?.color ?? "#999999");
    const rough = finish?.roughness ?? 0.6;
    mtl.push(`newmtl ${slot}`);
    mtl.push(`Kd ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`);
    mtl.push(`Ka 0 0 0`);
    mtl.push(`Ks ${(1 - rough).toFixed(3)} ${(1 - rough).toFixed(3)} ${(1 - rough).toFixed(3)}`);
    mtl.push(`Ns ${Math.round((1 - rough) * 900 + 4)}`);
    if (finish?.metalness) mtl.push(`Pm ${finish.metalness.toFixed(2)}`);
    mtl.push(`Pr ${rough.toFixed(2)}`);
    if (finish?.opacity !== undefined && finish.opacity < 1) mtl.push(`d ${finish.opacity.toFixed(2)}`);
    mtl.push("");
  }

  return { obj: obj.join("\n"), mtl: mtl.join("\n") };
}

/* ------------------------------------------------------------------ *
 * ZIP (store, no compression) — enough for a handful of files
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array | string;
}

/** A stored (uncompressed) ZIP. Every byte is written by hand, no dependency. */
export function zipFiles(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(12, 0x5821, true); // fixed timestamp keeps exports reproducible
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(14, 0x5821, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((s, a) => s + a.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], {
    type: "application/zip",
  });
}

/** The zip a designer hands to a 3D-print bureau. */
export function printBundle(project: Project, baseName: string): Blob {
  const model = printModel(project);
  const stats = printStats(project);
  const files: ZipEntry[] = [
    {
      name: `${baseName}-shell-1to${project.print.scale}.stl`,
      data: toStl(model.shell, model.bounds, `${project.name} shell`),
    },
  ];
  if (model.furniture.length) {
    files.push({
      name: `${baseName}-furniture-1to${project.print.scale}.stl`,
      data: toStl(model.furniture, model.bounds, `${project.name} furniture`),
    });
  }
  files.push({
    name: "PRINT-NOTES.txt",
    data: [
      `${project.name}${project.client ? ` for ${project.client}` : ""}`,
      `Prepared with Layoutcraft Studio`,
      ``,
      `Scale 1:${project.print.scale}. All units are millimetres.`,
      `Footprint ${stats.sx.toFixed(0)} × ${stats.sy.toFixed(0)} mm, height ${stats.sz.toFixed(0)} mm.`,
      `Walls: ${project.print.walls === "full" ? `full height, ${project.ceiling} mm` : `cutaway at ${CUTAWAY_H} mm`}. Base plate 2 mm.`,
      `Thinnest feature ${project.print.minFeature} mm — thinner parts were thickened to survive printing.`,
      ``,
      `Files`,
      `- shell: base plate, walls${project.print.separateFurniture ? ", and all wall-fixed joinery and mirrors" : " and all furniture"}`,
      model.furniture.length
        ? `- furniture: every loose piece on the same origin. Import both files together to see the layout, then print the furniture in a contrasting colour and place it by hand.`
        : ``,
      ``,
      `Suggested PLA settings`,
      `- Layer height 0.12 to 0.16 mm`,
      `- 3 perimeters, 15 to 20% infill`,
      `- No supports needed for the shell; enable supports for the furniture file if your printer struggles with table tops`,
      ``,
      `Estimated material ${Math.round(stats.grams)} g, print time about ${stats.hours.toFixed(1)} h.`,
      stats.fitsBed
        ? `Fits a ${stats.bed} mm bed.`
        : `WARNING: larger than a ${stats.bed} mm bed. Reduce the scale or split the model.`,
      ``,
    ]
      .filter((l) => l !== "")
      .join("\n"),
  });
  return zipFiles(files);
}

/** The zip a designer hands to a 3D visualiser. */
export function modelBundle(project: Project, baseName: string): Blob {
  const { obj, mtl } = toObj(project, baseName);
  return zipFiles([
    { name: `${baseName}.obj`, data: obj },
    { name: `${baseName}.mtl`, data: mtl },
    {
      name: "README.txt",
      data: [
        `${project.name} — massing export from Layoutcraft Studio`,
        ``,
        `Units: metres. Y is up. Plan north is -Z.`,
        `Geometry is block massing: one box per component, grouped by room and by piece.`,
        `Materials in the .mtl carry the project's finish schedule as base colour,`,
        `roughness (Pr) and metalness (Pm) so a PBR importer picks up sensible values.`,
        ``,
        `Replace groups with your own assets as needed — group names are stable across exports.`,
      ].join("\n"),
    },
  ]);
}
