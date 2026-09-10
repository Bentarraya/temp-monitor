import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServer();

  const { data: readings } = await supabase
    .from("readings")
    .select("id, suhu, kelembaban, recorded_at")
    .order("recorded_at", { ascending: true });

  const { data: status } = await supabase
    .from("device_status")
    .select("*")
    .order("last_seen", { ascending: false })
    .limit(1)
    .maybeSingle();

  const online = status ? Date.now() - new Date(status.last_seen).getTime() < 90 * 1000 : false;

  // "live" = pembacaan sensor paling baru (device_status di-update tiap
  // kali ESP32 kirim data, walau itu ditolak masuk log per-jam).
  // "latest" (dari tabel readings) tetap dikirim buat referensi log resmi.
  const live =
    status && status.suhu !== null
      ? { suhu: status.suhu, kelembaban: status.kelembaban, recorded_at: status.last_seen }
      : null;
  const latest = readings && readings.length > 0 ? readings[readings.length - 1] : null;

  return NextResponse.json(
    {
      online,
      lastSeen: status?.last_seen ?? null,
      live,
      latest,
      todayCount: readings?.length ?? 0,
      target: 24,
      readings: readings ?? [],
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    }
  );
}
