import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, audit, startCheckout, toResponseError } from "@/server";

const schema = z.object({
  plan: z.enum(["SOLO", "STUDIO", "PRACTICE"]),
  interval: z.enum(["month", "year"]).default("month"),
  seats: z.number().int().min(1).max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await apiSession();
    const body = schema.parse(await request.json());
    const url = await startCheckout(session, body);
    await audit(session, "billing.checkout", body.plan, { interval: body.interval, seats: body.seats });
    return NextResponse.json({ url });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
