import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { now: Math.floor(Date.now() / 1000) }, // epoch UTC, detik
    { headers: { "Cache-Control": "no-store" } }
  );
}
