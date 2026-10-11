import type { MaterialKey, Mm, RoomType } from "./types.js";

export interface RoomTypeMeta {
  label: string;
  /** Hue used for the plan fill, so rooms read apart at a glance. */
  hue: number;
  /** Default ceiling for this room type, mm. Bathrooms get a lower false ceiling. */
  ceiling?: Mm;
  falseCeiling?: Mm;
  /** Default floor finish slot. */
  floor: MaterialKey;
  /** Catalog categories a designer will reach for first in this room. */
  categories: string[];
}

export const ROOM_TYPES: Record<RoomType, RoomTypeMeta> = {
  living: { label: "Living", hue: 28, floor: "floor", categories: ["Living", "Lighting", "Decor"] },
  dining: { label: "Dining", hue: 44, floor: "floor", categories: ["Dining", "Lighting", "Decor"] },
  kitchen: {
    label: "Kitchen",
    hue: 184,
    falseCeiling: 150,
    floor: "floorAccent",
    categories: ["Kitchen", "Lighting"],
  },
  bedroom: { label: "Bedroom", hue: 214, floor: "floor", categories: ["Bedroom", "Lighting", "Decor"] },
  kids: { label: "Kids' room", hue: 320, floor: "floor", categories: ["Bedroom", "Study", "Decor"] },
  bath: {
    label: "Bathroom",
    hue: 198,
    ceiling: 2400,
    falseCeiling: 250,
    floor: "floorAccent",
    categories: ["Bath", "Lighting"],
  },
  utility: {
    label: "Utility",
    hue: 150,
    floor: "floorAccent",
    categories: ["Utility", "Lighting"],
  },
  study: { label: "Study", hue: 266, floor: "floor", categories: ["Study", "Lighting", "Decor"] },
  balcony: { label: "Balcony", hue: 98, floor: "floorAccent", categories: ["Decor", "Living"] },
  foyer: { label: "Foyer", hue: 16, floor: "floorAccent", categories: ["Living", "Decor", "Lighting"] },
  passage: { label: "Passage", hue: 0, floor: "floor", categories: ["Decor", "Lighting"] },
};

export const ROOM_TYPE_LIST = Object.entries(ROOM_TYPES).map(([id, meta]) => ({
  id: id as RoomType,
  ...meta,
}));
