import type { CatalogCategory, CatalogItem } from "../types.js";
import { LIVING } from "./living.js";
import { DINING } from "./dining.js";
import { KITCHEN } from "./kitchen.js";
import { BEDROOM } from "./bedroom.js";
import { BATH, UTILITY } from "./wet.js";
import { STUDY } from "./study.js";
import { LIGHTING } from "./lighting.js";
import { DECOR } from "./decor.js";

export const CATALOG_ITEMS: CatalogItem[] = [
  ...LIVING,
  ...DINING,
  ...KITCHEN,
  ...BEDROOM,
  ...BATH,
  ...STUDY,
  ...UTILITY,
  ...LIGHTING,
  ...DECOR,
];

export const CATALOG: Record<string, CatalogItem> = Object.fromEntries(
  CATALOG_ITEMS.map((i) => [i.key, i]),
);

export const CATEGORY_ORDER: CatalogCategory[] = [
  "Living",
  "Dining",
  "Kitchen",
  "Bedroom",
  "Bath",
  "Study",
  "Utility",
  "Lighting",
  "Decor",
];

export function catalogByCategory(): Array<{ category: CatalogCategory; items: CatalogItem[] }> {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: CATALOG_ITEMS.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);
}

/** Every catalog key, for schema validation and migration pruning. */
export const CATALOG_KEYS = new Set(Object.keys(CATALOG));

export { LIVING, DINING, KITCHEN, BEDROOM, BATH, UTILITY, STUDY, LIGHTING, DECOR };
export * from "./primitives.js";
