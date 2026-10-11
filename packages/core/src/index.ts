/**
 * @layoutcraft/core — the domain.
 *
 * No DOM, no React, no three.js. Everything here runs identically in the
 * browser, in a Node API route and in a test, which is what lets the quote the
 * client sees on a share link be computed by exactly the same code that drew it
 * in the editor.
 */

export * from "./units.js";
export * from "./types.js";
export * from "./ids.js";
export * from "./styles.js";
export * from "./rooms.js";
export * from "./geometry.js";
export * from "./validation.js";
export * from "./autolayout.js";
export * from "./pricing.js";
export * from "./fabrication.js";
export * from "./project.js";
export * from "./layouts/index.js";
export { CATALOG, CATALOG_ITEMS, CATALOG_KEYS, CATEGORY_ORDER, catalogByCategory } from "./catalog/index.js";
export * from "./export/csv.js";
