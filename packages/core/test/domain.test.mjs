import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as core from "../dist/index.js";

/**
 * These cover the parts of the domain where a mistake is expensive and silent:
 * money, migration of files customers already have, and the geometry the
 * fabrication exports are cut from. Rendering is verified in the browser, not
 * here.
 */

describe("units", () => {
  it("snaps to a grid without float drift", () => {
    assert.equal(core.snap(1237, 25), 1225);
    assert.equal(core.snap(-1237, 25), -1225);
    assert.equal(core.snap(0, 25), 0);
  });

  it("formats imperial as feet and inches, rolling 12 up", () => {
    assert.equal(core.formatLength(304.8, "imperial"), "1'0\"");
    assert.equal(core.formatLength(3200, "imperial"), "10'6\"");
    // 11.6" must become 1'0", not 0'12"
    assert.equal(core.formatLength(3657, "imperial"), "12'0\"");
  });

  it("converts area to the unit the studio sells in", () => {
    assert.equal(core.formatArea(1e6, "metric"), "1.0 m²");
    assert.equal(core.formatArea(1e6, "imperial"), "11 sq ft");
  });
});

describe("geometry", () => {
  const item = { id: "i1", key: "wardrobe", cx: 2000, cy: 500, rot: 0, w: 1800 };

  it("swaps the footprint when rotated a quarter turn", () => {
    const flat = core.footprint(item);
    const turned = core.footprint({ ...item, rot: 90 });
    assert.equal(flat.w, 1800);
    assert.equal(turned.d, 1800);
    assert.equal(turned.w, flat.d);
  });

  it("puts the clearance zone in front, following the rotation", () => {
    const north = core.clearanceZone(item);
    assert.ok(north && north.y > core.footprint(item).y, "rot 0 faces +y");
    const east = core.clearanceZone({ ...item, rot: 270 });
    assert.ok(east && east.x > core.footprint({ ...item, rot: 270 }).x, "rot 270 faces +x");
  });

  it("cuts a window out of a wall, leaving a sill and a lintel", () => {
    const room = { id: "r", name: "R", type: "living", x: 0, y: 0, w: 4000, d: 3000 };
    const window = {
      id: "w", o: "h", x: 1000, y: 0, w: 1200,
      kind: "window", h: 1500, sill: 750, swing: 1,
    };
    const solids = core.wallSolids(room, [window], 2900);
    const onThatWall = solids.filter((s) => s.side === "N");
    // two returns either side, plus the wall under the sill and the lintel over
    const underSill = onThatWall.find((s) => s.z0 === 0 && s.z1 === 750 && s.x0 >= 1000);
    const lintel = onThatWall.find((s) => s.z0 === 2250 && s.z1 === 2900 && s.x0 >= 1000);
    assert.ok(underSill, "there must be wall below the sill");
    assert.ok(lintel, "there must be a lintel above the head");
    // and nothing at all across the glazed band
    const throughGlass = onThatWall.some(
      (s) => s.x0 >= 1000 && s.x1 <= 2200 && s.z0 < 2250 && s.z1 > 750,
    );
    assert.equal(throughGlass, false, "the opening itself must be empty");
  });

  it("gives a door a floor keep-out but a window none", () => {
    const door = { id: "d", o: "h", x: 0, y: 0, w: 900, kind: "door", h: 2100, sill: 0, swing: 1 };
    const window = { ...door, id: "w", kind: "window", sill: 750 };
    assert.equal(core.openingKeepOut(door).length, 2);
    assert.equal(core.openingKeepOut(window).length, 0);
  });
});

describe("catalog", () => {
  it("every item builds finite geometry at its nominal size", () => {
    for (const entry of core.CATALOG_ITEMS) {
      const parts = entry.parts(entry.w, entry.d, entry.h);
      assert.ok(parts.length > 0, `${entry.key} produced no parts`);
      for (const part of parts) {
        const box = core.shapeAabb(part.shape);
        for (const [axis, value] of Object.entries(box)) {
          assert.ok(Number.isFinite(value), `${entry.key}: ${axis} is ${value}`);
        }
        assert.ok(box.x1 >= box.x0 && box.y1 >= box.y0 && box.z1 >= box.z0, `${entry.key} inverted box`);
      }
    }
  });

  it("every resizable item survives both ends of its range", () => {
    for (const entry of core.CATALOG_ITEMS) {
      if (!entry.resize) continue;
      const [lo, hi] = entry.wRange ?? [300, 9000];
      for (const w of [lo, hi]) {
        const parts = entry.parts(w, entry.d, entry.h);
        assert.ok(parts.length > 0, `${entry.key} at ${w} mm produced nothing`);
      }
    }
  });

  it("prices every item that is not client supplied", () => {
    for (const entry of core.CATALOG_ITEMS) {
      if (entry.unit === "clientSupplied") {
        assert.equal(entry.price, 0, `${entry.key} is client supplied but priced`);
      } else {
        assert.ok(entry.price > 0, `${entry.key} has no price`);
      }
    }
  });
});

describe("styles", () => {
  it("gives every style a finish for every material slot used by the catalog", () => {
    const slots = new Set();
    for (const entry of core.CATALOG_ITEMS) {
      for (const part of entry.parts(entry.w, entry.d, entry.h)) slots.add(part.m);
    }
    for (const style of core.STYLE_LIST) {
      for (const slot of slots) {
        const finish = style.finishes[slot];
        assert.ok(finish, `${style.id} has no finish for "${slot}"`);
        assert.match(finish.color, /^#[0-9a-f]{6}$/i, `${style.id}.${slot} colour "${finish.color}"`);
      }
    }
  });
});

describe("auto-layout", () => {
  it("lays out the sample flat with nothing clashing", () => {
    const project = core.sampleProject();
    const report = core.validate(project);
    assert.equal(report.errorCount, 0, report.issues.map((i) => i.message).join("; "));
    assert.equal(report.warningCount, 0, report.issues.map((i) => i.message).join("; "));
  });

  it("re-furnishing from empty reaches the same clean state", () => {
    const project = core.sampleProject();
    project.items = [];
    const result = core.furnishAll(project);
    assert.equal(result.skipped.length, 0);
    assert.ok(project.items.length > 30);
    assert.equal(core.validate(project).errorCount, 0);
  });

  it("offers several distinct arrangements per template", () => {
    const project = core.sampleProject();
    const living = project.rooms.find((r) => r.type === "living");
    const template = core.templatesFor("living")[0];
    const variants = core.variantsOf(living, template, project);
    assert.ok(variants.length >= 4, `only ${variants.length} variants`);
    // sorted best-fit first
    for (let i = 1; i < variants.length; i++) {
      assert.ok(variants[i].score >= variants[i - 1].score, "variants are not sorted by score");
    }
  });

  it("leaves locked pieces alone", () => {
    const project = core.sampleProject();
    const room = project.rooms[0];
    const victim = project.items.find(
      (i) => core.roomAt(project.rooms, i.cx, i.cy) === room,
    );
    victim.locked = true;
    const keptId = victim.id;
    core.applyLayout(project, room, room.layout, 1);
    assert.ok(project.items.some((i) => i.id === keptId), "a locked piece was replaced");
  });

  it("flags a door blocked by furniture", () => {
    const project = core.sampleProject();
    const door = project.openings.find((o) => o.kind === "door");
    // drop a wardrobe right in the doorway
    project.items.push({
      id: "blocker", key: "wardrobe", cx: door.x + 200, cy: door.y + 200, rot: 0, w: 1200,
    });
    const report = core.validate(project);
    assert.ok(report.errorCount > 0);
    assert.ok([...report.blockedOpenings].length > 0, "the door was not reported as blocked");
  });
});

describe("pricing", () => {
  it("builds a quote whose parts add up to its total", () => {
    const project = core.sampleProject();
    const quote = core.buildQuote(project);
    const groupSum = quote.groups.reduce((s, g) => s + g.total, 0);
    assert.equal(groupSum, quote.subtotal);

    const taxTotal = quote.taxes.reduce((s, t) => s + t.amount, 0);
    const expected =
      quote.subtotal - quote.discount + quote.designFee + quote.scaleModel + taxTotal;
    assert.equal(quote.total, expected);
    assert.equal(quote.lines.at(-1).amount, quote.total);
  });

  it("applies the discount before the design fee and tax on top of both", () => {
    const project = core.sampleProject();
    project.quote.discountPct = 10;
    project.quote.designFeePct = 10;
    project.quote.taxes = [{ label: "GST", rate: 18 }];
    const q = core.buildQuote(project);
    const afterDiscount = q.subtotal - q.discount;
    assert.equal(q.discount, Math.round(q.subtotal * 0.1));
    assert.equal(q.designFee, Math.round(afterDiscount * 0.1));
    assert.equal(q.taxes[0].amount, Math.round((afterDiscount + q.designFee) * 0.18));
  });

  it("charges per metre for a run and per piece for a chair", () => {
    const project = core.sampleProject();
    const wardrobe = project.items.find((i) => i.key.startsWith("wardrobe"));
    const chair = project.items.find((i) => i.key === "diningChair");
    assert.ok(Math.abs(core.quantityOf(wardrobe) - core.itemSize(wardrobe).w / 1000) < 1e-9);
    assert.equal(core.quantityOf(chair), 1);
  });

  it("honours a per-project rate override", () => {
    const project = core.sampleProject();
    const before = core.rateFor(project, "diningChair");
    project.rates.diningChair = 1234;
    assert.notEqual(before, 1234);
    assert.equal(core.rateFor(project, "diningChair"), 1234);
  });

  it("scales rates by the style multiplier", () => {
    const modern = core.sampleProject();
    modern.styleId = "modern";
    const luxe = core.sampleProject();
    luxe.styleId = "luxe";
    assert.ok(core.rateFor(luxe, "sofa3") > core.rateFor(modern, "sofa3"));
  });

  it("lists client-supplied items without pricing them", () => {
    const project = core.sampleProject();
    const quote = core.buildQuote(project);
    assert.ok(quote.clientSupplied.length > 0);
    for (const group of quote.groups) {
      assert.ok(!group.rows.some((r) => r.key === "fridge"), "the fridge was priced");
    }
  });

  it("groups Indian amounts in lakh and crore", () => {
    const inr = core.CURRENCIES.INR;
    assert.equal(core.formatMoney(2_073_240, inr, true), "₹20.73 L");
    assert.equal(core.formatMoney(25_000_000, inr, true), "₹2.50 Cr");
    assert.equal(core.formatMoney(1500, inr), "₹1,500");
  });
});

describe("fabrication", () => {
  it("produces a printable model that fits a 256 mm bed at 1:50", () => {
    const project = core.sampleProject();
    const stats = core.printStats(project);
    assert.ok(stats.fitsBed, `${stats.sx}×${stats.sy} on a ${stats.bed} mm bed`);
    assert.ok(stats.grams > 0 && stats.grams < 2000);
    assert.ok(stats.triangles > 1000);
  });

  it("never emits a feature thinner than the printer can resolve", () => {
    const project = core.sampleProject();
    project.print.minFeature = 2;
    const model = core.printModel(project);
    for (const box of [...model.shell, ...model.furniture]) {
      assert.ok(box[3] - box[0] >= 2 - 1e-6, `x span ${box[3] - box[0]}`);
      assert.ok(box[4] - box[1] >= 2 - 1e-6, `y span ${box[4] - box[1]}`);
    }
  });

  it("writes a well-formed binary STL", () => {
    const project = core.sampleProject();
    const model = core.printModel(project);
    const stl = core.toStl(model.shell, model.bounds, "test");
    const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
    const triangles = view.getUint32(80, true);
    assert.equal(stl.length, 84 + triangles * 50, "header count disagrees with the byte length");
    assert.equal(triangles, model.shell.length * 12);
  });

  it("exports an OBJ whose materials all exist in the MTL", () => {
    const project = core.sampleProject();
    const { obj, mtl } = core.toObj(project, "t");
    const used = new Set([...obj.matchAll(/^usemtl (.+)$/gm)].map((m) => m[1]));
    const declared = new Set([...mtl.matchAll(/^newmtl (.+)$/gm)].map((m) => m[1]));
    for (const name of used) assert.ok(declared.has(name), `MTL is missing "${name}"`);
    assert.ok(used.size > 5);
  });

  it("zips files with a correct central directory", () => {
    const blob = core.zipFiles([{ name: "a.txt", data: "hello" }]);
    assert.ok(blob.size > 22);
    assert.equal(blob.type, "application/zip");
  });
});

describe("project migration", () => {
  it("round-trips a current project unchanged", () => {
    const project = core.sampleProject();
    const parsed = core.parseProject(JSON.parse(JSON.stringify(project)));
    assert.ok(parsed.ok);
    assert.equal(parsed.project.items.length, project.items.length);
    assert.equal(parsed.project.rooms.length, project.rooms.length);
  });

  it("brings a v1 document forward", () => {
    const legacy = {
      id: "p-old", name: "Old flat", client: "A", style: "indo",
      rooms: [{ id: "r1", name: "Living", type: "living", x: 0, y: 0, w: 4000, d: 3500 }],
      doors: [{ id: "d1", o: "v", x: 0, y: 1000, w: 900, opening: false },
              { id: "d2", o: "h", x: 500, y: 0, w: 1600, opening: true }],
      items: [{ id: "i1", key: "tv", cx: 2000, cy: 300, rot: 0 },
              { id: "i2", key: "bedQ", cx: 2000, cy: 2000, rot: 0 },
              { id: "i3", key: "removed-from-catalog", cx: 0, cy: 0, rot: 0 }],
      fee: 12, gst: 18, quoteNo: "Q-OLD",
    };
    const parsed = core.parseProject(legacy);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.error);
    const p = parsed.project;
    assert.equal(p.v, core.SCHEMA_VERSION);
    assert.deepEqual(p.items.map((i) => i.key), ["tvUnit", "bedQueen"]);
    assert.equal(p.quote.designFeePct, 12);
    assert.equal(p.quote.taxes[0].rate, 18);
    assert.equal(p.openings.find((o) => o.id === "d2").kind, "cased");
    assert.equal(p.openings.find((o) => o.id === "d1").kind, "door");
    // v1 predates the ceiling field and assumed 2700
    assert.equal(p.ceiling, 2700);
  });

  it("refuses rubbish in strict mode but is forgiving otherwise", () => {
    for (const rubbish of [null, 42, "a string", [], { total: "garbage" }, { rooms: "nope", name: "x" }]) {
      const strict = core.parseProject(rubbish, { strict: true });
      assert.equal(strict.ok, false, `strict mode accepted ${JSON.stringify(rubbish)}`);
    }
    // a genuinely old file with missing optional fields must still open
    const sparse = { name: "Sparse", rooms: [] };
    assert.equal(core.parseProject(sparse, { strict: true }).ok, true);
  });

  it("does not let a partial document wipe the furniture silently", () => {
    const result = core.parseProject({ name: "x", rooms: [], items: "not an array" }, { strict: true });
    assert.equal(result.ok, false);
  });

  it("gives a duplicate a new id and quote number", () => {
    const project = core.sampleProject();
    const copy = core.duplicateProject(project);
    assert.notEqual(copy.id, project.id);
    assert.notEqual(copy.quote.number, project.quote.number);
    assert.equal(copy.items.length, project.items.length);
    // a deep copy, not a shared reference
    copy.items[0].cx += 1000;
    assert.notEqual(copy.items[0].cx, project.items[0].cx);
  });
});

describe("validation rules", () => {
  const base = () => {
    const p = core.blankProject("Test");
    p.rooms[0].w = 5000;
    p.rooms[0].d = 4000;
    return p;
  };

  it("reports a piece that is outside every room", () => {
    const p = base();
    p.items.push({ id: "x", key: "sofa3", cx: 50_000, cy: 50_000, rot: 0 });
    const issues = core.validate(p).issues.filter((i) => i.code === "item.outside");
    assert.equal(issues.length, 1);
  });

  it("reports two pieces on top of each other", () => {
    const p = base();
    p.items.push({ id: "a", key: "sofa3", cx: 2500, cy: 2000, rot: 0 });
    p.items.push({ id: "b", key: "armchair", cx: 2500, cy: 2000, rot: 0 });
    const overlaps = core.validate(p).issues.filter((i) => i.code === "item.overlap");
    assert.equal(overlaps.length, 2, "both pieces should be told");
  });

  it("lets a chair tuck under its table", () => {
    const p = base();
    p.items.push({ id: "t", key: "dining4", cx: 2500, cy: 2000, rot: 0 });
    p.items.push({ id: "c", key: "diningChair", cx: 2500, cy: 2000, rot: 0 });
    const overlaps = core.validate(p).issues.filter((i) => i.code === "item.overlap");
    assert.equal(overlaps.length, 0);
  });

  it("does not treat a rug or a pendant as an obstruction", () => {
    const p = base();
    p.items.push({ id: "s", key: "sofa3", cx: 2500, cy: 2000, rot: 0 });
    p.items.push({ id: "r", key: "rug", cx: 2500, cy: 2000, rot: 0 });
    p.items.push({ id: "l", key: "pendantCluster", cx: 2500, cy: 2000, rot: 0, z: 1200 });
    const issues = core.validate(p).issues.filter(
      (i) => i.code === "item.overlap" || i.code === "walkway.tight",
    );
    assert.equal(issues.length, 0, issues.map((i) => i.message).join("; "));
  });

  it("says a room with no door cannot be entered", () => {
    const p = base();
    p.openings = [];
    const issues = core.validate(p).issues.filter((i) => i.code === "room.noAccess");
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "error");
  });

  it("warns about a habitable room with no window", () => {
    const p = base();
    p.openings = p.openings.filter((o) => o.kind === "door");
    const issues = core.validate(p).issues.filter((i) => i.code === "room.noDaylight");
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "warning");
  });

  it("scores a cleaner arrangement lower", () => {
    const room = { id: "r", name: "R", type: "living", x: 0, y: 0, w: 5000, d: 4000 };
    const spread = [
      { id: "a", key: "sofa3", cx: 1500, cy: 800, rot: 0 },
      { id: "b", key: "armchair", cx: 3800, cy: 3000, rot: 0 },
    ];
    const piled = [
      { id: "a", key: "sofa3", cx: 2500, cy: 2000, rot: 0 },
      { id: "b", key: "armchair", cx: 2500, cy: 2000, rot: 0 },
    ];
    assert.ok(core.quickScore(spread, [room], []) < core.quickScore(piled, [room], []));
  });
});

describe("exports", () => {
  it("writes a CSV whose rows all have the same column count", () => {
    const project = core.sampleProject();
    for (const csv of [core.quoteCsv(project), core.bomCsv(project), core.roomScheduleCsv(project)]) {
      const rows = csv.split("\r\n").filter((r) => r.trim().length > 0);
      assert.ok(rows.length > 3);
      // a value containing a comma must be quoted, never bare
      for (const row of rows) {
        const bareCommas = row.replace(/"[^"]*"/g, "").split(",").length - 1;
        assert.ok(bareCommas < 12, `too many unquoted commas in: ${row.slice(0, 80)}`);
      }
    }
  });

  it("escapes a quote character in a project name", () => {
    const project = core.sampleProject();
    project.name = 'The "Grand" Flat, Phase 2';
    const csv = core.quoteCsv(project);
    assert.ok(csv.includes('"The ""Grand"" Flat, Phase 2'), "the name was not escaped");
  });
});
