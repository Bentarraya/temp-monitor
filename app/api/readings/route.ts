import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

const MIN_INTERVAL_MS = 55 * 60 * 1000; // jaga-jaga: minimal ~55 menit antar data

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-api-key");
  return key && key === process.env.DEVICE_API_KEY;
}

// ESP32 kirim data suhu/kelembaban ke sini, sekali per jam
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.suhu !== "number" || typeof body.kelembaban !== "number") {
    return NextResponse.json({ error: "payload tidak valid, butuh suhu & kelembaban (number)" }, { status: 400 });
  }

  const deviceId = body.device_id || "esp32-dht11";
  const supabase = getSupabaseServer();

  // Enforce hanya 1 data per jam: cek data terbaru
  const { data: last } = await supabase
    .from("readings")
    .select("recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last) {
    const diff = Date.now() - new Date(last.recorded_at).getTime();
    if (diff < MIN_INTERVAL_MS) {
      // Tetap update status "online" walau data ditolak, biar indikator UI akurat
      await supabase.from("device_status").upsert({
        device_id: deviceId,
        last_seen: new Date().toISOString(),
        suhu: body.suhu,
        kelembaban: body.kelembaban,
      });
      return NextResponse.json(
        { skipped: true, reason: "belum 1 jam sejak data terakhir" },
        { status: 200 }
      );
    }
  }

  const { error: insertError } = await supabase.from("readings").insert({
    suhu: body.suhu,
    kelembaban: body.kelembaban,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await supabase.from("device_status").upsert({
    device_id: deviceId,
    last_seen: new Date().toISOString(),
    suhu: body.suhu,
    kelembaban: body.kelembaban,
  });

  return NextResponse.json({ ok: true });
}
