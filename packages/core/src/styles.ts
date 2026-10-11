import type { DesignStyle, Finish, MaterialKey, TexturePattern } from "./types.js";

/**
 * A style is a complete finish schedule. Geometry never changes when the
 * designer switches style — only the finish bound to each material slot — so a
 * client can see the same plan in six looks in a couple of seconds.
 */

interface StyleSeed {
  id: string;
  name: string;
  note: string;
  priceMultiplier: number;
  lightTemperatureK: number;
  /** Floor finish: the single biggest driver of how a render reads. */
  floor: { name: string; color: string; pattern: TexturePattern; tileMm: number; accent?: string };
  wall: { name: string; color: string };
  wallAccent: { name: string; color: string };
  ceiling: string;
  woods: { dark: [string, string]; mid: [string, string]; light: [string, string] };
  laminate: [string, string];
  lacquer: [string, string];
  fabrics: { main: [string, string]; alt: [string, string]; accent: [string, string] };
  leather: [string, string];
  rug: { name: string; color: string };
  stone: { name: string; color: string; pattern: TexturePattern; accent?: string };
  marble: { name: string; color: string; accent: string };
  metal: { name: string; color: string };
  metalDark: string;
  brass: string;
  tile: { name: string; color: string; grout: string; tileMm: number };
}

const f = (name: string, color: string, rest: Partial<Finish> = {}): Finish => ({
  name,
  color,
  surface: "matte",
  ...rest,
});

function buildFinishes(s: StyleSeed): Record<MaterialKey, Finish> {
  const wood = (pair: [string, string], tile: number): Finish =>
    f(pair[0], pair[1], {
      surface: "wood",
      roughness: 0.52,
      texture: { pattern: "woodGrain", tileMm: tile, contrast: 0.45 },
      relief: 0.6,
    });

  return {
    floor: f(s.floor.name, s.floor.color, {
      surface: s.floor.pattern === "woodPlank" ? "wood" : "stone",
      roughness: s.floor.pattern === "woodPlank" ? 0.42 : 0.3,
      texture: {
        pattern: s.floor.pattern,
        tileMm: s.floor.tileMm,
        accent: s.floor.accent,
        contrast: 0.4,
      },
      clearcoat: s.floor.pattern === "woodPlank" ? 0.25 : 0.4,
      relief: 0.5,
    }),
    floorAccent: f(s.tile.name, s.tile.color, {
      surface: "gloss",
      roughness: 0.18,
      texture: { pattern: "tileGrid", tileMm: s.tile.tileMm, accent: s.tile.grout, contrast: 0.5 },
      clearcoat: 0.5,
    }),
    wall: f(s.wall.name, s.wall.color, {
      surface: "matte",
      roughness: 0.92,
      texture: { pattern: "plaster", tileMm: 1400, contrast: 0.1 },
      relief: 0.35,
    }),
    wallAccent: f(s.wallAccent.name, s.wallAccent.color, {
      surface: "matte",
      roughness: 0.88,
      texture: { pattern: "plaster", tileMm: 1400, contrast: 0.14 },
      relief: 0.4,
    }),
    ceiling: f("Ceiling, flat white", s.ceiling, { surface: "matte", roughness: 0.95 }),
    skirting: f("Skirting", s.lacquer[1], { surface: "satin", roughness: 0.4 }),

    woodDark: wood(s.woods.dark, 900),
    woodMid: wood(s.woods.mid, 900),
    woodLight: wood(s.woods.light, 1100),
    laminate: f(s.laminate[0], s.laminate[1], {
      surface: "satin",
      roughness: 0.34,
      texture: { pattern: "woodGrain", tileMm: 1600, contrast: 0.18 },
      clearcoat: 0.3,
      relief: 0.25,
    }),
    lacquer: f(s.lacquer[0], s.lacquer[1], {
      surface: "satin",
      roughness: 0.26,
      clearcoat: 0.55,
      texture: { pattern: "plaster", tileMm: 900, contrast: 0.04 },
      relief: 0.12,
    }),
    cane: f("Natural cane weave", "#c9a87a", {
      surface: "wood",
      roughness: 0.68,
      texture: { pattern: "caneWeave", tileMm: 110, contrast: 0.55 },
      relief: 1.1,
    }),

    fabric: f(s.fabrics.main[0], s.fabrics.main[1], {
      surface: "fabric",
      roughness: 0.94,
      texture: { pattern: "weave", tileMm: 90, contrast: 0.3 },
      relief: 0.85,
    }),
    fabricAlt: f(s.fabrics.alt[0], s.fabrics.alt[1], {
      surface: "fabric",
      roughness: 0.93,
      texture: { pattern: "linen", tileMm: 80, contrast: 0.26 },
      relief: 0.8,
    }),
    fabricAccent: f(s.fabrics.accent[0], s.fabrics.accent[1], {
      surface: "fabric",
      roughness: 0.9,
      texture: { pattern: "weave", tileMm: 70, contrast: 0.34 },
      relief: 0.85,
    }),
    leather: f(s.leather[0], s.leather[1], {
      surface: "leather",
      roughness: 0.56,
      texture: { pattern: "leatherGrain", tileMm: 160, contrast: 0.4 },
      clearcoat: 0.2,
      relief: 0.7,
    }),
    rug: f(s.rug.name, s.rug.color, {
      surface: "pile",
      roughness: 0.98,
      texture: { pattern: "pile", tileMm: 60, contrast: 0.3 },
      relief: 1.4,
    }),
    cushion: f(s.fabrics.accent[0], s.fabrics.accent[1], {
      surface: "fabric",
      roughness: 0.95,
      texture: { pattern: "linen", tileMm: 60, contrast: 0.28 },
      relief: 0.9,
    }),

    stone: f(s.stone.name, s.stone.color, {
      surface: "stone",
      roughness: 0.42,
      texture: { pattern: s.stone.pattern, tileMm: 1200, accent: s.stone.accent, contrast: 0.4 },
      clearcoat: 0.3,
      relief: 0.4,
    }),
    marble: f(s.marble.name, s.marble.color, {
      surface: "gloss",
      roughness: 0.12,
      texture: { pattern: "marbleVein", tileMm: 1800, accent: s.marble.accent, contrast: 0.55 },
      clearcoat: 0.8,
      relief: 0.15,
    }),
    quartz: f("Engineered quartz", "#ece9e3", {
      surface: "gloss",
      roughness: 0.16,
      texture: { pattern: "graniteSpeckle", tileMm: 600, accent: "#b9b4ab", contrast: 0.22 },
      clearcoat: 0.65,
    }),
    tile: f(s.tile.name, s.tile.color, {
      surface: "gloss",
      roughness: 0.14,
      texture: { pattern: "tileGrid", tileMm: s.tile.tileMm, accent: s.tile.grout, contrast: 0.45 },
      clearcoat: 0.6,
      relief: 0.5,
    }),
    ceramic: f("Glazed ceramic, white", "#f6f6f4", {
      surface: "gloss",
      roughness: 0.08,
      clearcoat: 0.9,
    }),

    metal: f(s.metal.name, s.metal.color, {
      surface: "metal",
      roughness: 0.34,
      metalness: 0.92,
      texture: { pattern: "brushedMetal", tileMm: 300, contrast: 0.2 },
      relief: 0.2,
    }),
    metalDark: f("Powder-coated steel, black", s.metalDark, {
      surface: "metal",
      roughness: 0.48,
      metalness: 0.7,
    }),
    brass: f("Antique brass", s.brass, {
      surface: "metal",
      roughness: 0.3,
      metalness: 0.95,
      texture: { pattern: "brushedMetal", tileMm: 200, contrast: 0.22 },
    }),
    chrome: f("Polished chrome", "#dfe4e6", {
      surface: "metal",
      roughness: 0.06,
      metalness: 1,
    }),
    glass: f("Clear toughened glass", "#cfe2e6", {
      surface: "glass",
      roughness: 0.03,
      opacity: 0.22,
    }),
    mirror: f("Silvered mirror", "#e9eef0", { surface: "mirror", roughness: 0.02, metalness: 1 }),

    plant: f("Foliage", "#49773f", {
      surface: "foliage",
      roughness: 0.74,
      texture: { pattern: "none", tileMm: 200 },
    }),
    planter: f("Terracotta planter", "#9d5f41", { surface: "stone", roughness: 0.7 }),
    screen: f("Display, off", "#15181a", { surface: "gloss", roughness: 0.08, clearcoat: 1 }),
    paper: f("Paper and books", "#e8e2d4", { surface: "matte", roughness: 0.9 }),
    lampshade: f("Linen shade", "#f0e8d8", {
      surface: "fabric",
      roughness: 0.85,
      opacity: 0.72,
      texture: { pattern: "linen", tileMm: 70, contrast: 0.2 },
    }),
    emissive: f("Light source", "#fff3e0", { surface: "emissive" }),
  };
}

const SEEDS: StyleSeed[] = [
  {
    id: "modern",
    name: "Modern",
    note: "Large-format grey tile, walnut joinery, slate upholstery",
    priceMultiplier: 1,
    lightTemperatureK: 3800,
    floor: { name: "Grey vitrified tile, 800 mm", color: "#cdcac4", pattern: "tileGrid", tileMm: 800, accent: "#b6b2ab" },
    wall: { name: "Off-white emulsion", color: "#ece9e3" },
    wallAccent: { name: "Graphite emulsion", color: "#4e565b" },
    ceiling: "#f7f6f3",
    woods: { dark: ["American walnut", "#5d4333"], mid: ["Teak veneer", "#8a6342"], light: ["Natural oak", "#c6a47a"] },
    laminate: ["Matt graphite laminate", "#3f4448"],
    lacquer: ["Satin white lacquer", "#f1f0ed"],
    fabrics: { main: ["Slate wool weave", "#59666d"], alt: ["Pebble linen", "#c6c9c6"], accent: ["Ochre cotton", "#c08a3e"] },
    leather: ["Charcoal leather", "#3a3c3e"],
    rug: { name: "Flatweave wool, stone", color: "#a9a49a" },
    stone: { name: "Kota grey", color: "#9fa6a3", pattern: "terrazzo", accent: "#80888a" },
    marble: { name: "Statuario marble", color: "#f0efeb", accent: "#9aa3a8" },
    metal: { name: "Brushed stainless", color: "#aeb4b7" },
    metalDark: "#2b2f32",
    brass: "#b08d4f",
    tile: { name: "Matt ceramic, 300 mm", color: "#dcdcd8", grout: "#bdbdb8", tileMm: 300 },
  },
  {
    id: "indo",
    name: "Indo-contemporary",
    note: "Kota stone, teak, peacock blue and mustard",
    priceMultiplier: 1.15,
    lightTemperatureK: 3200,
    floor: { name: "Kota stone, honed", color: "#8f9686", pattern: "terrazzo", tileMm: 900, accent: "#737a6c" },
    wall: { name: "Warm ivory lime plaster", color: "#efe3cf" },
    wallAccent: { name: "Indigo lime plaster", color: "#2b4a63" },
    ceiling: "#f6f1e7",
    woods: { dark: ["Burma teak, dark polish", "#5b3620"], mid: ["Teak, natural polish", "#8d5c33"], light: ["Mango wood", "#c3a173"] },
    laminate: ["Teak-grain laminate", "#7a5133"],
    lacquer: ["Ivory duco", "#f2ece0"],
    fabrics: { main: ["Peacock cotton dupion", "#1f5d62"], alt: ["Undyed khadi", "#ddd2bb"], accent: ["Mustard ikat", "#cf9c2c"] },
    leather: ["Tan leather", "#8a5a37"],
    rug: { name: "Dhurrie, madder red", color: "#8c3a2b" },
    stone: { name: "Jaisalmer yellow", color: "#c9b27e", pattern: "graniteSpeckle", accent: "#a28c5c" },
    marble: { name: "Makrana white marble", color: "#efe9dc", accent: "#a89a7e" },
    metal: { name: "Hammered brass", color: "#b58b43" },
    metalDark: "#26211b",
    brass: "#c2963f",
    tile: { name: "Handmade terracotta", color: "#c98a63", grout: "#9c6a4b", tileMm: 200 },
  },
  {
    id: "scandi",
    name: "Scandinavian",
    note: "Light oak boards, chalk white walls, sage and linen",
    priceMultiplier: 1.05,
    lightTemperatureK: 4200,
    floor: { name: "White-oiled oak plank", color: "#d9c4a2", pattern: "woodPlank", tileMm: 1500, accent: "#c2a985" },
    wall: { name: "Chalk white", color: "#f5f4f0" },
    wallAccent: { name: "Sage green", color: "#9aa992" },
    ceiling: "#fbfaf8",
    woods: { dark: ["Smoked oak", "#6f5844"], mid: ["Natural oak", "#bd9c70"], light: ["White-washed ash", "#ddc9ab"] },
    laminate: ["Matt white laminate", "#f2f1ec"],
    lacquer: ["Chalk lacquer", "#f7f6f2"],
    fabrics: { main: ["Sage wool bouclé", "#97a399"], alt: ["Natural linen", "#e3dccd"], accent: ["Rust wool", "#b1683f"] },
    leather: ["Cognac leather", "#9a6238"],
    rug: { name: "Wool shag, oatmeal", color: "#ddd4c4" },
    stone: { name: "Light terrazzo", color: "#dcd7cd", pattern: "terrazzo", accent: "#b3ada0" },
    marble: { name: "Carrara marble", color: "#eeeeea", accent: "#9fa8ab" },
    metal: { name: "Brushed nickel", color: "#b4b8ba" },
    metalDark: "#33383a",
    brass: "#c3a467",
    tile: { name: "Zellige, bone", color: "#e8e2d6", grout: "#cac3b4", tileMm: 120 },
  },
  {
    id: "industrial",
    name: "Industrial",
    note: "Polished concrete, dark leather, black steel frames",
    priceMultiplier: 0.95,
    lightTemperatureK: 3400,
    floor: { name: "Polished concrete", color: "#8f8d88", pattern: "concrete", tileMm: 2400, accent: "#777570" },
    wall: { name: "Bare plaster", color: "#cfcbc3" },
    wallAccent: { name: "Exposed brick, painted", color: "#6d4d42" },
    ceiling: "#d8d5cf",
    woods: { dark: ["Reclaimed pine, dark", "#5a4231"], mid: ["Reclaimed pine", "#8a6a4a"], light: ["Birch ply", "#cdb28c"] },
    laminate: ["Black compact laminate", "#2a2c2e"],
    lacquer: ["Graphite matt", "#43474a"],
    fabrics: { main: ["Charcoal canvas", "#3f3c39"], alt: ["Raw cotton duck", "#b6ab98"], accent: ["Oxblood wool", "#7a3a33"] },
    leather: ["Distressed brown leather", "#6e4a32"],
    rug: { name: "Jute flatweave", color: "#9c8a6c" },
    stone: { name: "Grey granite", color: "#7f817e", pattern: "graniteSpeckle", accent: "#5e6060" },
    marble: { name: "Nero marquina", color: "#2a2b2d", accent: "#cfd2cf" },
    metal: { name: "Hot-rolled steel", color: "#8c9093" },
    metalDark: "#1e2022",
    brass: "#9c7f45",
    tile: { name: "Metro subway tile", color: "#d7d9d6", grout: "#6f716f", tileMm: 150 },
  },
  {
    id: "japandi",
    name: "Japandi",
    note: "Pale ash, warm clay plaster, cane and paper",
    priceMultiplier: 1.12,
    lightTemperatureK: 3000,
    floor: { name: "Ash plank, limed", color: "#cdb795", pattern: "woodPlank", tileMm: 1800, accent: "#b49f7d" },
    wall: { name: "Clay plaster, oat", color: "#e6ded0" },
    wallAccent: { name: "Charcoal lime wash", color: "#54504a" },
    ceiling: "#f4f0e8",
    woods: { dark: ["Charred cedar", "#473a30"], mid: ["Japanese ash", "#a98d68"], light: ["Hinoki", "#dcc8a4"] },
    laminate: ["Fenix oat", "#ddd3c2"],
    lacquer: ["Urushi black", "#241f1c"],
    fabrics: { main: ["Stone washed linen", "#b3ab9c"], alt: ["Undyed hemp", "#d9d1c0"], accent: ["Clay terracotta", "#a9684e"] },
    leather: ["Saddle leather", "#8b6341"],
    rug: { name: "Tatami weave", color: "#cbbd97" },
    stone: { name: "Basalt, honed", color: "#6e706d", pattern: "concrete", accent: "#575a58" },
    marble: { name: "Grey vein marble", color: "#dcdcd7", accent: "#8c9194" },
    metal: { name: "Blackened bronze", color: "#5a5048" },
    metalDark: "#201d1a",
    brass: "#9f7f4b",
    tile: { name: "Hand-glazed square, sand", color: "#ded2bd", grout: "#bfb29b", tileMm: 100 },
  },
  {
    id: "luxe",
    name: "Luxe classic",
    note: "Book-matched marble, dark veneer, brass and velvet",
    priceMultiplier: 1.45,
    lightTemperatureK: 2900,
    floor: { name: "Italian marble, book-matched", color: "#e8e4dc", pattern: "marbleVein", tileMm: 1800, accent: "#9d8f7e" },
    wall: { name: "Pearl metallic emulsion", color: "#e7e1d6" },
    wallAccent: { name: "Deep emerald upholstered panel", color: "#28473c" },
    ceiling: "#f8f5ee",
    woods: { dark: ["Ebony veneer", "#352a24"], mid: ["Fumed oak", "#705340"], light: ["Birds-eye maple", "#cdae7d"] },
    laminate: ["High-gloss ivory", "#f0e9dc"],
    lacquer: ["Gloss champagne", "#e6d9bf"],
    fabrics: { main: ["Emerald velvet", "#27493d"], alt: ["Champagne silk", "#ddcfae"], accent: ["Burgundy velvet", "#6b2c35"] },
    leather: ["Cognac full-grain", "#8e5a31"],
    rug: { name: "Silk-blend Persian", color: "#8f6f58" },
    stone: { name: "Travertine, filled", color: "#ddd2bd", pattern: "terrazzo", accent: "#b9ab92" },
    marble: { name: "Calacatta gold", color: "#f1ece0", accent: "#b89a62" },
    metal: { name: "Polished brass", color: "#c9a55e" },
    metalDark: "#1b1a18",
    brass: "#cfa94f",
    tile: { name: "Marble mosaic", color: "#e4ddcd", grout: "#c0b49c", tileMm: 150 },
  },
];

export const STYLES: Record<string, DesignStyle> = Object.fromEntries(
  SEEDS.map((s) => [
    s.id,
    {
      id: s.id,
      name: s.name,
      note: s.note,
      priceMultiplier: s.priceMultiplier,
      lightTemperatureK: s.lightTemperatureK,
      finishes: buildFinishes(s),
    } satisfies DesignStyle,
  ]),
);

export const STYLE_LIST: DesignStyle[] = SEEDS.map((s) => STYLES[s.id]!);

export const DEFAULT_STYLE_ID = "modern";

export const getStyle = (id: string): DesignStyle => STYLES[id] ?? STYLES[DEFAULT_STYLE_ID]!;

/** Resolve a material slot to a concrete finish, honouring per-item overrides. */
export function resolveFinish(
  style: DesignStyle,
  key: MaterialKey,
  overrides?: Partial<Record<MaterialKey, MaterialKey>>,
): Finish {
  const mapped = overrides?.[key] ?? key;
  return style.finishes[mapped] ?? style.finishes[key];
}
