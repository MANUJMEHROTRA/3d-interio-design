import { NextResponse } from "next/server";
import { apiSession, billingPortal, toResponseError } from "@/server";

export async function POST() {
  try {
    const session = await apiSession();
    return NextResponse.json({ url: await billingPortal(session) });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
