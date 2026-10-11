import { requireSession } from "@/server";

/**
 * The editor gets the whole viewport.
 *
 * No navigation bar, no page padding, no scroll container: the plan and the 3D
 * view both need to fill the window, and a designer working on a layout does
 * not need a link to the billing page in their eyeline.
 */
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <div className="h-dvh overflow-hidden bg-bg">{children}</div>;
}
