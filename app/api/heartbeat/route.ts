import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key");
  if (!key || key !== process.env.DEVICE_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const deviceId = body.device_id || "esp32-dht11";

  const update: Record<string, unknown> = {
    device_id: deviceId,
    last_seen: new Date().toISOString(),
  };
  if (typeof body.suhu === "number" && typeof body.kelembaban === "number") {
    update.suhu = body.suhu;
    update.kelembaban = body.kelembaban;
  }

  const supabase = getSupabaseServer();
  await supabase.from("device_status").upsert(update);

  return NextResponse.json({ ok: true });
}
